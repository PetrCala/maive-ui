# RTMA (Right-Truncated Meta-Analysis) Model Function
# Uses the phacking package to fit RTMA for p-hacking correction

# nolint start: undesirable_function_linter.
library(phacking)
# nolint end: undesirable_function_linter.

RTMA_PLOT_RES <- 120

# Default RNG seed for the RTMA sampler.
#
# phacking::phacking_meta() takes no seed argument, so RStan draws a fresh one on
# every call. The mode comes from a deterministic mle_params() optimisation and
# is stable, but the credible interval is a posterior quantile and moves between
# runs on identical input, which reports Monte Carlo noise as statistical
# uncertainty (#479). Seeding immediately before the fit makes the whole result
# bit-identical across repeats.
#
# The value is arbitrary; what matters is that it is fixed, reported back in the
# response, and overridable through params$seed so a caller can vary it
# deliberately (e.g. to check that an interval is Monte Carlo stable).
#
# It is not entirely free of consequences, though. On a weakly identified dataset
# the sampler's trajectory depends on where it starts, so some seeds send it into
# a pathologically deep tree: on the e2e "precise estimates" fixture that happens
# for 20250101 and 2026, and on the near-degenerate /v1 fixture for 42 and 8454.
# Unseeded runs took that gamble on every call, so this is not a new failure
# mode, but a fixed seed makes it deterministic, so this value was timed against
# every RTMA fixture in the e2e suite (all fits under 8 seconds). What an unlucky
# (dataset, seed) pair can cost is bounded by RTMA_STAN_CONTROL below, and the
# wall-clock budget is the backstop behind that.
RTMA_DEFAULT_SEED <- 2025L

# Sampler settings for the RTMA fit, passed to phacking_meta()'s stan_control.
#
# This list replaces phacking's default outright rather than merging into it, so
# adapt_delta has to be restated at phacking's own 0.98; letting it fall back to
# Stan's 0.8 would move every number this app reports.
#
# max_treedepth caps one NUTS iteration at 2^12 = 4096 leapfrog steps, against
# the 2^20 phacking asks for. Two regimes, and the cap is invisible in the first:
#
#   * Well identified data. No trajectory comes near either ceiling, so the draws
#     are bit-identical to the uncapped fit. Verified per fixture in the
#     performance report (#518, section 6) and again through this entry point on
#     the e2e fixture, its sign-mirrored twin, and an n = 300 dataset.
#   * Weakly identified data. The posterior grows a heavy flat shelf running out
#     to large (mu, tau), a chain that wanders onto it saturates whatever depth
#     it is allowed, and at depth 20 that is minutes per iteration. This is where
#     the multi-minute RTMA grinds and the Lambda hard-kills came from. The cap
#     does not make such a fit good; it makes it fail fast and visibly. Those
#     runs now come back in seconds either recovered (r_hat near 1) or with r_hat
#     far above 1 and divergent transitions, both of which the response's
#     diagnostics block already reports (#480). Draw-dependent outputs (median,
#     credible interval, n_eff) move within the seed-to-seed spread such datasets
#     already have; the mode comes from a separate deterministic optimisation
#     anchored in the posterior's core and does not move.
#
# Depth 10 was measured to break otherwise recoverable fits (r_hat 8 to 15), so
# 12 is the validated floor rather than a round number.
RTMA_STAN_CONTROL <- list(adapt_delta = 0.98, max_treedepth = 12L)

# Upper bound on sampling cores: rstan runs 4 chains by default and forks at
# most one worker per chain, so nothing above this can be used.
RTMA_MAX_SAMPLING_CORES <- 4L

# Seconds reserved out of a request-level budget for the work that follows the
# fit: diagnostics, the optional z-density render, serialization. When the
# server handlers pass request_budget_sec (see run_rtma_model), the fit child
# is killed this much before the request-level guard in request_bounds.R would
# kill the whole request, so the fit-specific timeout message below normally
# wins the race and reaches the caller.
RTMA_FIT_HEADROOM_SEC <- 10

