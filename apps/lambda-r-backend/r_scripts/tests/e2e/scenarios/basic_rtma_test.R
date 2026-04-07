# Basic RTMA Test Scenario

#' Test basic RTMA functionality
#' @return Test results
test_basic_rtma <- function() {
  test_name <- "Basic RTMA Test"

  tryCatch(
    {
      # Generate test data (only need yi and se columns)
      test_data <- generate_test_data(
        n_studies = 25,
        include_study_id = FALSE
      )

      # RTMA parameters
      params <- list(
        modelType = "RTMA",
        favorPositive = TRUE,
        alphaSelect = 0.05,
        ciLevel = 0.95,
        winsorize = 0
      )

      # Convert to JSON
      file_data_json <- df_to_json(test_data)
      params_json <- params_to_json(params)

      # Call RTMA API
      cat("Running basic RTMA test...\n")
      response <- test_run_rtma(
        file_data_json,
        params_json
      )

      # Validate response has data field
      if (!is.list(response) || is.null(response$data)) {
        stop("Response should contain a 'data' field")
      }

      results <- response$data

      # Validate RTMA result fields
      rtma_fields <- c(
        "mu", "muCI", "tau", "tauCI",
        "zScorePlot", "zScorePlotWidth",
        "zScorePlotHeight",
        "nonaffirmativeCount",
        "nonaffirmativeProportion"
      )

      missing <- setdiff(
        rtma_fields,
        names(results)
      )
      if (length(missing) > 0) {
        stop(paste(
          "Missing RTMA fields:",
          paste(missing, collapse = ", ")
        ))
      }

      # Check mu is numeric
      if (!is.numeric(results$mu)) {
        stop("mu should be numeric")
      }

      # Check tau is numeric and non-negative
      if (!is.numeric(results$tau) || results$tau < 0) {
        stop("tau should be non-negative numeric")
      }

      # Check muCI is a pair
      if (length(results$muCI) != 2) {
        stop("muCI should have 2 elements")
      }

      # Check tauCI is a pair
      if (length(results$tauCI) != 2) {
        stop("tauCI should have 2 elements")
      }

      # Check z-score plot was generated
      if (
        is.null(results$zScorePlot) ||
          results$zScorePlot == ""
      ) {
        stop("Z-score plot should be generated")
      }

      # Check nonaffirmative stats
      if (results$nonaffirmativeCount < 0) {
        stop("nonaffirmativeCount should be >= 0")
      }
      if (
        results$nonaffirmativeProportion < 0 ||
          results$nonaffirmativeProportion > 1
      ) {
        stop(
          "nonaffirmativeProportion should be in [0, 1]"
        )
      }

      log_test_result(
        test_name, "PASS",
        "Basic RTMA functionality working correctly"
      )

      return(list(
        status = "PASS",
        test_name = test_name,
        results = results
      ))
    },
    error = function(e) {
      log_test_result(test_name, "FAIL", e$message)
      return(list(
        status = "FAIL",
        test_name = test_name,
        error = e$message
      ))
    }
  )
}
