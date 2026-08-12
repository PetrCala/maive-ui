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
# every RTMA fixture in the e2e suite (all fits under 8 seconds). The treedepth
# cap below bounds how much an unlucky (dataset, seed) pair can cost, and the
# wall-clock limit is the backstop behind that.
RTMA_DEFAULT_SEED <- 2025L

# Stan sampler settings passed to phacking_meta()'s stan_control argument.
#
# adapt_delta restates phacking's own default: stan_control replaces the whole
# default list rather than merging into it, and letting adapt_delta fall back
# to Stan's 0.8 would change every pinned result in the app.
#
# max_treedepth 12 caps one NUTS iteration at 2^12 = 4096 leapfrog steps
# against phacking's default 2^20. On well-identified data no trajectory gets
# near either bound, so the draws are bit-identical to the default (verified
# per fixture in docs/RTMA_PERFORMANCE.md, section 6, and re-verified against
# this entry point on the e2e fixture, a sign-mirrored variant, and n = 300).
# On weakly identified data the posterior grows a heavy flat shelf and some
# trajectories do hit the cap, so draw-dependent outputs (median, credible
# interval, r_hat, n_eff, divergence counts) move within the seed-to-seed
# noise those fits already have; the mode, a separate deterministic
# optimisation, does not move (verified on the Meissner demo: mode identical
# to 15 digits, mu CI upper bound shifts 4.87 to 4.72 against a seed spread
# measured in whole units). The payoff is the tail: a chain that wanders onto
# the shelf saturates whatever depth is allowed, and at depth 20 that means
# minutes per iteration, which is where the multi-minute RTMA grinds and
# Lambda timeouts came from. At depth 12 those same fits either finish and
# recover (r_hat near 1) or come back in seconds with r_hat far above 1 plus
# divergences, which the diagnostics block in the response already surfaces
# (#480). Depth 10 was measured to break otherwise-recoverable fits, so 12 is
# the validated floor, not an arbitrary round number.
RTMA_STAN_ADAPT_DELTA <- 0.98
RTMA_STAN_MAX_TREEDEPTH <- 12L

# Upper bound on sampling cores: rstan runs 4 chains by default and forks at
# most one worker per chain, so nothing above this can be used.
RTMA_MAX_SAMPLING_CORES <- 4L

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

#' List the live descendants of a process
#'
#' Reads the pid -> ppid table from /proc on Linux (always present in the
#' Lambda container) or from ps elsewhere (macOS, where local dev and the e2e
#' suite run), then walks it transitively from `pid`. Processes that exit
#' between the directory listing and the read are skipped.
#'
#' @param pid Root process id
#' @return Integer vector of descendant pids, possibly empty
rtma_process_descendants <- function(pid) {
  table <- tryCatch(
    {
      if (dir.exists("/proc")) {
        pids <- list.files("/proc", pattern = "^[0-9]+$")
        ppids <- vapply(pids, function(p) {
          status <- tryCatch(
            readLines(file.path("/proc", p, "status"), warn = FALSE),
            error = function(e) character(0)
          )
          line <- grep("^PPid:", status, value = TRUE)
          if (length(line) == 1) as.integer(sub("^PPid:\\s*", "", line)) else NA_integer_
        }, integer(1))
        data.frame(pid = as.integer(pids), ppid = ppids)
      } else {
        lines <- suppressWarnings(
          system2("ps", c("-Ao", "pid=,ppid="), stdout = TRUE, stderr = FALSE)
        )
        fields <- strsplit(trimws(lines), "\\s+")
        fields <- fields[lengths(fields) == 2]
        data.frame(
          pid = as.integer(vapply(fields, `[[`, "", 1)),
          ppid = as.integer(vapply(fields, `[[`, "", 2))
        )
      }
    },
    error = function(e) NULL
  )
  if (is.null(table) || nrow(table) == 0) {
    return(integer(0))
  }
  table <- table[!is.na(table$pid) & !is.na(table$ppid), ]
  found <- integer(0)
  frontier <- as.integer(pid)
  repeat {
    kids <- setdiff(table$pid[table$ppid %in% frontier], c(found, as.integer(pid)))
    if (length(kids) == 0) {
      return(found)
    }
    found <- c(found, kids)
    frontier <- kids
  }
}

