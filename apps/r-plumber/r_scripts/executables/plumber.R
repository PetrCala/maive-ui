# plumber.R

#* Echo back the input
#* @usage curl --data "a=4&b=3" "http://localhost:8787/sum"
#* @param msg The message to echo
#* @get /echo
function(msg = "") {
  list(msg = paste0("The message is: '", msg, "'"))
}

#* Health check
#* @get /ping
function() {
  list(status = "ok", time = format(Sys.time(), tz = "UTC"))
}
#* Run the model
#* @param file_data The file data to run the model on, passed as a JSON string
#* @param parameters The parameters to run the model on
#* @post /run-model
function(file_data, parameters) {
  tryCatch(
    {
      # nolint start: undesirable_function_linter.
      # MAIVE dependencies
      maive_deps <- c("clubSandwich", "varhandle", "pracma", "sandwich", "metafor")
      lapply(maive_deps, library, character.only = TRUE)
      source("../modules/funnel_plot.R", local = TRUE)
      # nolint end: undesirable_function_linter.

      # Parse JSON data
      df <- jsonlite::fromJSON(file_data)
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

      # Convert column names to lowercase for consistent processing
      colnames(df) <- tolower(colnames(df))

      # Debug: Print processed data frame
      cli::cli_h2("Processed data frame (lowercase columns):")
      cli::cli_code(capture.output(print(head(df)))) # nolint: undesirable_function_linter.

      # MAIVE expects columns in this exact order: bs, sebs, Ns, study_id (optional)
      # Map column names to expected names (after lowercase conversion)
      name_map <- c(
        "effect" = "bs",
        "se" = "sebs",
        "n_obs" = "Ns",
        "ns" = "Ns",
        "study_id" = "study_id"
      )

      # Rename columns using the mapping
      old_names <- names(df)
      matched_old_names <- intersect(old_names, names(name_map))
      names(df)[match(matched_old_names, names(df))] <- name_map[matched_old_names]

      # Debug: Print after renaming
      cli::cli_h2("Data frame after renaming:")
      cli::cli_code(capture.output(print(head(df)))) # nolint: undesirable_function_linter.

      # Ensure we have the required columns in the correct order
      required_cols <- c("bs", "sebs", "Ns")
      missing_cols <- setdiff(required_cols, names(df))

      if (length(missing_cols) > 0) {
        return(list(
          error = TRUE,
          message = paste("Missing required columns:", paste(missing_cols, collapse = ", "))
        ))
      }

      numeric_cols <- c("bs", "sebs", "Ns")
      for (col in numeric_cols) {
        if (col %in% names(df)) {
          df[[col]] <- as.numeric(df[[col]])
        }
      }

      # Reorder columns to match MAIVE expectations: bs, sebs, Ns, study_id
      if ("study_id" %in% names(df)) {
        df <- df[, c("bs", "sebs", "Ns", "study_id"), drop = FALSE]
      } else {
        df <- df[, c("bs", "sebs", "Ns"), drop = FALSE]
      }

      df <- df[rowSums(is.na(df)) != ncol(df), ] # Drop rows with all NAs

      # Debug: Print final data frame
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
        return(list(
          error = TRUE,
          message = paste0("The parameters must include the following: ", paste(expected_parameters, collapse = ", "))
        ))
      }

      model_type <- params$modelType # MAIVE or WAIVE

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
      # Debug: Print the maiveMethod parameter
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
          # nolint start: undesirable_function_linter.
          print(traceback())
          cli::cli_abort(e)
          # nolint end: undesirable_function_linter.
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

      tryCatch(
        {
          is_quadratic_fit <- maive_res$is_quadratic_fit # A custom field added to the maive function
        },
        error = function(e) {
          cli::cli_alert_warning("The is_quadratic_fit field is not available in the maive function. Setting it to TRUE.")
          is_quadratic_fit <- TRUE
        }
      )

      funnel_plot_data <- get_funnel_plot_data(
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
      list(data = results)
    },
    error = function(e) {
      cli::cli_alert_danger("Error in run-model endpoint: {e$message}")
      cli::cli_h2("Error traceback:")
      cli::cli_code(capture.output(traceback()))
      list(
        error = TRUE,
        message = paste("Internal server error:", e$message)
      )
    }
  )
}
