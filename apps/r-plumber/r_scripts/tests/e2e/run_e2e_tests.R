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
script_dir <- getwd()
if (!interactive()) {
  # Try to get the script directory when running non-interactively
  args <- commandArgs()
  if (length(args) > 0) {
    script_path <- args[length(args)]
    if (file.exists(script_path)) {
      script_dir <- dirname(normalizePath(script_path))
    }
  }
}
# If we're not already in the e2e directory, navigate to it
if (!grepl("tests/e2e$", script_dir)) {
  script_dir <- file.path(script_dir, "tests/e2e")
  setwd(script_dir)
}

# Source configuration and utilities
source(file.path(script_dir, "test_config.R"))
source(file.path(script_dir, "utils/api_client.R"))
source(file.path(script_dir, "utils/test_helpers.R"))

# Source test scenarios
source(file.path(script_dir, "scenarios/basic_maive_test.R"))
source(file.path(script_dir, "scenarios/publication_bias_test.R"))
source(file.path(script_dir, "scenarios/edge_cases_test.R"))

# Define available test scenarios
AVAILABLE_SCENARIOS <- list(
  # Basic scenarios
  "basic" = list(
    name = "Basic MAIVE Test",
    description = "Test basic MAIVE functionality with PET-PEESE method",
    function_name = "test_basic_maive"
  ),
  "parameters" = list(
    name = "Parameter Combinations Test",
    description = "Test MAIVE with different parameter combinations",
    function_name = "test_parameter_combinations"
  ),

  # Publication bias scenarios
  "pub-bias-detection" = list(
    name = "Publication Bias Detection Test",
    description = "Test publication bias detection with known biased data",
    function_name = "test_publication_bias_detection"
  ),
  "pub-bias-methods" = list(
    name = "Publication Bias Methods Test",
    description = "Test publication bias detection with different methods",
    function_name = "test_publication_bias_methods"
  ),
  "pub-bias-strength" = list(
    name = "Publication Bias Strength Test",
    description = "Test publication bias strength assessment",
    function_name = "test_publication_bias_strength"
  ),

  # Edge case scenarios
  "minimal-data" = list(
    name = "Minimal Data Test",
    description = "Test with minimal data (3 studies)",
    function_name = "test_minimal_data"
  ),
  "large-dataset" = list(
    name = "Large Dataset Test",
    description = "Test with large dataset (100 studies)",
    function_name = "test_large_dataset"
  ),
  "data-with-nas" = list(
    name = "Data with NAs Test",
    description = "Test handling of data with missing values",
    function_name = "test_data_with_nas"
  ),
  "extreme-values" = list(
    name = "Extreme Values Test",
    description = "Test handling of extreme values",
    function_name = "test_extreme_values"
  ),
  "invalid-parameters" = list(
    name = "Invalid Parameters Test",
    description = "Test handling of invalid parameters",
    function_name = "test_invalid_parameters"
  ),

  # Special scenarios
  "all" = list(
    name = "All Tests",
    description = "Run all available test scenarios",
    function_name = "run_all_scenarios"
  ),
  "health" = list(
    name = "Health Check",
    description = "Basic API health check",
    function_name = "test_health_check"
  ),
  "echo" = list(
    name = "Echo Test",
    description = "Test echo endpoint",
    function_name = "test_echo"
  )
)

#' Run a single test scenario
#' @param scenario_name Name of the scenario to run
#' @param api_url API base URL (optional)
#' @param verbose Whether to show verbose output
#' @return Test results
run_single_scenario <- function(scenario_name, api_url = NULL, verbose = TRUE) {
  # Override API URL if provided
  if (!is.null(api_url)) {
    API_BASE_URL <<- api_url
  }

  if (!scenario_name %in% names(AVAILABLE_SCENARIOS)) {
    stop(paste(
      "Unknown scenario:", scenario_name,
      "\nAvailable scenarios:", paste(names(AVAILABLE_SCENARIOS), collapse = ", ")
    ))
  }

  scenario <- AVAILABLE_SCENARIOS[[scenario_name]]

  cat(paste(rep("=", 60), collapse = ""), "\n")
  cat("MAIVE E2E Test - Single Scenario\n")
  cat(paste(rep("=", 60), collapse = ""), "\n")
  cat("Scenario:", scenario$name, "\n")
  cat("Description:", scenario$description, "\n")
  cat("API URL:", API_BASE_URL, "\n")
  cat("Timestamp:", format(Sys.time(), "%Y-%m-%d %H:%M:%S"), "\n\n")

  # Special handling for health and echo tests
  if (scenario_name == "health") {
    tryCatch(
      {
        result <- test_health_check()
        cat("✓ API is healthy\n")
        return(list(
          status = "PASS",
          test_name = scenario$name,
          result = result
        ))
      },
      error = function(e) {
        cat("✗ Health check failed:", e$message, "\n")
        return(list(
          status = "FAIL",
          test_name = scenario$name,
          error = e$message
        ))
      }
    )
  }

  if (scenario_name == "echo") {
    tryCatch(
      {
        result <- test_echo("e2e_test")
        cat("✓ Echo endpoint working\n")
        return(list(
          status = "PASS",
          test_name = scenario$name,
          result = result
        ))
      },
      error = function(e) {
        cat("✗ Echo test failed:", e$message, "\n")
        return(list(
          status = "FAIL",
          test_name = scenario$name,
          error = e$message
        ))
      }
    )
  }

  # Run the actual test function
  test_function <- get(scenario$function_name)
  if (!is.function(test_function)) {
    stop(paste("Test function", scenario$function_name, "not found"))
  }

  cat("Running", scenario$name, "...\n")
  result <- test_function()

  if (result$status == "PASS") {
    cat("✓", scenario$name, "passed\n")
  } else {
    cat("✗", scenario$name, "failed:", result$error, "\n")
  }

  return(result)
}