#' Number of cores to sample RTMA's Stan chains on
#'
#' rstan reads `getOption("mc.cores")` to decide how many of its 4 chains to run
#' at once, and on Linux (and macOS) it forks with `mclapply`, so the overhead is
#' sub-second. Sampling is ~95% of RTMA wall time, so this is the single largest
#' lever on how long a request takes (#483).
#'
#' The count is read from the environment rather than detected, for two reasons.
#' `parallel::detectCores()` reports the host's cores, not the Lambda's
#' allocation, so it over-subscribes and the chains thrash. And the number of
#' cores a Lambda gets is a function of its memory size (~1 vCPU per 1769 MB),
#' which lives in terraform, not here: `RTMA_SAMPLING_CORES` is set alongside
#' `memory_size` in prod-runtime/lambda.tf so the two cannot drift apart.
#'
#' Defaults to 1 (serial) when unset, so local runs and the e2e suite behave as
#' they did before.
#'
#' @return A positive integer core count
rtma_sampling_cores <- function() {
  n <- suppressWarnings(as.integer(Sys.getenv("RTMA_SAMPLING_CORES")))
  if (length(n) != 1 || is.na(n) || n < 1) 1L else n
}

#' Snapshot the machine's pid -> parent pid table
#'
#' Read from /proc on Linux (the Lambda image, where `ps` is not installed) and
#' from ps everywhere else (macOS, where local dev and the e2e suite run).
#' Processes that exit between the listing and the read are dropped rather than
#' reported with a missing parent.
#'
#' @return list(pid = <integer>, ppid = <integer>), or NULL if neither source
#'   could be read
rtma_process_table <- function() {
  tryCatch(
    {
      if (dir.exists("/proc")) {
        pids <- as.integer(list.files("/proc", pattern = "^[0-9]+$"))
        ppids <- vapply(pids, function(pid) {
          # /proc/<pid>/stat is one line: pid (comm) state ppid ... The command
          # name can contain spaces and parentheses, so parse from the last
          # closing parenthesis, after which the fields are fixed-width.
          stat <- tryCatch(
            readLines(file.path("/proc", pid, "stat"), warn = FALSE),
            error = function(e) character(0)
          )
          if (length(stat) != 1) {
            return(NA_integer_)
          }
          fields <- strsplit(sub("^.*\\)\\s*", "", stat), " ", fixed = TRUE)[[1]]
          suppressWarnings(as.integer(fields[2]))
        }, integer(1))
      } else {
        lines <- suppressWarnings(
          system2("ps", c("-Ao", "pid=,ppid="), stdout = TRUE, stderr = FALSE)
        )
        fields <- strsplit(trimws(lines), "[[:space:]]+")
        fields <- fields[lengths(fields) == 2]
        pids <- suppressWarnings(as.integer(vapply(fields, `[[`, "", 1)))
        ppids <- suppressWarnings(as.integer(vapply(fields, `[[`, "", 2)))
      }
      complete <- !is.na(pids) & !is.na(ppids)
      list(pid = pids[complete], ppid = ppids[complete])
    },
    error = function(e) NULL
  )
}

#' Transitive descendants of a process within a table snapshot
#'
#' @param pid Root process id
#' @param table Snapshot from rtma_process_table(), or NULL
#' @return Integer vector of descendant pids, possibly empty
rtma_descendants <- function(pid, table) {
  pid <- as.integer(pid)
  if (is.null(table) || length(table$pid) == 0) {
    return(integer(0))
  }
  found <- integer(0)
  frontier <- pid
  repeat {
    children <- setdiff(table$pid[table$ppid %in% frontier], c(found, pid))
    if (length(children) == 0) {
      return(found)
    }
    found <- c(found, children)
    frontier <- children
  }
}

#' Kill a fit child together with every Stan worker it forked
#'
#' Killing the child alone is not enough. With mc.cores > 1 it forks a worker
#' per chain, SIGKILL skips R's mc.cleanup, and an orphaned worker mid-grind
#' keeps burning the container's CPU with nothing left to stop it. So the
#' workers go first, while their parent is still alive: the ppid links that
#' identify them disappear the moment the child dies and the kernel reparents
#' its orphans to init.
#'
#' The scan repeats so that a worker forked between one scan and its kill is
#' still caught. Workers already killed stay visible as zombies of the live
#' child, so the loop terminates on the set of pids already signalled rather
#' than on liveness. In practice rstan forks once, at the start of sampling,
#' and the second scan finds nothing new.
#'
#' @param pid Process id of the fit child
#' @return Integer vector of the worker pids signalled, invisibly
rtma_kill_fit_tree <- function(pid) {
  pid <- as.integer(pid)
  signalled <- integer(0)
  for (attempt in seq_len(3L)) {
    workers <- setdiff(rtma_descendants(pid, rtma_process_table()), signalled)
    if (length(workers) == 0) {
      break
    }
    for (worker in workers) {
      tools::pskill(worker, tools::SIGKILL)
    }
    signalled <- c(signalled, workers)
    Sys.sleep(0.05)
  }
  tools::pskill(pid, tools::SIGKILL)
  invisible(signalled)
}

