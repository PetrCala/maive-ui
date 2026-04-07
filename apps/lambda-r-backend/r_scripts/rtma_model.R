# RTMA (Right-Truncated Meta-Analysis) Model Function
# Uses the phacking package to fit RTMA for p-hacking correction

# nolint start: undesirable_function_linter.
library(phacking)
# nolint end: undesirable_function_linter.

RTMA_PLOT_RES <- 120

#' Render a z-score density plot and return it as a base64-encoded PNG data URI
#'
#' @param yi Numeric vector of point estimates
#' @param vi Numeric vector of estimated variances
#' @param alpha_select Significance threshold (default 0.05)
#' @param res Plot resolution in pixels per inch
#' @return A list with data_uri, width_px, height_px
render_z_density_plot <- function(yi, vi, alpha_select = 0.05, res = RTMA_PLOT_RES) {
  width_px <- res * 7
  height_px <- res * 7

  tmp <- tempfile(fileext = ".png")
  ragg::agg_png(tmp, width = width_px, height = height_px, res = res)
  p <- phacking::z_density(yi = yi, vi = vi, alpha_select = alpha_select)
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
#' @return A list of RTMA results
run_rtma_model <- function(data, parameters) {
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
  parallelize <- if (!is.null(params$parallelize)) isTRUE(params$parallelize) else TRUE

  cli::cli_h2("RTMA parameters:")
  cli::cli_bullets(c(
    "favor_positive: {favor_positive}",
    "alpha_select: {alpha_select}",
    "ci_level: {ci_level}",
    "parallelize: {parallelize}"
  ))

  # Run RTMA via phacking package
  tryCatch(
    {
      rtma_res <- phacking::phacking_meta(
        yi = yi,
        vi = vi,
        favor_positive = favor_positive,
        alpha_select = alpha_select,
        ci_level = ci_level,
        parallelize = parallelize
      )
    },
    error = function(e) {
      err_message <- conditionMessage(e)
      cli::cli_alert_danger(paste("RTMA error:", err_message))
      cli::cli_abort(paste("RTMA analysis failed:", err_message))
    }
  )

  cli::cli_h2("RTMA results structure:")
  cli::cli_code(capture.output(str(rtma_res, max.level = 2)))

  # Extract mu and tau from $stats tibble
  # $stats has columns: param, mode, median, mean, se, ci_lower, ci_upper, ...
  stats <- rtma_res$stats
  mu_row <- stats[stats$param == "mu", ]
  tau_row <- stats[stats$param == "tau", ]

  mu_est <- mu_row$mode
  mu_ci <- c(mu_row$ci_lower, mu_row$ci_upper)
  tau_est <- tau_row$mode
  tau_ci <- c(tau_row$ci_lower, tau_row$ci_upper)

  # Nonaffirmative (insignificant) estimates
  k <- rtma_res$values$k
  k_nonaffirmative <- rtma_res$values$k_nonaffirmative
  nonaffirmative_proportion <- if (k > 0) k_nonaffirmative / k else NA_real_

  cli::cli_h2("RTMA summary:")
  cli::cli_bullets(c(
    "mu (mode): {round(mu_est, 4)}",
    "mu CI: [{round(mu_ci[1], 4)}, {round(mu_ci[2], 4)}]",
    "tau (mode): {round(tau_est, 4)}",
    "tau CI: [{round(tau_ci[1], 4)}, {round(tau_ci[2], 4)}]",
    "k_nonaffirmative: {k_nonaffirmative} / {k} ({round(nonaffirmative_proportion * 100, 1)}%)"
  ))

  # Generate z-score density plot
  z_plot <- render_z_density_plot(
    yi = yi,
    vi = vi,
    alpha_select = alpha_select
  )

  results <- list(
    mu = mu_est,
    muCI = mu_ci,
    tau = tau_est,
    tauCI = tau_ci,
    zScorePlot = z_plot$data_uri,
    zScorePlotWidth = z_plot$width_px,
    zScorePlotHeight = z_plot$height_px,
    nonaffirmativeCount = k_nonaffirmative,
    nonaffirmativeProportion = nonaffirmative_proportion
  )

  results
}
