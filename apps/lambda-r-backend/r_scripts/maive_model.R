# MAIVE Model Function for Lambda
# Adapted from the original plumber implementation

# nolint start: undesirable_function_linter.
library(clubSandwich)
library(metafor)

source("funnel_plot.R")
# nolint end: undesirable_function_linter.

winsorize_percent <- function(x, percent) {
  idx <- !is.na(x)
  n <- sum(idx)

  if (
    !is.numeric(percent) || length(percent) != 1 || is.na(percent) || percent <= 0
  ) {
    return(list(
      values = x,
      bounds = c(NA_real_, NA_real_),
      clipped = c(0L, 0L)
    ))
  }

  if (n <= 1) {
    return(list(
      values = x,
      bounds = c(NA_real_, NA_real_),
      clipped = c(0L, 0L)
    ))
  }

  k <- max(1L, floor((percent / 100) * n))

  if (k >= n) {
    return(list(
      values = x,
      bounds = c(NA_real_, NA_real_),
      clipped = c(0L, 0L)
    ))
  }

  probs <- sort(c(k / n, 1 - k / n))
  qs <- as.numeric(stats::quantile(x[idx], probs = probs, type = 7, names = FALSE))

  if (length(qs) == 1) {
    qs <- rep(qs, 2)
  }

  y <- x
  lower_mask <- idx & x < qs[1]
  upper_mask <- idx & x > qs[2]
  y[lower_mask] <- qs[1]
  y[upper_mask] <- qs[2]

  list(
    values = y,
    bounds = qs,
    clipped = c(sum(lower_mask), sum(upper_mask))
  )
}

