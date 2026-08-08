# RTMA (Right-Truncated Meta-Analysis) Model Function
# Uses the phacking package to fit RTMA for p-hacking correction

# nolint start: undesirable_function_linter.
library(phacking)
# nolint end: undesirable_function_linter.

RTMA_PLOT_RES <- 120

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
  # Default FALSE: parallel chains add fork overhead with no speedup, and thrash
  # on the Lambda's sub-1-vCPU allocation. Benchmarks showed no gain even on 8 cores.
  parallelize <- if (!is.null(params$parallelize)) isTRUE(params$parallelize) else FALSE
  # Wall-clock budget kept below the Lambda function timeout so a degenerate
  # dataset returns a clear error instead of being hard-killed mid-request.
  timeout_sec <- if (!is.null(params$timeoutSeconds)) as.numeric(params$timeoutSeconds) else 480

  cli::cli_h2("RTMA parameters:")
  cli::cli_bullets(c(
    "favor_positive: {favor_positive}",
    "alpha_select: {alpha_select}",
    "ci_level: {ci_level}",
    "parallelize: {parallelize}",
    "timeout_sec: {timeout_sec}"
  ))

  # Run RTMA via phacking package, bounded by a wall-clock limit. Pathological
  # datasets can make the sampler's tree depth explode to effectively unbounded
  # runtimes; the limit converts that into a clean failure instead of a hang.
  # The time-limit interrupt fires inside phacking, which re-throws it as an
  # opaque message, so timeout is detected by elapsed time rather than message.
  #
  # phacking_meta() also signals conditions the caller must see, above all
  # "Favored direction is opposite of the pooled estimate.", which means the fit
  # truncated nothing and the returned mu is effectively uncorrected. tryCatch
  # only handles errors, so warnings are collected here and returned in the
  # response instead of being dropped on the floor.
  rtma_warnings <- character(0)
  start_time <- Sys.time()
  setTimeLimit(elapsed = timeout_sec, transient = TRUE)
  rtma_res <- tryCatch(
    withCallingHandlers(
      phacking::phacking_meta(
        yi = yi,
        vi = vi,
        favor_positive = favor_positive,
        alpha_select = alpha_select,
        ci_level = ci_level,
        parallelize = parallelize
      ),
      warning = function(w) {
        rtma_warnings <<- c(rtma_warnings, conditionMessage(w))
        invokeRestart("muffleWarning")
      }
    ),
    error = function(e) {
      setTimeLimit() # clear so error reporting is not itself interrupted
      elapsed <- as.numeric(difftime(Sys.time(), start_time, units = "secs"))
      err_message <- conditionMessage(e)
      if (elapsed >= timeout_sec * 0.95 ||
        grepl("elapsed time limit", err_message, fixed = TRUE)) {
        cli::cli_abort(c(
          "RTMA timed out after {timeout_sec} seconds.",
          "i" = "This dataset makes the sampler diverge. Try winsorizing outliers or reducing the number of estimates."
        ))
      }
      cli::cli_alert_danger(paste("RTMA error:", err_message))
      cli::cli_abort(paste("RTMA analysis failed:", err_message))
    }
  )
  setTimeLimit() # clear the limit for the rest of the request (plot, response)

  cli::cli_h2("RTMA results structure:")
  cli::cli_code(capture.output(str(rtma_res, max.level = 2)))

  # Extract mu and tau from $stats tibble
  # $stats has columns: param, mode, median, mean, se, ci_lower, ci_upper, ...
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
    "dropped rows: {dropped_rows}"
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
    k = k,
    affirmativeCount = k_affirmative,
    droppedRows = dropped_rows,
    nonaffirmativeCount = k_nonaffirmative,
    nonaffirmativeProportion = nonaffirmative_proportion,
    # I() so the unboxed-JSON serializer keeps this an array even when a single
    # warning was raised; callers can always treat it as a list of strings.
    warnings = I(rtma_warnings)
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