#' Run the RTMA fit under a wall-clock budget that is actually enforced
#'
#' setTimeLimit cannot do this job. R checks elapsed-time limits only at R-level
#' interrupt points, and a grinding Stan chain does not return to R until it
#' finishes; with forked chains the parent blocks in the worker-collect loop
#' instead, which is no better. Measured overshoot was minutes past a 15 second
#' budget in both configurations (#518, section 4), which on Lambda means the
#' documented timeout error never arrives and the request dies as an opaque hard
#' kill at the function timeout.
#'
#' So on unix the fit runs in a forked child this process can kill: poll for its
#' result, and at the deadline kill the child and its Stan workers. Where R
#' cannot fork the fit runs in-process under setTimeLimit, which is best-effort
#' for the same reason as before; that path is dev-only (Windows).
#'
#' Failures are returned rather than thrown so that the caller owns every
#' user-facing message, and so that a timeout cannot be confused with a fit
#' error that happens to arrive near the deadline.
#'
#' @param fit_call Zero-argument function that runs the fit. Whatever it
#'   returns is handed back untouched, so it can carry the fit plus anything
#'   that does not cross a process boundary on its own (see rtma_fit_call in
#'   run_rtma_model, which collects the fit's warnings).
#' @param timeout_sec Wall-clock budget in seconds
#' @return One of list(status = "ok", value = <fit_call's value>),
#'   list(status = "timeout"), list(status = "error", message = <string>), or
#'   list(status = "died") when the child vanished without either
run_rtma_fit_bounded <- function(fit_call, timeout_sec) {
  if (.Platform$OS.type != "unix") {
    return(run_rtma_fit_in_process(fit_call, timeout_sec))
  }

  job <- parallel::mcparallel(fit_call())
  collected <- NULL
  # The child must not outlive this call on any exit path: the deadline, an
  # error raised below, or an interrupt delivered to the serving process.
  on.exit(
    if (is.null(collected)) {
      rtma_kill_fit_tree(job$pid)
      # Reap the corpse rather than leave a zombie for the life of the
      # container. mccollect warns that the job returned no result, which is
      # exactly what a killed child looks like and carries no information.
      suppressWarnings(try(
        parallel::mccollect(job, wait = FALSE, timeout = 1),
        silent = TRUE
      ))
    },
    add = TRUE
  )

  deadline <- Sys.time() + timeout_sec
  repeat {
    remaining <- as.numeric(difftime(deadline, Sys.time(), units = "secs"))
    if (remaining <= 0) {
      break
    }
    # Sliced so the deadline is honoured to about a quarter second however long
    # the fit runs. Each slice blocks in select(), so this is not a spin.
    collected <- parallel::mccollect(
      job,
      wait = FALSE,
      timeout = min(0.25, remaining)
    )
    if (!is.null(collected)) {
      break
    }
  }

  if (is.null(collected)) {
    return(list(status = "timeout"))
  }

  result <- collected[[1]]
  if (inherits(result, "try-error")) {
    # The child's own error, forwarded by mccollect. Report the message
    # phacking wrote rather than mccollect's wrapper text.
    condition <- attr(result, "condition")
    return(list(
      status = "error",
      message = if (is.null(condition)) {
        trimws(as.character(result))
      } else {
        conditionMessage(condition)
      }
    ))
  }
  if (is.null(result)) {
    # Gone without a result and without an error: killed from outside this
    # request, in practice by the kernel's OOM killer.
    return(list(status = "died"))
  }
  list(status = "ok", value = result)
}

#' Run the RTMA fit in this process under a best-effort time limit
#'
#' The fallback for platforms that cannot fork. setTimeLimit only fires at
#' R-level interrupt points, so the budget holds for everything except the one
#' case it is there for; it is kept because a loose bound beats none, and
#' because no deployed environment takes this path.
#'
#' @param fit_call Zero-argument function that runs the fit
#' @param timeout_sec Wall-clock budget in seconds
#' @return The same outcome list as run_rtma_fit_bounded()
run_rtma_fit_in_process <- function(fit_call, timeout_sec) {
  started <- Sys.time()
  setTimeLimit(elapsed = timeout_sec, transient = TRUE)
  on.exit(setTimeLimit(), add = TRUE)
  tryCatch(
    list(status = "ok", value = fit_call()),
    error = function(e) {
      setTimeLimit() # clear so error reporting is not itself interrupted
      elapsed <- as.numeric(difftime(Sys.time(), started, units = "secs"))
      err_message <- conditionMessage(e)
      # The interrupt fires inside phacking, which re-throws it as an opaque
      # message, so elapsed time is the more reliable of the two tests.
      if (elapsed >= timeout_sec * 0.95 ||
        grepl("elapsed time limit", err_message, fixed = TRUE)) {
        list(status = "timeout")
      } else {
        list(status = "error", message = err_message)
      }
    }
  )
}