# Main MAIVE model function
run_maive_model <- function(data, parameters) {
  # Static config
  SHOULD_PRINT_DF_AFTER_RENAME <- FALSE

  # Parse JSON data
  df <- jsonlite::fromJSON(data)
  params <- jsonlite::fromJSON(parameters)

  # Debug: Print input data
  cli::cli_h2("Input data frame structure:")
  cli::cli_code(capture.output(str(df)))
  cli::cli_h2("Input parameters:")
  cli::cli_code(capture.output(print(params))) # nolint: undesirable_function_linter.

  # Convert to data frame if it's not already
  if (!is.data.frame(df)) {
    df <- as.data.frame(df)
  }

  # Debug: Print original data frame
  cli::cli_h2("Original data frame:")
  cli::cli_code(capture.output(print(head(df)))) # nolint: undesirable_function_linter.

  if (nrow(df) < 4) {
    cli::cli_abort("Input data must have at least 4 observations.")
  }

  n_cols <- ncol(df)
  if (n_cols < 3 || n_cols > 4) {
    cli::cli_abort(paste("Data must have exactly 3 or 4 columns. Found", n_cols, "columns."))
  }

  # Create new column names based on position
  new_colnames <- c("bs", "sebs", "Ns")
  if (n_cols == 4) {
    new_colnames <- c(new_colnames, "study_id")
  }

  # Rename columns by position
  colnames(df) <- new_colnames

  if (SHOULD_PRINT_DF_AFTER_RENAME) {
    cli::cli_h2("Data frame after renaming by position:")
    cli::cli_code(capture.output(print(head(df)))) # nolint: undesirable_function_linter.
  }

  numeric_cols <- c("bs", "sebs", "Ns")
  for (col in numeric_cols) {
    if (col %in% names(df)) {
      df[[col]] <- as.numeric(df[[col]])
    }
  }

  df <- df[rowSums(is.na(df)) != ncol(df), ]

  winsorize_pct <- suppressWarnings(as.numeric(params$winsorize))
  if (length(winsorize_pct) == 1 && !is.na(winsorize_pct) && winsorize_pct > 0) {
    winsorize_pct_text <- if (abs(winsorize_pct - round(winsorize_pct)) < .Machine$double.eps) {
      sprintf("%.0f", winsorize_pct)
    } else {
      sprintf("%.1f", winsorize_pct)
    }

    cli::cli_alert_info(
      sprintf(
        "Applying %s%% winsorization to effect sizes and standard errors",
        winsorize_pct_text
      )
    )
    bs_winsor <- winsorize_percent(df$bs, winsorize_pct)
    se_winsor <- winsorize_percent(df$sebs, winsorize_pct)

    df$bs <- bs_winsor$values
    df$sebs <- se_winsor$values

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
        format_bounds(bs_winsor$bounds),
        bs_winsor$clipped[1],
        bs_winsor$clipped[2]
      ),
      sprintf(
        "Standard errors clipped to %s (%d lower, %d upper replacements).",
        format_bounds(se_winsor$bounds),
        se_winsor$clipped[1],
        se_winsor$clipped[2]
      )
    ))
  }

  expected_parameters <- c(
    "modelType",
    "includeStudyDummies",
    "includeStudyClustering",
    "standardErrorTreatment",
    "computeAndersonRubin",
    "maiveMethod",
    "weight",
    "shouldUseInstrumenting",
    "useLogFirstStage",
    "winsorize"
  )

  if (!all(names(params) %in% expected_parameters) || !all(expected_parameters %in% names(params))) {
    cli::cli_abort(paste0("The parameters must include the following: ", paste(expected_parameters, collapse = ", ")))
  }

  model_type <- params$modelType # MAIVE or WAIVE # nolint: object_usage_linter.
  model_label <- toupper(model_type)
  is_waive <- identical(model_type, "WAIVE")

  cli::cli_h2(sprintf("Final data frame for %s:", model_label))
  cli::cli_code(capture.output(print(head(df)))) # nolint: undesirable_function_linter.
  cli::cli_text("\n")

  study_dummies <- if (isTRUE(params$includeStudyDummies)) 1 else 0
  study_clustering <- if (isTRUE(params$includeStudyClustering)) 1 else 0
  studylevel <- if (study_clustering == 1) {
    if (study_dummies == 1) 3 else 2
  } else {
    if (study_dummies == 1) 1 else 0
  }

  if ("study_id" %in% names(df)) {
    # We need at least 3 DoF for distribution functions - otherwise qt() will return NA
    if (!(nrow(df) >= length(unique(df$study_id)) + 3)) {
      cli::cli_abort("The number of rows must be larger than the number of unique study_id plus 3.")
    }
  } else {
    # If no study_id column, force studylevel to 0 (no study-level effects)
    studylevel <- 0
    cli::cli_alert_warning("No study_id column found, forcing studylevel to 0")
  }

  cli::cli_alert_info(paste("standardErrorTreatment parameter:", params$standardErrorTreatment))

  standard_error_treatment <- switch(params$standardErrorTreatment,
    "not_clustered" = 0,
    "clustered" = 1,
    "clustered_cr2" = 2,
    "bootstrap" = 3
  )

  # Check if switch returned NULL (no match found)
  if (is.null(standard_error_treatment)) {
    cli::cli_abort(paste("Invalid standardErrorTreatment value:", params$standardErrorTreatment))
  }

  cli::cli_alert_info(paste("standard_error_treatment result:", standard_error_treatment))
  cli::cli_alert_info(paste("maiveMethod parameter:", params$maiveMethod))
  cli::cli_alert_info(paste("weight parameter:", params$weight))

  maive_method <- switch(params$maiveMethod,
    "PET" = 1,
    "PEESE" = 2,
    "PET-PEESE" = 3,
    "EK" = 4
  )
  weight <- switch(params$weight,
    "equal_weights" = 0,
    "standard_weights" = 1,
    "adjusted_weights" = 2,
    "study_weights" = 3
  )

  # Check if switch returned NULL (no match found)
  if (is.null(maive_method)) {
    cli::cli_abort(paste("Invalid maiveMethod value:", params$maiveMethod))
  }

  if (is.null(weight)) {
    cli::cli_abort(paste("Invalid weight value:", params$weight))
  }

  cli::cli_alert_info(paste("maive_method result:", maive_method))
  instrument <- if (is_waive || isTRUE(params$shouldUseInstrumenting)) 1 else 0
  should_use_ar <- if (isTRUE(params$computeAndersonRubin)) 1 else 0
  log_first_stage <- isTRUE(params$useLogFirstStage)

  # Debug: Print model parameters
  cli::cli_h2(sprintf("%s parameters:", model_label))
  cli::cli_bullets(c(
    "method: {maive_method}",
    "weight: {weight}",
    "instrument: {instrument}",
    "studylevel: {studylevel}",
    "SE: {standard_error_treatment}",
    "AR: {should_use_ar}",
    "log first stage: {log_first_stage}"
  ))

  # Debug: Check for NA values before calling maive
  cli::cli_h2("Checking for NA values:")
  cli::cli_bullets(c(
    paste("NA values in bs:", sum(is.na(df$bs))),
    paste("NA values in sebs:", sum(is.na(df$sebs))),
    paste("NA values in Ns:", sum(is.na(df$Ns))),
    paste("\n")
  ))

  # Run the model
  if (instrument == 0 && log_first_stage) {
    cli::cli_alert_warning(
      "Log first stage was requested but instrumenting is disabled; reverting to levels first stage.",
    )
    log_first_stage <- FALSE
  }

  maive_args <- list(
    dat = df,
    method = maive_method,
    weight = weight, # equal weights=0 (default), standard weights=1, adjusted weights=2, study weights=3
    instrument = instrument, # no=0, yes=1 (default)
    studylevel = studylevel,
    SE = standard_error_treatment, # 0 CR0 (Huber-White), 1 CR1 (std. emp. correction), 2 CR2 (bias-reduced est.), 3 wild bootstrap (default)
    AR = should_use_ar # 0 = no AR, 1 = AR (default)
  )

  target_function <- if (is_waive) MAIVE::waive else MAIVE::maive
  maive_formals <- names(formals(target_function))
  if (instrument == 1) {
    if ("log_first_stage" %in% maive_formals) {
      maive_args$log_first_stage <- log_first_stage
    } else if ("first_stage" %in% maive_formals) {
      maive_args$first_stage <- if (log_first_stage) "log" else "levels"
    }
  }

  tryCatch(
    {
      maive_res <- do.call(target_function, maive_args)
    },
    error = function(e) {
      err_message <- conditionMessage(e)
      cli::cli_alert_danger(paste(model_label, "function error:", err_message))
      cli::cli_alert_danger(paste("Error traceback:"))
      print(traceback()) # nolint: undesirable_function_linter.
      cli::cli_abort(err_message)
    }
  )

  if (instrument == 1 && isTRUE(log_first_stage) && !is.null(maive_res$SE_instrumented)) {
    invalid_idx <- which(!is.na(maive_res$SE_instrumented) & maive_res$SE_instrumented <= 0)
    if (length(invalid_idx) > 0) {
      cli::cli_alert_warning(
        sprintf(
          "Adjusting %d non-positive fitted variances after log first-stage; enforcing minimum positive value.",
          length(invalid_idx)
        )
      )
      maive_res$SE_instrumented[invalid_idx] <- .Machine$double.eps
    }
  }

  # Debug: Print model results
  cli::cli_h2(sprintf("%s results structure:", model_label))
  cli::cli_code(capture.output(str(maive_res)))

  est <- maive_res$beta
  se <- maive_res$SE
  est_is_significant <- if (se > 0) abs(est / se) >= 1.96 else TRUE

  pub_bias_p_value <- maive_res[["pub bias p-value"]]
  pb_is_significant <- if (pub_bias_p_value < 0.05) TRUE else FALSE


  parse_slope_metadata <- function(res) {
    slope_summary <- if ("is_quadratic_fit" %in% names(res)) res$is_quadratic_fit else NULL
    slope_coef <- if ("slope_coef" %in% names(res)) res$slope_coef else NULL

    metadata <- list(
      quadratic = FALSE,
      type = NULL,
      coefficient = slope_coef,
      detail = NULL
    )

    if (is.list(slope_summary)) {
      metadata$quadratic <- isTRUE(slope_summary$quadratic)

      slope_type <- NULL
      if (!is.null(slope_summary$slope_type)) {
        slope_type <- slope_summary$slope_type
      } else if (!is.null(slope_summary$type)) {
        slope_type <- slope_summary$type
      }
      if (!is.null(slope_type)) {
        metadata$type <- slope_type
      }

      if (!is.null(slope_summary$slope_detail)) {
        metadata$detail <- slope_summary$slope_detail
      } else if (!is.null(slope_summary$detail)) {
        metadata$detail <- slope_summary$detail
      }

      if (!is.null(slope_summary$coefficient) && is.null(metadata$coefficient)) {
        metadata$coefficient <- slope_summary$coefficient
      }
    } else if (is.logical(slope_summary) && length(slope_summary) == 1) {
      metadata$quadratic <- isTRUE(slope_summary)
    } else if (!is.null(slope_summary)) {
      metadata$quadratic <- isTRUE(slope_summary)
    }

    if (is.null(metadata$type)) {
      metadata$type <- if (isTRUE(metadata$quadratic)) "quadratic" else "linear"
    }

    metadata
  }

  slope_metadata <- parse_slope_metadata(maive_res)

  parse_boot_result <- function(boot_result, field) if (is.null(boot_result)) "NA" else boot_result[[field]]
  format_ci_field <- function(ci_field) {
    if (is.null(ci_field)) {
      return("NA")
    }

    ci_values <- if (is.list(ci_field)) unlist(ci_field) else ci_field

    if (length(ci_values) == 0) {
      return("NA")
    }

    if (is.character(ci_values) && length(ci_values) == 1 && ci_values == "NA") {
      return("NA")
    }

    if (all(is.na(ci_values))) {
      return("NA")
    }

    ci_field
  }
  boot_se <- parse_boot_result(maive_res$boot_result, "boot_se") # [a, b]
  boot_ci <- parse_boot_result(maive_res$boot_result, "boot_ci") # [[a, b], [c, d]]
  egger_boot_ci <- format_ci_field(maive_res$egger_boot_ci)
  egger_ar_ci <- format_ci_field(maive_res$egger_ar_ci)

  se_adjusted_for_plot <- if (instrument == 0) NULL else maive_res$SE_instrumented

  first_stage_mode <- if (instrument == 1 && isTRUE(log_first_stage)) "log" else "levels"
  first_stage_description <- if (first_stage_mode == "log") {
    "log(SE^2) ~ log N; Duan smearing applied"
  } else {
    "SE^2 ~ 1/N"
  }
  first_stage_label <- if (first_stage_mode == "log") {
    "First-Stage F-Test (<U+03B3><U+2081>)"
  } else {
    "First-Stage F-Test"
  }

  funnel_plot_data <- get_funnel_plot_data( # nolint: object_usage_linter.
    effect = df$bs,
    se = df$sebs,
    se_adjusted = se_adjusted_for_plot,
    intercept = maive_res$beta,
    intercept_se = maive_res$SE,
    slope = slope_metadata,
    instrument = instrument,
    model_type = model_type
  )

  results <- list(
    effectEstimate = est,
    standardError = se,
    isSignificant = est_is_significant,
    andersonRubinCI = maive_res$AR_CI, # c(int, int) or "NA"
    publicationBias = list(
      pValue = pub_bias_p_value,
      eggerCoef = maive_res$egger_coef,
      eggerSE = maive_res$egger_se,
      isSignificant = pb_is_significant,
      eggerBootCI = egger_boot_ci,
      eggerAndersonRubinCI = egger_ar_ci
    ),
    firstStageFTest = maive_res[["F-test"]],
    hausmanTest = list(
      statistic = maive_res$Hausman,
      criticalValue = maive_res$Chi2,
      rejectsNull = maive_res$Hausman >= maive_res$Chi2
    ),
    seInstrumented = maive_res$SE_instrumented,
    funnelPlot = funnel_plot_data$data_uri,
    funnelPlotWidth = funnel_plot_data$width_px,
    funnelPlotHeight = funnel_plot_data$height_px,
    bootSE = boot_se,
    bootCI = boot_ci,
    firstStage = if (instrument == 1) {
      list(
        mode = first_stage_mode,
        description = first_stage_description,
        fStatisticLabel = first_stage_label
      )
    } else {
      NULL
    }
  )

  results
}