#' Run all scenarios (original functionality)
#' @param api_url API base URL (optional)
#' @param verbose Whether to show verbose output
#' @return Test results summary
run_all_scenarios <- function(api_url = NULL, verbose = TRUE) {
  # Override API URL if provided
  if (!is.null(api_url)) {
    API_BASE_URL <<- api_url
  }

  cat(paste(rep("=", 60), collapse = ""), "\n")
  cat("MAIVE E2E Test Suite - All Scenarios\n")
  cat(paste(rep("=", 60), collapse = ""), "\n")
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
  cat("\n", paste(rep("=", 60), collapse = ""), "\n")
  cat("TEST SUMMARY\n")
  cat(paste(rep("=", 60), collapse = ""), "\n")
  cat(sprintf("Total tests: %d\n", test_count))
  cat(sprintf("Passed: %d\n", passed_count))
  cat(sprintf("Failed: %d\n", test_count - passed_count))
  cat(sprintf("Success rate: %.1f%%\n", (passed_count / test_count) * 100))

  # Detailed results if verbose
  if (verbose) {
    cat("\nDETAILED RESULTS:\n")
    cat(paste(rep("-", 40), collapse = ""), "\n")

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

#' Show available scenarios
show_available_scenarios <- function() {
  cat("Available test scenarios:\n")
  cat(paste(rep("-", 50), collapse = ""), "\n")

  for (scenario_id in names(AVAILABLE_SCENARIOS)) {
    scenario <- AVAILABLE_SCENARIOS[[scenario_id]]
    cat(sprintf("%-20s %s\n", scenario_id, scenario$description))
  }

  cat("\nUsage examples:\n")
  cat("  Rscript run_e2e_tests.R --scenario basic\n")
  cat("  Rscript run_e2e_tests.R --scenario pub-bias-detection --api-url http://localhost:8000\n")
  cat("  Rscript run_e2e_tests.R --scenario all\n")
}

#' Main test runner function (backward compatibility)
#' @param api_url API base URL (optional)
#' @param verbose Whether to show verbose output
#' @return Test results summary
run_e2e_tests <- function(api_url = NULL, verbose = TRUE) {
  return(run_all_scenarios(api_url = api_url, verbose = verbose))
}

#' Run tests if script is executed directly
if (!interactive()) {
  # Parse command line arguments
  args <- commandArgs(trailingOnly = TRUE)

  api_url <- NULL
  verbose <- TRUE
  scenario <- "all" # Default to running all scenarios

  if (length(args) > 0) {
    i <- 1
    while (i <= length(args)) {
      if (args[i] == "--api-url" && i + 1 <= length(args)) {
        api_url <- args[i + 1]
        i <- i + 2
      } else if (args[i] == "--scenario" && i + 1 <= length(args)) {
        scenario <- args[i + 1]
        i <- i + 2
      } else if (args[i] == "--quiet") {
        verbose <- FALSE
        i <- i + 1
      } else if (args[i] == "--list-scenarios") {
        show_available_scenarios()
        quit(status = 0)
      } else if (args[i] == "--help") {
        cat("Usage: Rscript run_e2e_tests.R [OPTIONS]\n")
        cat("\nOptions:\n")
        cat("  --scenario SCENARIO    Run specific test scenario (default: all)\n")
        cat("  --api-url URL         Override default API URL\n")
        cat("  --quiet               Reduce output verbosity\n")
        cat("  --list-scenarios      Show available test scenarios\n")
        cat("  --help                Show this help message\n")
        cat("\nExamples:\n")
        cat("  Rscript run_e2e_tests.R --scenario basic\n")
        cat("  Rscript run_e2e_tests.R --scenario pub-bias-detection\n")
        cat("  Rscript run_e2e_tests.R --scenario all --api-url http://localhost:8000\n")
        quit(status = 0)
      } else {
        i <- i + 1
      }
    }
  }

  # Check if API endpoint is up and running before running tests
  check_api_up <- function(api_url) {
    if (is.null(api_url) || api_url == "") {
      api_url_to_check <- API_BASE_URL
    } else {
      api_url_to_check <- api_url
    }
    # Remove trailing slash if present
    api_url_to_check <- sub("/+$", "", api_url_to_check)
    # Try a simple GET request to the root or /health endpoint
    health_endpoints <- c("", "/", "/health", "/status")
    for (endpoint in health_endpoints) {
      url <- paste0(api_url_to_check, endpoint)
      res <- tryCatch(
        httr::GET(url, timeout(5)),
        error = function(e) NULL
      )
      if (!is.null(res) && httr::status_code(res) < 500) {
        return(TRUE)
      }
    }
    return(FALSE)
  }

  if (!check_api_up(api_url)) {
    cat(cli::col_red("✗ API endpoint is not reachable at "), api_url %||% API_BASE_URL, "\n")
    cat("Do you wish to start the API now by running `npm run r:dev`? (y/n) ")
    answer <- readline()
    if (answer == "y") {
      system("npm run r:dev")
    } else {
      quit(status = 2)
    }
  }

  # Run tests
  if (scenario == "all") {
    results <- run_all_scenarios(api_url = api_url, verbose = verbose)
  } else {
    results <- run_single_scenario(scenario, api_url = api_url, verbose = verbose)
  }

  # Exit with appropriate status code
  if (is.list(results) && "failed_tests" %in% names(results)) {
    # Multi-test results
    if (results$failed_tests > 0) {
      quit(status = 1)
    } else {
      quit(status = 0)
    }
  } else {
    # Single test result
    if (results$status == "FAIL") {
      quit(status = 1)
    } else {
      quit(status = 0)
    }
  }
}