#' Render a z-score density plot and return it as a base64-encoded PNG data URI
#'
#' phacking::z_density() has no favor_positive argument: it always draws the
#' dashed critical line at +tcrit. phacking_meta() internally does
#' `if (!favor_positive) yi <- -yi` before computing its
#' affirm <- (yi / sei) > tcrit split, so the affirmative/nonaffirmative
#' counts reported alongside this plot are on that flipped scale. Apply the
#' same flip here, otherwise a negative favored direction draws a density
#' that sits on the opposite side of the fixed critical line from the counts
#' next to it (#486). The axis is relabeled with the sign convention in use
#' so a mirrored plot cannot be mistaken for the raw z-score.
#'
#' @param yi Numeric vector of point estimates, in the caller's original sign
#' @param vi Numeric vector of estimated variances
#' @param favor_positive Whether the favored direction is positive
#' @param alpha_select Significance threshold (default 0.05)
#' @param res Plot resolution in pixels per inch
#' @return A list with data_uri, width_px, height_px
render_z_density_plot <- function(yi, vi, favor_positive = TRUE, alpha_select = 0.05, res = RTMA_PLOT_RES) {
  width_px <- res * 7
  height_px <- res * 7

  plot_yi <- if (favor_positive) yi else -yi
  # One fixed label regardless of favor_positive: the flip above means
  # "positive" always denotes the favored direction on this axis, whichever
  # way the caller's raw yi points. Stating that plainly is both the sign
  # convention the issue asked for and (unlike echoing "yi" vs "-yi") keeps
  # the rendered plot identical for a dataset and its favorPositive-mirrored
  # counterpart, which is exactly the invariant this fix restores.
  axis_label <- "Z-score (positive = favored direction)"

  tmp <- tempfile(fileext = ".png")
  ragg::agg_png(tmp, width = width_px, height = height_px, res = res)
  p <- phacking::z_density(yi = plot_yi, vi = vi, alpha_select = alpha_select)
  # z_density() sets the x scale's name explicitly (scale_x_continuous(name=
  # "Z-score", ...)), which labs()/xlab() cannot override: an explicit scale
  # name always wins over plot-level labs. Set it on the scale directly.
  for (i in seq_along(p$scales$scales)) {
    if ("x" %in% p$scales$scales[[i]]$aesthetics) {
      p$scales$scales[[i]]$name <- axis_label
    }
  }
  print(p)
  dev.off()

  raw_png <- readBin(tmp, "raw", n = file.info(tmp)$size)
  unlink(tmp)

  data_uri <- paste0(
    "data:image/png;base64,",
    base64enc::base64encode(raw_png)
  )
  list(
    data_uri = data_uri,
    width_px = width_px,
    height_px = height_px
  )
}

