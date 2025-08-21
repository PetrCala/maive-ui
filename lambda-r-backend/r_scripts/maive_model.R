# MAIVE Model Function for Lambda
# Adapted from the original plumber implementation

# nolint start: undesirable_function_linter.
library(clubSandwich)
library(varhandle)
library(pracma)
library(sandwich)
library(metafor)

source("funnel_plot.R")
# nolint end: undesirable_function_linter.

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

  cli::cli_h2("Final data frame for MAIVE:")
  cli::cli_code(capture.output(print(head(df)))) # nolint: undesirable_function_linter.
  cli::cli_text("\n")

  expected_parameters <- c(
    "modelType",
    "includeStudyDummies",
    "includeStudyClustering",
    "standardErrorTreatment",
    "computeAndersonRubin",
    "maiveMethod",
    "shouldUseInstrumenting"
  )

  if (!all(names(params) %in% expected_parameters) || !all(expected_parameters %in% names(params))) {
    cli::cli_abort(paste0("The parameters must include the following: ", paste(expected_parameters, collapse = ", ")))
  }

  model_type <- params$modelType # MAIVE or WAIVE # nolint: object_usage_linter.

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

  maive_method <- switch(params$maiveMethod,
    "PET" = 1,
    "PEESE" = 2,
    "PET-PEESE" = 3,
    "EK" = 4
  )

  # Check if switch returned NULL (no match found)
  if (is.null(maive_method)) {
    cli::cli_abort(paste("Invalid maiveMethod value:", params$maiveMethod))
  }

  cli::cli_alert_info(paste("maive_method result:", maive_method))
  instrument <- if (isTRUE(params$shouldUseInstrumenting)) 1 else 0
  should_use_ar <- if (isTRUE(params$computeAndersonRubin)) 1 else 0

  # Debug: Print MAIVE parameters
  cli::cli_h2("MAIVE parameters:")
  cli::cli_bullets(c(
    "method: {maive_method}",
    "instrument: {instrument}",
    "studylevel: {studylevel}",
    "SE: {standard_error_treatment}",
    "AR: {should_use_ar}"
  ))

  # Debug: Check for NA values before calling MAIVE
  cli::cli_h2("Checking for NA values:")
  cli::cli_bullets(c(
    paste("NA values in bs:", sum(is.na(df$bs))),
    paste("NA values in sebs:", sum(is.na(df$sebs))),
    paste("NA values in Ns:", sum(is.na(df$Ns))),
    paste("\n")
  ))

  # Run the model
  tryCatch(
    {
      maive_res <- MAIVE::maive(
        dat = df,
        method = maive_method,
        weight = 0, # no weights=0 (default), inverse-variance weights=1, adjusted weights=2
        instrument = instrument, # no=0, yes=1 (default)
        studylevel = studylevel,
        SE = standard_error_treatment, # 0 CR0 (Huber-White), 1 CR1 (std. emp. correction), 2 CR2 (bias-reduced est.), 3 wild bootstrap (default)
        AR = should_use_ar # 0 = no AR, 1 = AR (default)
      )
    },
    error = function(e) {
      cli::cli_alert_danger(paste("MAIVE function error:", e$message))
      cli::cli_alert_danger(paste("Error traceback:"))
      print(traceback()) # nolint: undesirable_function_linter.
      cli::cli_abort(e)
    }
  )

  # Debug: Print MAIVE results
  cli::cli_h2("MAIVE results structure:")
  cli::cli_code(capture.output(str(maive_res)))

  est <- maive_res$beta
  se <- maive_res$SE
  est_is_significant <- if (se > 0) est / se >= 1.96 else TRUE

  pub_bias_p_value <- maive_res[["pub bias p-value"]]
  pb_is_significant <- if (pub_bias_p_value < 0.05) TRUE else FALSE


  is_quadratic_fit <- TRUE # initialize with default value
  tryCatch(
    {
      is_quadratic_fit <- maive_res$is_quadratic_fit # A custom field added to the maive function
    },
    error = function(e) {
      cli::cli_alert_warning("The is_quadratic_fit field is not available in the maive function. Setting it to TRUE.")
    }
  )

  funnel_plot_data <- get_funnel_plot_data( # nolint: object_usage_linter.
    effect = df$bs,
    se = df$sebs,
    se_adjusted = maive_res$SE_instrumented,
    intercept = maive_res$beta,
    intercept_se = maive_res$SE,
    is_quaratic_fit = is_quadratic_fit
  )

  results <- list(
    effectEstimate = est,
    standardError = se,
    isSignificant = est_is_significant,
    andersonRubinCI = maive_res$AR_CI, # c(int, int) or "NA"
    publicationBias = list(
      pValue = pub_bias_p_value,
      isSignificant = pb_is_significant
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
    funnelPlotHeight = funnel_plot_data$height_px
  )

  results
}
