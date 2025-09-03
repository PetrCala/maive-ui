# Basic MAIVE Test Scenario

#' Test basic MAIVE functionality
#' @return Test results
test_basic_maive <- function() {
  test_name <- "Basic MAIVE Test"

  tryCatch(
    {
      # Generate test data
      test_data <- generate_test_data(n_studies = 25, include_study_id = TRUE)

      # Prepare parameters
      params <- DEFAULT_PARAMETERS
      params$maiveMethod <- "PET-PEESE"

      # Convert to JSON
      file_data_json <- df_to_json(test_data)
      params_json <- params_to_json(params)

      # Call API
      cat("Running basic MAIVE test...\n")
      response <- test_run_model(file_data_json, params_json)

      # Validate response structure
      assert_response_structure(response)
      assert_maive_results(response)

      # Basic sanity checks
      results <- response$data

      # Check that we got reasonable results
      if (is.na(results$effectEstimate)) {
        stop("Effect estimate should not be NA")
      }

      if (results$standardError <= 0) {
        stop("Standard error should be positive")
      }

      # Check that funnel plot was generated
      if (is.null(results$funnelPlot) || results$funnelPlot == "") {
        stop("Funnel plot should be generated")
      }

      # Log success
      log_test_result(test_name, "PASS", "Basic MAIVE functionality working correctly")

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

#' Test MAIVE with different parameter combinations
#' @return Test results
test_parameter_combinations <- function() {
  test_name <- "Parameter Combinations Test"

  # Test different parameter combinations
  test_cases <- list(
    list(
      name = "PET method",
      params = list(
        modelType = "MAIVE",
        includeStudyDummies = TRUE,
        includeStudyClustering = TRUE,
        standardErrorTreatment = "clustered_cr2",
        computeAndersonRubin = TRUE,
        maiveMethod = "PET",
        weight = "equal_weights",
        shouldUseInstrumenting = TRUE
      )
    ),
    list(
      name = "PEESE method",
      params = list(
        modelType = "MAIVE",
        includeStudyDummies = FALSE,
        includeStudyClustering = TRUE,
        standardErrorTreatment = "clustered",
        computeAndersonRubin = FALSE,
        maiveMethod = "PEESE",
        weight = "standard_weights",
        shouldUseInstrumenting = TRUE
      )
    ),
    list(
      name = "EK method",
      params = list(
        modelType = "MAIVE",
        includeStudyDummies = TRUE,
        includeStudyClustering = FALSE,
        standardErrorTreatment = "bootstrap",
        computeAndersonRubin = TRUE,
        maiveMethod = "EK",
        weight = "adjusted_weights",
        shouldUseInstrumenting = FALSE
      )
    )
  )

  results <- list()

  for (test_case in test_cases) {
    tryCatch(
      {
        cat(sprintf("Testing %s...\n", test_case$name))

        # Generate test data
        test_data <- generate_test_data(n_studies = 20, include_study_id = TRUE)

        # Convert to JSON
        file_data_json <- df_to_json(test_data)
        params_json <- params_to_json(test_case$params)

        # Call API
        response <- test_run_model(file_data_json, params_json)

        # Validate response
        assert_response_structure(response)
        assert_maive_results(response)

        results[[test_case$name]] <- list(
          status = "PASS",
          results = response$data
        )
      },
      error = function(e) {
        results[[test_case$name]] <<- list(
          status = "FAIL",
          error = e$message
        )
      }
    )
  }

  # Check overall results
  passed_tests <- sum(sapply(results, function(x) x$status == "PASS"))
  total_tests <- length(results)

  if (passed_tests == total_tests) {
    log_test_result(test_name, "PASS", sprintf("All %d parameter combinations passed", total_tests))
  } else {
    log_test_result(test_name, "FAIL", sprintf("%d/%d parameter combinations failed", total_tests - passed_tests, total_tests))
  }

  return(list(
    status = ifelse(passed_tests == total_tests, "PASS", "FAIL"),
    test_name = test_name,
    results = results
  ))
}
