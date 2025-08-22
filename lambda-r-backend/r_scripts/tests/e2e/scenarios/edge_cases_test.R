# Edge Cases Test Scenario

#' Test with minimal data (3 studies)
#' @return Test results
test_minimal_data <- function() {
  test_name <- "Minimal Data Test"

  tryCatch(
    {
      # Generate minimal test data
      minimal_data <- generate_test_data(n_studies = 3, include_study_id = FALSE)

      # Prepare parameters
      params <- DEFAULT_PARAMETERS

      # Convert to JSON
      file_data_json <- df_to_json(minimal_data)
      params_json <- params_to_json(params)

      # Call API
      cat("Testing with minimal data (3 studies)...\n")
      response <- test_run_model(file_data_json, params_json)

      # Validate response
      assert_response_structure(response)
      assert_maive_results(response)

      results <- response$data

      # Check that we get results even with minimal data
      if (is.na(results$effectEstimate)) {
        stop("Should get effect estimate even with minimal data")
      }

      log_test_result(test_name, "PASS", "Minimal data handled correctly")

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

#' Test with large dataset
#' @return Test results
test_large_dataset <- function() {
  test_name <- "Large Dataset Test"

  tryCatch(
    {
      # Generate large test data
      large_data <- generate_test_data(n_studies = 100, include_study_id = TRUE)

      # Prepare parameters
      params <- DEFAULT_PARAMETERS
      params$weight <- "standard_weights" # Use standard weights for large dataset

      # Convert to JSON
      file_data_json <- df_to_json(large_data)
      params_json <- params_to_json(params)

      # Call API
      cat("Testing with large dataset (100 studies)...\n")
      response <- test_run_model(file_data_json, params_json)

      # Validate response
      assert_response_structure(response)
      assert_maive_results(response)

      results <- response$data

      # Check that large dataset is processed correctly
      if (is.na(results$effectEstimate)) {
        stop("Should get effect estimate with large dataset")
      }

      log_test_result(test_name, "PASS", "Large dataset handled correctly")

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

#' Test with data containing NA values
#' @return Test results
test_data_with_nas <- function() {
  test_name <- "Data with NAs Test"

  tryCatch(
    {
      # Generate test data
      test_data <- generate_test_data(n_studies = 20, include_study_id = TRUE)

      # Add some NA values
      test_data$bs[3] <- NA
      test_data$sebs[7] <- NA
      test_data$Ns[12] <- NA

      # Prepare parameters
      params <- DEFAULT_PARAMETERS
      params$weight <- "no_weights" # Use no weights for data with NAs

      # Convert to JSON
      file_data_json <- df_to_json(test_data)
      params_json <- params_to_json(params)

      # Call API
      cat("Testing with data containing NA values...\n")
      response <- test_run_model(file_data_json, params_json)

      # Validate response
      assert_response_structure(response)
      assert_maive_results(response)

      results <- response$data

      # Check that NA values are handled gracefully
      if (is.na(results$effectEstimate)) {
        stop("Should handle NA values gracefully")
      }

      log_test_result(test_name, "PASS", "NA values handled correctly")

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

#' Test with extreme values
#' @return Test results
test_extreme_values <- function() {
  test_name <- "Extreme Values Test"

  tryCatch(
    {
      # Generate test data with extreme values
      set.seed(789)
      n_studies <- 15

      # Create data with some extreme values
      effects <- c(
        rnorm(n_studies - 3, mean = 0.3, sd = 0.2), # Normal values
        10.0, # Very large positive effect
        -8.5, # Very large negative effect
        0.001 # Very small effect
      )

      standard_errors <- c(
        rnorm(n_studies - 3, mean = 0.1, sd = 0.05), # Normal values
        0.001, # Very small SE
        0.001, # Very small SE
        5.0 # Very large SE
      )

      sample_sizes <- c(
        round(runif(n_studies - 3, 100, 1000)), # Normal values
        10000, # Very large sample
        10000, # Very large sample
        10 # Very small sample
      )

      extreme_data <- data.frame(
        bs = effects,
        sebs = standard_errors,
        Ns = sample_sizes,
        study_id = paste0("study_", 1:n_studies)
      )

      # Prepare parameters
      params <- DEFAULT_PARAMETERS
      params$weight <- "adjusted_weights" # Use adjusted weights for extreme values

      # Convert to JSON
      file_data_json <- df_to_json(extreme_data)
      params_json <- params_to_json(params)

      # Call API
      cat("Testing with extreme values...\n")
      response <- test_run_model(file_data_json, params_json)

      # Validate response
      assert_response_structure(response)
      assert_maive_results(response)

      results <- response$data

      # Check that extreme values are handled
      if (is.na(results$effectEstimate)) {
        stop("Should handle extreme values")
      }

      log_test_result(test_name, "PASS", "Extreme values handled correctly")

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

#' Test error handling for invalid parameters
#' @return Test results
test_invalid_parameters <- function() {
  test_name <- "Invalid Parameters Test"

  # Test cases with invalid parameters
  test_cases <- list(
    list(
      name = "Missing parameters",
      params = list(
        modelType = "MAIVE"
        # Missing other required parameters
      ),
      expected_error = TRUE
    ),
    list(
      name = "Invalid method",
      params = list(
        modelType = "MAIVE",
        includeStudyDummies = TRUE,
        includeStudyClustering = TRUE,
        standardErrorTreatment = "clustered_cr2",
        computeAndersonRubin = TRUE,
        maiveMethod = "INVALID_METHOD",
        weight = "no_weights",
        shouldUseInstrumenting = TRUE
      ),
      expected_error = TRUE
    ),
    list(
      name = "Invalid standard error treatment",
      params = list(
        modelType = "MAIVE",
        includeStudyDummies = TRUE,
        includeStudyClustering = TRUE,
        standardErrorTreatment = "invalid_treatment",
        computeAndersonRubin = TRUE,
        maiveMethod = "PET-PEESE",
        weight = "standard_weights",
        shouldUseInstrumenting = TRUE
      ),
      expected_error = TRUE
    )
  )

  results <- list()

  for (test_case in test_cases) {
    tryCatch(
      {
        cat(sprintf("Testing %s...\n", test_case$name))

        # Generate test data
        test_data <- generate_test_data(n_studies = 10, include_study_id = TRUE)

        # Convert to JSON
        file_data_json <- df_to_json(test_data)
        params_json <- params_to_json(test_case$params)

        # Call API
        response <- test_run_model(file_data_json, params_json)

        # If we expected an error but didn't get one
        if (test_case$expected_error) {
          results[[test_case$name]] <- list(
            status = "FAIL",
            error = "Expected error but got successful response"
          )
        } else {
          results[[test_case$name]] <- list(
            status = "PASS",
            results = response$data
          )
        }
      },
      error = function(e) {
        # If we expected an error and got one
        if (test_case$expected_error) {
          results[[test_case$name]] <<- list(
            status = "PASS",
            error_message = e$message
          )
        } else {
          results[[test_case$name]] <<- list(
            status = "FAIL",
            error = e$message
          )
        }
      }
    )
  }

  # Check results
  passed_tests <- sum(sapply(results, function(x) x$status == "PASS"))
  total_tests <- length(results)

  if (passed_tests == total_tests) {
    log_test_result(test_name, "PASS", "All invalid parameter tests passed")
  } else {
    log_test_result(test_name, "FAIL", sprintf("%d/%d invalid parameter tests failed", total_tests - passed_tests, total_tests))
  }

  return(list(
    status = ifelse(passed_tests == total_tests, "PASS", "FAIL"),
    test_name = test_name,
    results = results
  ))
}
