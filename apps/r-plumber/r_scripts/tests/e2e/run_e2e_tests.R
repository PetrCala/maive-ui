#!/usr/bin/env Rscript

# E2E Test Runner for MAIVE Plumber API
# This script runs comprehensive end-to-end tests for the MAIVE API

# Load required libraries
suppressPackageStartupMessages({
  library(httr)
  library(jsonlite)
  library(cli)
})

# Set working directory to the script location
script_dir <- dirname(sys.frame(1)$ofile)
if (is.null(script_dir)) {
  script_dir <- getwd()
}
setwd(script_dir)

# Source configuration and utilities
source("test_config.R")
source("utils/api_client.R")
source("utils/test_helpers.R")

# Source test scenarios
source("scenarios/basic_maive_test.R")
source("scenarios/publication_bias_test.R")
source("scenarios/edge_cases_test.R")

#' Main test runner function
#' @param api_url API base URL (optional)
#' @param verbose Whether to show verbose output
#' @return Test results summary
run_e2e_tests <- function(api_url = NULL, verbose = TRUE) {
  # Override API URL if provided
  if (!is.null(api_url)) {
    API_BASE_URL <<- api_url
  }

  cat("=" * 60, "\n")
  cat("MAIVE E2E Test Suite\n")
  cat("=" * 60, "\n")
  cat("API URL:", API_BASE_URL, "\n")
  cat("Timestamp:", format(Sys.time(), "%Y-%m-%d %H:%M:%S"), "\n\n")

  # Test results storage
  all_results <- list()
  test_count <- 0
  passed_count <- 0

  # Health check first
  cat("1. Running health check...\n")
  tryCatch(
    {
      health_result <- test_health_check()
      cat("   ✓ API is healthy\n")
      all_results$health_check <- list(status = "PASS", result = health_result)
      passed_count <- passed_count + 1
    },
    error = function(e) {
      cat("   ✗ Health check failed:", e$message, "\n")
      all_results$health_check <- list(status = "FAIL", error = e$message)
    }
  )
  test_count <- test_count + 1

  # Echo test
  cat("\n2. Testing echo endpoint...\n")
  tryCatch(
    {
      echo_result <- test_echo("e2e_test")
      cat("   ✓ Echo endpoint working\n")
      all_results$echo_test <- list(status = "PASS", result = echo_result)
      passed_count <- passed_count + 1
    },
    error = function(e) {
      cat("   ✗ Echo test failed:", e$message, "\n")
      all_results$echo_test <- list(status = "FAIL", error = e$message)
    }
  )
  test_count <- test_count + 1

  # Basic MAIVE tests
  cat("\n3. Running basic MAIVE tests...\n")
  basic_result <- test_basic_maive()
  all_results$basic_maive <- basic_result
  if (basic_result$status == "PASS") {
    passed_count <- passed_count + 1
    cat("   ✓ Basic MAIVE test passed\n")
  } else {
    cat("   ✗ Basic MAIVE test failed:", basic_result$error, "\n")
  }
  test_count <- test_count + 1

  # Parameter combinations test
  param_result <- test_parameter_combinations()
  all_results$parameter_combinations <- param_result
  if (param_result$status == "PASS") {
    passed_count <- passed_count + 1
    cat("   ✓ Parameter combinations test passed\n")
  } else {
    cat("   ✗ Parameter combinations test failed\n")
  }
  test_count <- test_count + 1

  # Publication bias tests
  cat("\n4. Running publication bias tests...\n")
  pub_bias_result <- test_publication_bias_detection()
  all_results$publication_bias_detection <- pub_bias_result
  if (pub_bias_result$status == "PASS") {
    passed_count <- passed_count + 1
    cat("   ✓ Publication bias detection test passed\n")
  } else {
    cat("   ✗ Publication bias detection test failed:", pub_bias_result$error, "\n")
  }
  test_count <- test_count + 1

  pub_bias_methods_result <- test_publication_bias_methods()
  all_results$publication_bias_methods <- pub_bias_methods_result
  if (pub_bias_methods_result$status == "PASS") {
    passed_count <- passed_count + 1
    cat("   ✓ Publication bias methods test passed\n")
  } else {
    cat("   ✗ Publication bias methods test failed\n")
  }
  test_count <- test_count + 1

  pub_bias_strength_result <- test_publication_bias_strength()
  all_results$publication_bias_strength <- pub_bias_strength_result
  if (pub_bias_strength_result$status == "PASS") {
    passed_count <- passed_count + 1
    cat("   ✓ Publication bias strength test passed\n")
  } else {
    cat("   ✗ Publication bias strength test failed\n")
  }
  test_count <- test_count + 1

  # Edge cases tests
  cat("\n5. Running edge cases tests...\n")
  edge_tests <- list(
    minimal_data = test_minimal_data(),
    large_dataset = test_large_dataset(),
    data_with_nas = test_data_with_nas(),
    extreme_values = test_extreme_values(),
    invalid_parameters = test_invalid_parameters()
  )

  all_results$edge_cases <- edge_tests

  for (test_name in names(edge_tests)) {
    test_result <- edge_tests[[test_name]]
    if (test_result$status == "PASS") {
      passed_count <- passed_count + 1
      cat(sprintf("   ✓ %s test passed\n", test_name))
    } else {
      cat(sprintf("   ✗ %s test failed: %s\n", test_name, test_result$error))
    }
    test_count <- test_count + 1
  }

  # Summary
  cat("\n" + "=" * 60, "\n")
  cat("TEST SUMMARY\n")
  cat("=" * 60, "\n")
  cat(sprintf("Total tests: %d\n", test_count))
  cat(sprintf("Passed: %d\n", passed_count))
  cat(sprintf("Failed: %d\n", test_count - passed_count))
  cat(sprintf("Success rate: %.1f%%\n", (passed_count / test_count) * 100))

  # Detailed results if verbose
  if (verbose) {
    cat("\nDETAILED RESULTS:\n")
    cat("-" * 40, "\n")

    for (test_category in names(all_results)) {
      cat(sprintf("\n%s:\n", toupper(test_category)))

      if (test_category == "edge_cases") {
        for (edge_test in names(all_results[[test_category]])) {
          result <- all_results[[test_category]][[edge_test]]
          status_icon <- ifelse(result$status == "PASS", "✓", "✗")
          cat(sprintf("  %s %s\n", status_icon, edge_test))
        }
      } else {
        result <- all_results[[test_category]]
        status_icon <- ifelse(result$status == "PASS", "✓", "✗")
        cat(sprintf("  %s %s\n", status_icon, test_category))
      }
    }
  }

  # Return results
  return(list(
    total_tests = test_count,
    passed_tests = passed_count,
    failed_tests = test_count - passed_count,
    success_rate = (passed_count / test_count) * 100,
    all_results = all_results
  ))
}

#' Run tests if script is executed directly
if (!interactive()) {
  # Parse command line arguments
  args <- commandArgs(trailingOnly = TRUE)

  api_url <- NULL
  verbose <- TRUE

  if (length(args) > 0) {
    for (i in seq_along(args)) {
      if (args[i] == "--api-url" && i + 1 <= length(args)) {
        api_url <- args[i + 1]
      } else if (args[i] == "--quiet") {
        verbose <- FALSE
      } else if (args[i] == "--help") {
        cat("Usage: Rscript run_e2e_tests.R [--api-url URL] [--quiet]\n")
        cat("  --api-url URL    Override default API URL\n")
        cat("  --quiet          Reduce output verbosity\n")
        cat("  --help           Show this help message\n")
        quit(status = 0)
      }
    }
  }

  # Run tests
  results <- run_e2e_tests(api_url = api_url, verbose = verbose)

  # Exit with appropriate status code
  if (results$failed_tests > 0) {
    quit(status = 1)
  } else {
    quit(status = 0)
  }
}