#' Run the RTMA model
#'
#' @param data JSON string of the uploaded data (same convention as run_maive_model)
#' @param parameters JSON string of RTMA parameters
#' @param include_plot Whether to render the z-score density plot. Skipping it
#'   saves the ragg render (and ~50KB of response) when the caller has no use
#'   for it, e.g. the default /v1 response before `?include=plot` (#483).
#' @param request_budget_sec Request-level wall-clock budget the caller
#'   enforces (the server handlers pass the budget they run this function
#'   under, see request_bounds.R). When set, the fit gets this budget minus
#'   RTMA_FIT_HEADROOM_SEC and params$timeoutSeconds is ignored, having
#'   already been resolved into the budget by the handler. When NULL
#'   (standalone use, e.g. the reproducibility package), the old contract
#'   holds: params$timeoutSeconds bounds the fit, defaulting to 480 s.
#' @return A list of RTMA results
run_rtma_model <- function(data, parameters, include_plot = TRUE, request_budget_sec = NULL) {
  # Parse JSON inputs
  df <- jsonlite::fromJSON(data)
  params <- jsonlite::fromJSON(parameters)

  cli::cli_h2("RTMA input data frame structure:")
  cli::cli_code(capture.output(str(df)))
  cli::cli_h2("RTMA input parameters:")
  cli::cli_code(capture.output(print(params))) # nolint: undesirable_function_linter.

  if (!is.data.frame(df)) {
    df <- as.data.frame(df)
  }

  n_cols <- ncol(df)
  if (n_cols < 2) {
    cli::cli_abort(paste("Data must have at least 2 columns (yi, se). Found", n_cols, "columns."))
  }

  # First two columns are effect size and standard error
  yi <- as.numeric(df[[1]])
  se <- as.numeric(df[[2]])

  if (any(is.na(yi))) {
    cli::cli_alert_warning(sprintf("Dropping %d NA values from effect sizes", sum(is.na(yi))))
  }
  if (any(is.na(se))) {
    cli::cli_alert_warning(sprintf("Dropping %d NA values from standard errors", sum(is.na(se))))
  }

  valid <- !is.na(yi) & !is.na(se) & se > 0
  # The drop count goes into the response (#481); it used to be visible only in
  # this log, so callers could not tell that rows had been excluded.
  dropped_rows <- sum(!valid)
  yi <- yi[valid]
  se <- se[valid]

  cli::cli_alert_info(sprintf("RTMA: %d valid observations", length(yi)))

  # Apply winsorization if requested (reuse logic from maive_model.R)
  winsorize_pct <- suppressWarnings(as.numeric(params$winsorize))
  if (length(winsorize_pct) == 1 && !is.na(winsorize_pct) && winsorize_pct > 0) {
    source("maive_model.R") # for winsorize_percent

    winsorize_pct_text <- if (abs(winsorize_pct - round(winsorize_pct)) < .Machine$double.eps) {
      sprintf("%.0f", winsorize_pct)
    } else {
      sprintf("%.1f", winsorize_pct)
    }

    cli::cli_alert_info(
      sprintf("Applying %s%% winsorization to effect sizes and standard errors", winsorize_pct_text)
    )
    yi_winsor <- winsorize_percent(yi, winsorize_pct)
    se_winsor <- winsorize_percent(se, winsorize_pct)

    yi <- yi_winsor$values
    se <- se_winsor$values

    format_bounds <- function(bounds) {
      if (any(is.na(bounds))) {
        return("not applied (insufficient non-missing values)")
      }
      sprintf(
        "[%s, %s]",
        format(signif(bounds[1], 6), scientific = FALSE),
        format(signif(bounds[2], 6), scientific = FALSE)
      )
    }

    cli::cli_bullets(c(
      sprintf(
        "Effects clipped to %s (%d lower, %d upper replacements).",
        format_bounds(yi_winsor$bounds),
        yi_winsor$clipped[1],
        yi_winsor$clipped[2]
      ),
      sprintf(
        "Standard errors clipped to %s (%d lower, %d upper replacements).",
        format_bounds(se_winsor$bounds),
        se_winsor$clipped[1],
        se_winsor$clipped[2]
      )
    ))
  }

  vi <- se^2

  # Extract RTMA parameters with defaults
  favor_positive <- if (!is.null(params$favorPositive)) isTRUE(params$favorPositive) else TRUE
  alpha_select <- if (!is.null(params$alphaSelect)) as.numeric(params$alphaSelect) else 0.05
  ci_level <- if (!is.null(params$ciLevel)) as.numeric(params$ciLevel) else 0.95
  # Cores to sample on; see rtma_sampling_cores() above. Overridable per request
  # so a benchmark can compare core counts without redeploying, but not exposed
  # through the public /v1 API (see api_v1.R).
  cores <- if (!is.null(params$cores)) {
    suppressWarnings(as.integer(params$cores))
  } else {
    rtma_sampling_cores()
  }
  if (length(cores) != 1 || is.na(cores) || cores < 1) {
    cli::cli_abort("The cores parameter must be a positive integer.")
  }
  # The legacy /run-rtma route (index.R) hands `parameters` to this function
  # unfiltered, and it is publicly reachable, so `cores` is caller-settable
  # there. rstan already forks only min(chains, cores) workers, so a large
  # value cannot fork-bomb, but clamping here means that guarantee does not
  # depend on an rstan implementation detail. RTMA_MAX_SAMPLING_CORES is the
  # chain count: more cores than chains buys nothing.
  cores <- min(cores, RTMA_MAX_SAMPLING_CORES)
  # Wall-clock budget for the fit; the timeout message reports budget_sec, the
  # bound the caller asked for, while timeout_sec is the enforced fit deadline.
  if (!is.null(request_budget_sec)) {
    # Server path: the handler enforces request_budget_sec around this whole
    # call (#526). The fit gets it minus headroom so this function's timeout
    # error beats the request-level kill; the max() keeps a tiny budget (e.g.
    # the e2e timeout scenario's 0.2 s) positive instead of going negative.
    # budget_sec is read by cli glue strings below. # nolint next: object_usage_linter.
    budget_sec <- request_budget_sec
    timeout_sec <- max(
      request_budget_sec - RTMA_FIT_HEADROOM_SEC,
      request_budget_sec * 0.9
    )
  } else {
    # Standalone path, kept below the Lambda function timeout so a degenerate
    # dataset returns a clear error instead of being hard-killed mid-request.
    # Validated like cores above, and for the same reason: this is
    # caller-settable, and run_rtma_fit_bounded() needs a real positive number
    # to compute a deadline.
    timeout_sec <- if (!is.null(params$timeoutSeconds)) {
      suppressWarnings(as.numeric(params$timeoutSeconds))
    } else {
      480
    }
    # is.finite() rejects NA, NaN and Inf in one test.
    if (length(timeout_sec) != 1 || !is.finite(timeout_sec) || timeout_sec <= 0) {
      cli::cli_abort("The timeoutSeconds parameter must be a positive number.")
    }
    budget_sec <- timeout_sec
  }
  # Sampler seed; see RTMA_DEFAULT_SEED above for why it must be pinned.
  seed <- if (!is.null(params$seed)) {
    suppressWarnings(as.integer(params$seed))
  } else {
    RTMA_DEFAULT_SEED
  }
  if (length(seed) != 1 || is.na(seed)) {
    cli::cli_abort("The seed parameter must be a single integer.")
  }

  cli::cli_h2("RTMA parameters:")
  cli::cli_bullets(c(
    "favor_positive: {favor_positive}",
    "alpha_select: {alpha_select}",
    "ci_level: {ci_level}",
    "seed: {seed}",
    "cores: {cores}",
    "budget_sec: {budget_sec}",
    "timeout_sec: {timeout_sec}"
  ))

  # rstan takes its chain count from mc.cores, so set it here rather than
  # passing parallelize = TRUE: that flag makes phacking call
  # `options(mc.cores = parallel::detectCores())`, which reads the host's core
  # count instead of the Lambda's allocation. The fit child inherits the option
  # across the fork. Restored afterwards so a request cannot leave the option
  # changed for the next one in the same container.
  previous_mc_cores <- getOption("mc.cores")
  on.exit(options(mc.cores = previous_mc_cores), add = TRUE)
  options(mc.cores = cores)

  # phacking_meta() signals conditions the caller must see, above all "Favored
  # direction is opposite of the pooled estimate.", which means the fit
  # truncated nothing and the returned mu is effectively uncorrected. They are
  # collected next to the fit rather than left to propagate: warnings do not
  # cross a process boundary, and this closure runs in the fit child.
  rtma_fit_call <- function() {
    fit_warnings <- character(0)
    fit <- withCallingHandlers(
      {
        # Seeded here rather than at the top of the function: nothing between
        # this line and phacking_meta() touches the RNG, so this is exactly the
        # state the sampler starts from, in the child as much as in-process.
        # The seed also fixes rstan's own seed, which it draws from this RNG,
        # so each chain's stream is determined by its chain id alone; running
        # the chains on 1 core or 4 gives bit-identical draws (verified in
        # #483).
        set.seed(seed)
        phacking::phacking_meta(
          yi = yi,
          vi = vi,
          favor_positive = favor_positive,
          alpha_select = alpha_select,
          ci_level = ci_level,
          stan_control = RTMA_STAN_CONTROL,
          parallelize = FALSE
        )
      },
      warning = function(w) {
        fit_warnings <<- c(fit_warnings, conditionMessage(w))
        invokeRestart("muffleWarning")
      }
    )
    list(fit = fit, warnings = fit_warnings)
  }

  # Pathological datasets can make the sampler's tree depth explode.
  # RTMA_STAN_CONTROL bounds how expensive a single iteration can get;
  # run_rtma_fit_bounded() bounds the fit as a whole, and unlike the
  # setTimeLimit guard it replaces, it can actually stop a running chain.
  fit_outcome <- run_rtma_fit_bounded(rtma_fit_call, timeout_sec)
  fit_result <- switch(fit_outcome$status,
    ok = fit_outcome$value,
    # The class marks this as a budget kill so the request-level guard in
    # request_bounds.R (which sees it as the child's forwarded error) reports
    # it as a structured timeout rather than an internal error. The string
    # must match REQUEST_TIMEOUT_ERROR_CLASS there; it is spelled out because
    # this file also runs standalone, without request_bounds.R.
    timeout = cli::cli_abort(
      c(
        "RTMA timed out after {budget_sec} seconds.",
        "i" = "The run exceeded its time budget before finishing; this does not necessarily mean it diverged. Try winsorizing outliers or reducing the number of estimates."
      ),
      class = "request_timeout_error"
    ),
    died = cli::cli_abort(c(
      "The RTMA fit stopped before returning a result.",
      "i" = "The fit process was killed from outside the request, which usually means the container ran out of memory. Try reducing the number of estimates."
    )),
    error = {
      # "{err_message}" rather than paste(): an error text containing braces
      # would otherwise be re-interpolated by cli and take down the report of
      # the very error it describes.
      err_message <- fit_outcome$message
      cli::cli_alert_danger("RTMA error: {err_message}")
      cli::cli_abort("RTMA analysis failed: {err_message}")
    },
    cli::cli_abort("Unrecognized RTMA fit outcome: {fit_outcome$status}")
  )
  rtma_res <- fit_result$fit
  rtma_warnings <- fit_result$warnings

  cli::cli_h2("RTMA results structure:")
  cli::cli_code(capture.output(str(rtma_res, max.level = 2)))

  # Extract mu and tau from $stats tibble
  # $stats has columns: param, mode, median, mean, se, ci_lower, ci_upper,
  # n_eff, r_hat. Note that `se` is phacking's rename of rstan's se_mean, the
  # Monte Carlo error of the posterior mean, not the posterior SD: on the app's
  # demo dataset it is 0.046 against a posterior SD of 1.248. It is deliberately
  # not reported; the credible interval is the dispersion measure this response
  # carries (#480).
  stats <- rtma_res$stats
  mu_row <- stats[stats$param == "mu", ]
  tau_row <- stats[stats$param == "tau", ]

  mu_est <- mu_row$mode
  mu_median <- mu_row$median
  mu_ci <- c(mu_row$ci_lower, mu_row$ci_upper)
  tau_est <- tau_row$mode
  tau_median <- tau_row$median
  tau_ci <- c(tau_row$ci_lower, tau_row$ci_upper)

  # phacking_meta() does `if (!favor_positive) yi <- -yi` and then reports mu and
  # its credible interval on that flipped scale, never mapping them back to the
  # caller's sign convention. Undo the flip here, otherwise favor_positive =
  # FALSE returns a corrected mean with the wrong sign. Negating an interval also
  # reverses its bounds. tau is a scale parameter and is sign-invariant, so it is
  # left alone. Upstream: mathurlabstanford/metabias-apps#1.
  if (!favor_positive) {
    mu_est <- -mu_est
    mu_median <- -mu_median
    mu_ci <- c(-mu_ci[2], -mu_ci[1])
  }

  # Convergence diagnostics (#480). phacking_meta() computes all of these and
  # run_rtma_model() used to drop every one, so a failed fit and a clean fit
  # returned responses that looked identical.
  #
  # Unknown is reported as a logical NA, which the unboxed-JSON serializer
  # writes as null: a diagnostic that cannot be read should say so rather than
  # take a valid analysis down with it, and null is distinguishable from a real
  # value in a way that a substituted number would not be.
  diagnostic_value <- function(row, column) {
    if (!column %in% names(row)) {
      return(NA)
    }
    value <- as.numeric(row[[column]])
    if (length(value) != 1 || is.na(value)) NA else value
  }

  # The sharpest of the four: mu above is the mode from a separate mle_params()
  # optimisation rather than a posterior summary, so an optimisation that failed
  # leaves the headline point estimate meaningless while the credible interval,
  # a posterior quantile, is untouched. Nothing else in this response tells the
  # two cases apart.
  optim_converged <- if (is.null(rtma_res$values$optim_converged)) {
    NA
  } else {
    isTRUE(rtma_res$values$optim_converged)
  }

  # Divergent transitions come off the Stan fit rather than the $stats tibble.
  # Any at all mean the sampler could not explore part of the posterior, so the
  # intervals can be wrong even when r_hat looks healthy. Guarded because $fits
  # is whatever phacking chose to hand metabias.
  divergences <- tryCatch(
    as.integer(rstan::get_num_divergent(rtma_res$fits)),
    error = function(e) NA
  )

  # Nonaffirmative (insignificant) estimates
  k <- rtma_res$values$k
  k_nonaffirmative <- rtma_res$values$k_nonaffirmative
  k_affirmative <- k - k_nonaffirmative
  nonaffirmative_proportion <- if (k > 0) k_nonaffirmative / k else NA_real_

  # Naive inverse-variance (fixed-effect) pooled mean of the analyzed estimates,
  # with no truncation correction, on the caller's sign convention. Returned so
  # the UI can show the size and direction of the RTMA correction (#481).
  unadjusted_mean <- sum(yi / vi) / sum(1 / vi)

  # Every estimate being nonaffirmative means nothing was truncated, so mu is the
  # uncorrected pooled mean wearing a corrected label. In practice this always
  # means the favored direction is set the wrong way round for the data, so say
  # so explicitly rather than leaving it to phacking's own warning, which is
  # phrased in terms of the pooled estimate.
  if (isTRUE(k > 0 && k_nonaffirmative == k)) {
    rtma_warnings <- c(
      rtma_warnings,
      paste(
        "No estimate is affirmative in the favored direction, so RTMA truncated",
        "nothing and the reported mean is not corrected for p-hacking. Check the",
        sprintf("\"favor positive\" setting (currently %s).", favor_positive)
      )
    )
  }

  # Warnings are muffled above so they never reach the Lambda log on their own;
  # re-emit them here. "{msg}" keeps cli from glue-interpolating the message.
  rtma_warnings <- unique(rtma_warnings)
  if (length(rtma_warnings) > 0) {
    cli::cli_h2("RTMA warnings:")
    for (msg in rtma_warnings) {
      cli::cli_alert_warning("{msg}")
    }
  }

  cli::cli_h2("RTMA summary:")
  cli::cli_bullets(c(
    "mu (mode): {round(mu_est, 4)}",
    "mu (median): {round(mu_median, 4)}",
    "mu CI: [{round(mu_ci[1], 4)}, {round(mu_ci[2], 4)}]",
    "tau (mode): {round(tau_est, 4)}",
    "tau (median): {round(tau_median, 4)}",
    "tau CI: [{round(tau_ci[1], 4)}, {round(tau_ci[2], 4)}]",
    "unadjusted FE mean: {round(unadjusted_mean, 4)}",
    "k_nonaffirmative: {k_nonaffirmative} / {k} ({round(nonaffirmative_proportion * 100, 1)}%)",
    "dropped rows: {dropped_rows}",
    "optim converged: {optim_converged}",
    "r_hat: mu {diagnostic_value(mu_row, 'r_hat')}, tau {diagnostic_value(tau_row, 'r_hat')}",
    "n_eff: mu {diagnostic_value(mu_row, 'n_eff')}, tau {diagnostic_value(tau_row, 'n_eff')}",
    "divergent transitions: {divergences}"
  ))

  # Generate z-score density plot, unless the caller has already said it will
  # discard it (#483 section 3).
  z_plot <- if (include_plot) {
    render_z_density_plot(
      yi = yi,
      vi = vi,
      favor_positive = favor_positive,
      alpha_select = alpha_select
    )
  } else {
    NULL
  }

  results <- list(
    mu = mu_est,
    muMedian = mu_median,
    muCI = mu_ci,
    tau = tau_est,
    tauMedian = tau_median,
    tauCI = tau_ci,
    unadjustedMean = unadjusted_mean,
    # The intervals above are equal-tailed posterior quantile intervals at this
    # level (phacking does not compute HPD intervals); echoed back so displays
    # can state the level instead of implying 95%.
    ciLevel = ci_level,
    # The RNG seed the sampler ran under, so the numbers above are traceable to
    # the draw that produced them and can be reproduced exactly (#479).
    seed = seed,
    k = k,
    affirmativeCount = k_affirmative,
    droppedRows = dropped_rows,
    nonaffirmativeCount = k_nonaffirmative,
    nonaffirmativeProportion = nonaffirmative_proportion,
    # I() so the unboxed-JSON serializer keeps this an array even when a single
    # warning was raised; callers can always treat it as a list of strings.
    warnings = I(rtma_warnings),
    # Whether the numbers above can be trusted at all (#480). Appended rather
    # than grouped with the estimates they qualify so the field order every
    # existing caller reads stays exactly as it was. r_hat and n_eff are
    # per-parameter because the sampler can mix well for one and badly for the
    # other, and a single worst-case number would hide which.
    diagnostics = list(
      optimConverged = optim_converged,
      rHat = list(
        mu = diagnostic_value(mu_row, "r_hat"),
        tau = diagnostic_value(tau_row, "r_hat")
      ),
      nEff = list(
        mu = diagnostic_value(mu_row, "n_eff"),
        tau = diagnostic_value(tau_row, "n_eff")
      ),
      divergences = divergences
    )
  )

  if (include_plot) {
    # Spliced in after droppedRows to match the field order this response has
    # always had; list(zScorePlot = NULL, ...) above would keep the keys
    # present with a null value instead of omitting them.
    results <- append(
      results,
      list(
        zScorePlot = z_plot$data_uri,
        zScorePlotWidth = z_plot$width_px,
        zScorePlotHeight = z_plot$height_px
      ),
      after = which(names(results) == "droppedRows")
    )
  }

  results
}
