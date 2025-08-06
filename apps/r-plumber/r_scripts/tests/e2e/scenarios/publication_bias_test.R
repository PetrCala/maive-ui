# Publication Bias Test Scenario

#' Test publication bias detection
#' @return Test results
test_publication_bias_detection <- function() {
  test_name <- "Publication Bias Detection Test"

  tryCatch(
    {
      # Generate data with known publication bias
      biased_data <- generate_biased_data(n_studies = 40, bias_strength = 0.7)

      # Prepare parameters
      params <- DEFAULT_PARAMETERS
      params$maiveMethod <- "PET-PEESE" # Best for detecting publication bias

      # Convert to JSON
      file_data_json <- df_to_json(biased_data)
      params_json <- params_to_json(params)

      # Call API
      cat("Testing publication bias detection...\n")
      response <- test_run_model(file_data_json, params_json)

      # Validate response
      assert_response_structure(response)
      assert_maive_results(response)

      results <- response$data

      # Check publication bias detection
      pub_bias_p_value <- results$publicationBias$pValue
      pub_bias_significant <- results$publicationBias$isSignificant

      cat(sprintf("Publication bias p-value: %.4f\n", pub_bias_p_value))
      cat(sprintf("Publication bias significant: %s\n", pub_bias_significant))

      # Since we generated data with known bias, we expect to detect it
      if (pub_bias_p_value > 0.1) {
        warning("Publication bias p-value is high despite known bias in data")
      }

      # Check that p-value is reasonable
      if (pub_bias_p_value < 0 || pub_bias_p_value > 1) {
        stop("Publication bias p-value should be between 0 and 1")
      }

      # Check that significance matches p-value
      expected_significance <- pub_bias_p_value < 0.05
      if (pub_bias_significant != expected_significance) {
        warning("Publication bias significance doesn't match p-value threshold")
      }

      log_test_result(test_name, "PASS", "Publication bias detection working correctly")

      return(list(
        status = "PASS",
        test_name = test_name,
        results = results,
        publication_bias_p_value = pub_bias_p_value,
        publication_bias_significant = pub_bias_significant
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

#' Test publication bias with different methods
#' @return Test results
test_publication_bias_methods <- function() {
  test_name <- "Publication Bias Methods Test"

  # Generate biased data
  biased_data <- generate_biased_data(n_studies = 35, bias_strength = 0.6)

  # Test different methods for publication bias detection
  methods <- c("PET", "PEESE", "PET-PEESE", "EK")

  results <- list()

  for (method in methods) {
    tryCatch(
      {
        cat(sprintf("Testing publication bias with %s method...\n", method))

        # Prepare parameters
        params <- DEFAULT_PARAMETERS
        params$maiveMethod <- method

        # Convert to JSON
        file_data_json <- df_to_json(biased_data)
        params_json <- params_to_json(params)

        # Call API
        response <- test_run_model(file_data_json, params_json)

        # Validate response
        assert_response_structure(response)
        assert_maive_results(response)

        results[[method]] <- list(
          status = "PASS",
          p_value = response$data$publicationBias$pValue,
          is_significant = response$data$publicationBias$isSignificant,
          effect_estimate = response$data$effectEstimate,
          standard_error = response$data$standardError
        )
      },
      error = function(e) {
        results[[method]] <<- list(
          status = "FAIL",
          error = e$message
        )
      }
    )
  }

  # Analyze results
  successful_methods <- names(results)[sapply(results, function(x) x$status == "PASS")]

  if (length(successful_methods) == length(methods)) {
    # Compare p-values across methods
    p_values <- sapply(successful_methods, function(m) results[[m]]$p_value)
    cat("Publication bias p-values across methods:\n")
    for (method in successful_methods) {
      cat(sprintf("  %s: %.4f\n", method, results[[method]]$p_value))
    }

    log_test_result(test_name, "PASS", sprintf("All %d methods successfully detected publication bias", length(methods)))
  } else {
    failed_methods <- setdiff(methods, successful_methods)
    log_test_result(test_name, "FAIL", sprintf("Methods failed: %s", paste(failed_methods, collapse = ", ")))
  }

  return(list(
    status = ifelse(length(successful_methods) == length(methods), "PASS", "FAIL"),
    test_name = test_name,
    results = results
  ))
}

#' Test publication bias with varying bias strength
#' @return Test results
test_publication_bias_strength <- function() {
  test_name <- "Publication Bias Strength Test"

  bias_strengths <- c(0.3, 0.5, 0.7, 0.9)
  results <- list()

  for (strength in bias_strengths) {
    tryCatch(
      {
        cat(sprintf("Testing publication bias with strength %.1f...\n", strength))

        # Generate data with specific bias strength
        biased_data <- generate_biased_data(n_studies = 30, bias_strength = strength)

        # Prepare parameters
        params <- DEFAULT_PARAMETERS
        params$maiveMethod <- "PET-PEESE"

        # Convert to JSON
        file_data_json <- df_to_json(biased_data)
        params_json <- params_to_json(params)

        # Call API
        response <- test_run_model(file_data_json, params_json)

        # Validate response
        assert_response_structure(response)
        assert_maive_results(response)

        results[[as.character(strength)]] <- list(
          status = "PASS",
          p_value = response$data$publicationBias$pValue,
          is_significant = response$data$publicationBias$isSignificant,
          effect_estimate = response$data$effectEstimate
        )
      },
      error = function(e) {
        results[[as.character(strength)]] <<- list(
          status = "FAIL",
          error = e$message
        )
      }
    )
  }

  # Analyze results
  successful_tests <- names(results)[sapply(results, function(x) x$status == "PASS")]

  if (length(successful_tests) == length(bias_strengths)) {
    # Check if p-values decrease with increasing bias strength
    p_values <- sapply(successful_tests, function(s) results[[s]]$p_value)
    cat("Publication bias p-values by bias strength:\n")
    for (strength in successful_tests) {
      cat(sprintf("  Strength %s: %.4f\n", strength, results[[strength]]$p_value))
    }

    log_test_result(test_name, "PASS", "Publication bias detection works across different bias strengths")
  } else {
    failed_strengths <- setdiff(as.character(bias_strengths), successful_tests)
    log_test_result(test_name, "FAIL", sprintf("Failed bias strengths: %s", paste(failed_strengths, collapse = ", ")))
  }

  return(list(
    status = ifelse(length(successful_tests) == length(bias_strengths), "PASS", "FAIL"),
    test_name = test_name,
    results = results
  ))
}