#' Kill a fit child and every Stan worker it forked
#'
#' Killing just the child is not enough: with mc.cores > 1 it forks up to
#' RTMA_MAX_SAMPLING_CORES workers, SIGKILL skips R's mc.cleanup, and an
#' orphaned worker mid-grind keeps burning the container's CPU with no parent
#' left to stop it. So enumerate the tree while the child is still alive (once
#' it is dead its orphans reparent to init and can no longer be found by a
#' ppid walk), then SIGKILL the whole snapshot, and rescan a few times in case
#' a fork raced the scan. In practice workers fork once at sampling start and
#' the first pass is complete.
#'
#' @param pid Process id of the fit child
#' @return NULL, invisibly
rtma_kill_fit_tree <- function(pid) {
  pid <- as.integer(pid)
  for (attempt in seq_len(5L)) {
    targets <- c(rtma_process_descendants(pid), pid)
    alive <- targets[vapply(
      targets,
      function(p) isTRUE(tools::pskill(p, 0L)),
      logical(1)
    )]
    if (length(alive) == 0) {
      return(invisible(NULL))
    }
    for (p in alive) {
      tools::pskill(p, tools::SIGKILL)
    }
    Sys.sleep(0.05)
  }
  invisible(NULL)
}

#' Run the RTMA fit under a wall-clock budget that is actually enforced
#'
#' setTimeLimit cannot do this job. R checks elapsed limits only at R-level
#' interrupt points; a grinding Stan chain does not return to R until it
#' finishes, and with forked chains the parent blocks in the worker-collect
#' loop instead, which is no better: measured overshoot was minutes past a
#' 15 second budget either way (docs/RTMA_PERFORMANCE.md, section 4). So on
#' unix the fit runs in a forked child that this process can kill: poll for
#' the result, and at the deadline kill the child plus its Stan workers and
#' raise the timeout error the contract documents, as a classed condition so
#' the caller can tell it from a fit failure.
#'
#' Warnings raised inside the child (phacking's direction warning, rstan's
#' convergence warnings) do not cross the process boundary on their own, so
#' fit_call collects them and ships them back next to the fit.
#'
#' On Windows, where R cannot fork, the fit runs in-process under setTimeLimit
#' with the old elapsed-time heuristic: a best-effort budget on a dev-only
#' platform.
#'
#' @param fit_call Zero-argument function that runs the fit and returns
#'   list(fit = <phacking fit>, warnings = <character vector>)
#' @param timeout_sec Wall-clock budget in seconds
#' @return fit_call's return value
run_rtma_fit_bounded <- function(fit_call, timeout_sec) {
  raise_timeout <- function() {
    cli::cli_abort(
      c(
        "RTMA timed out after {timeout_sec} seconds.",
        "i" = "The run exceeded its time budget before finishing; this does not necessarily mean it diverged. Try winsorizing outliers or reducing the number of estimates."
      ),
      class = "rtma_timeout_error"
    )
  }

  if (.Platform$OS.type != "unix") {
    start_time <- Sys.time()
    setTimeLimit(elapsed = timeout_sec, transient = TRUE)
    on.exit(setTimeLimit(), add = TRUE)
    return(tryCatch(
      fit_call(),
      error = function(e) {
        setTimeLimit() # clear so error reporting is not itself interrupted
        elapsed <- as.numeric(difftime(Sys.time(), start_time, units = "secs"))
        if (elapsed >= timeout_sec * 0.95 ||
          grepl("elapsed time limit", conditionMessage(e), fixed = TRUE)) {
          raise_timeout()
        }
        stop(e)
      }
    ))
  }

  job <- parallel::mcparallel(fit_call())
  deadline <- Sys.time() + timeout_sec
  collected <- NULL
  repeat {
    remaining <- as.numeric(difftime(deadline, Sys.time(), units = "secs"))
    if (remaining <= 0) {
      break
    }
    # Wait in slices of at most a second so the deadline is honoured to about
    # that resolution regardless of how long the fit runs.
    collected <- parallel::mccollect(job, wait = FALSE, timeout = min(1, remaining))
    if (!is.null(collected)) {
      break
    }
  }

  if (is.null(collected)) {
    rtma_kill_fit_tree(job$pid)
    # Reap the killed child so it does not linger as a zombie for the life of
    # the container. mccollect warns that the job delivered no result, which
    # is exactly what a kill looks like, so the warning carries no information.
    suppressWarnings(
      tryCatch(
        parallel::mccollect(job, wait = FALSE, timeout = 1),
        error = function(e) NULL
      )
    )
    raise_timeout()
  }

  out <- collected[[1]]
  if (inherits(out, "try-error")) {
    # The child's own error, forwarded by mccollect. Re-raise the original
    # condition so the message reaches the caller exactly as phacking wrote it.
    condition <- attr(out, "condition")
    if (!is.null(condition)) {
      stop(condition)
    }
    # "{err_text}" keeps cli from glue-interpolating the child's message.
    err_text <- as.character(out)
    cli::cli_abort("{err_text}")
  }
  if (is.null(out)) {
    # Exited without a result or an error: killed from outside the request,
    # e.g. by the kernel OOM killer. Named explicitly because unlike a timeout
    # it is not fixable by shrinking the dataset's runtime.
    cli::cli_abort("The RTMA fit process died before returning a result.")
  }
  out
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
#' @return A list of RTMA results
run_rtma_model <- function(data, parameters, include_plot = TRUE) {
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
  # Wall-clock budget kept below the Lambda function timeout so a degenerate
  # dataset returns a clear error instead of being hard-killed mid-request.
  # Validated like cores above: the legacy route hands parameters through
  # unfiltered, and run_rtma_fit_bounded() needs a real positive number.
  timeout_sec <- if (!is.null(params$timeoutSeconds)) {
    suppressWarnings(as.numeric(params$timeoutSeconds))
  } else {
    480
  }
  if (length(timeout_sec) != 1 || !is.finite(timeout_sec) || timeout_sec <= 0) {
    cli::cli_abort("The timeoutSeconds parameter must be a positive number.")
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
    "timeout_sec: {timeout_sec}"
  ))

  # Run RTMA via phacking package inside run_rtma_fit_bounded(), which is what
  # enforces timeout_sec: pathological datasets can make the sampler's tree
  # depth explode, and RTMA_STAN_MAX_TREEDEPTH above bounds how bad one
  # iteration can get while the fork supervision bounds the fit as a whole.
  #
  # phacking_meta() also signals conditions the caller must see, above all
  # "Favored direction is opposite of the pooled estimate.", which means the fit
  # truncated nothing and the returned mu is effectively uncorrected. tryCatch
  # only handles errors, so the fit closure collects warnings and returns them
  # next to the fit; on unix they are raised in the fit child and would not
  # reach this process any other way.

  # rstan takes its chain count from mc.cores, so set it here rather than
  # passing parallelize = TRUE: that flag makes phacking call
  # `options(mc.cores = parallel::detectCores())`, which reads the host's core
  # count instead of the Lambda's allocation. The fit child inherits the option
  # through the fork. Restored afterwards so a request cannot leave the option
  # changed for the next one in the same container.
  previous_mc_cores <- getOption("mc.cores")
  on.exit(options(mc.cores = previous_mc_cores), add = TRUE)
  options(mc.cores = cores)

  rtma_fit_call <- function() {
    fit_warnings <- character(0)
    fit <- withCallingHandlers(
      {
        # Seeded here rather than at the top of the function: nothing between
        # this line and phacking_meta() touches the RNG, so this is exactly the
        # state the sampler starts from, whether this closure runs in the fit
        # child (unix) or in-process (the Windows fallback). The seed also
        # fixes rstan's own seed, which it draws from this RNG, so each chain's
        # stream is determined by its chain id alone; running the chains on 1
        # core or 4 gives bit-identical draws (verified in #483).
        set.seed(seed)
        phacking::phacking_meta(
          yi = yi,
          vi = vi,
          favor_positive = favor_positive,
          alpha_select = alpha_select,
          ci_level = ci_level,
          stan_control = list(
            adapt_delta = RTMA_STAN_ADAPT_DELTA,
            max_treedepth = RTMA_STAN_MAX_TREEDEPTH
          ),
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

  fit_out <- tryCatch(
    run_rtma_fit_bounded(rtma_fit_call, timeout_sec),
    error = function(e) {
      # The bounded runner's timeout already carries the documented user-facing
      # message; re-raise it untouched. The inherits() check must live inside
      # this one handler: a handler is disestablished while it runs, so its own
      # stop() propagates outward, whereas a separate classed handler's
      # re-raise is caught by this sibling and wrapped after all.
      if (inherits(e, "rtma_timeout_error")) {
        stop(e)
      }
      err_message <- conditionMessage(e)
      cli::cli_alert_danger(paste("RTMA error:", err_message))
      cli::cli_abort(paste("RTMA analysis failed:", err_message))
    }
  )
  rtma_res <- fit_out$fit
  rtma_warnings <- fit_out$warnings

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
