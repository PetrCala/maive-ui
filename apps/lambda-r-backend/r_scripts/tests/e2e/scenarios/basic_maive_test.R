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

#' Assert that a parameter combination actually took effect
#'
#' The generic assert_* helpers only check that the response is shaped like a
#' MAIVE result, so every combination below would pass them even if the server
#' ignored the parameters entirely. These checks tie each case to the switch it
#' is there to exercise. They are safe to assert on: generate_test_data() is
#' seeded and MAIVE seeds its own bootstrap, so the same input always produces
#' the same output here.
#'
#' @param test_case One entry of the parameter-combination list
#' @param data The `data` field of the API response
assert_parameter_case <- function(test_case, data) {
  params <- test_case$params

  # Instrumenting is what produces a first stage; without it the server reports
  # no F-statistic and omits the first-stage block.
  f_statistic <- unlist(data$firstStageFStatistic)
  first_stage_mode <- unlist(data$firstStage$mode)
  if (isTRUE(params$shouldUseInstrumenting)) {
    if (!is.numeric(f_statistic) || length(f_statistic) != 1 || !is.finite(f_statistic)) {
      stop(sprintf(
        "expected a finite first-stage F-statistic with instrumenting on, got '%s'",
        paste(format(f_statistic), collapse = ", ")
      ))
    }
    if (!identical(first_stage_mode, "levels")) {
      stop(sprintf(
        "expected a levels first stage, got '%s'",
        paste(format(first_stage_mode), collapse = ", ")
      ))
    }
  } else if (is.numeric(f_statistic)) {
    stop("did not expect a first-stage F-statistic with instrumenting off")
  }

  # Only the bootstrap SE treatment returns bootstrapped standard errors; the
  # clustered treatments leave the field as the string "NA".
  boot_se <- unlist(data$bootSE)
  if (identical(params$standardErrorTreatment, "bootstrap")) {
    if (!is.numeric(boot_se) || length(boot_se) == 0 || any(!is.finite(boot_se))) {
      stop(sprintf(
        "expected finite bootstrapped standard errors, got '%s'",
        paste(format(boot_se), collapse = ", ")
      ))
    }
  } else if (is.numeric(boot_se)) {
    stop(sprintf(
      "did not expect bootstrapped standard errors with standardErrorTreatment '%s'",
      params$standardErrorTreatment
    ))
  }
}

#' Test MAIVE with different parameter combinations
#' @return Test results
test_parameter_combinations <- function() {
  test_name <- "Parameter Combinations Test"

  # The wild-cluster bootstrap refits the model 500 times, which takes roughly
  # 20 seconds on the seeded 60-observation fixture and longer once the server
  # has warmed up inside a full sweep. That sits close enough to the 30s default
  # client timeout that the case used to fail intermittently under `--scenario
  # all` while passing on its own, with no reason reported. Give the bootstrap
  # path a budget matched to the work it asks for, so anything past it is a real
  # hang rather than a slow machine.
  bootstrap_timeout <- max(API_TIMEOUT, 180)

  # Test different parameter combinations
  test_cases <- list(
    list(
      name = "PET method",
      timeout = API_TIMEOUT,
      params = list(
        modelType = "MAIVE",
        includeStudyDummies = TRUE,
        includeStudyClustering = TRUE,
        standardErrorTreatment = "clustered_cr2",
        computeAndersonRubin = TRUE,
        maiveMethod = "PET",
        weight = "equal_weights",
        shouldUseInstrumenting = TRUE,
        useLogFirstStage = FALSE,
        winsorize = 0
      )
    ),
    list(
      name = "PEESE method",
      timeout = API_TIMEOUT,
      params = list(
        modelType = "MAIVE",
        includeStudyDummies = FALSE,
        includeStudyClustering = TRUE,
        standardErrorTreatment = "clustered",
        computeAndersonRubin = FALSE,
        maiveMethod = "PEESE",
        weight = "standard_weights",
        shouldUseInstrumenting = TRUE,
        useLogFirstStage = FALSE,
        winsorize = 0
      )
    ),
    list(
      name = "EK method",
      timeout = bootstrap_timeout,
      params = list(
        modelType = "MAIVE",
        includeStudyDummies = TRUE,
        includeStudyClustering = FALSE,
        standardErrorTreatment = "bootstrap",
        computeAndersonRubin = TRUE,
        maiveMethod = "EK",
        weight = "adjusted_weights",
        shouldUseInstrumenting = FALSE,
        useLogFirstStage = FALSE,
        winsorize = 0
      )
    )
  )

  results <- list()

  for (test_case in test_cases) {
    cat(sprintf("Testing %s...\n", test_case$name))

    started_at <- Sys.time()
    outcome <- tryCatch(
      {
        # generate_test_data() reseeds on every call, so all three cases run
        # against the same pinned fixture.
        test_data <- generate_test_data(n_studies = 20, include_study_id = TRUE)

        # Convert to JSON
        file_data_json <- df_to_json(test_data)
        params_json <- params_to_json(test_case$params)

        # Call API
        response <- test_run_model(file_data_json, params_json, timeout = test_case$timeout)

        # Validate response
        assert_response_structure(response)
        assert_maive_results(response)
        assert_parameter_case(test_case, response$data)

        list(status = "PASS", results = response$data)
      },
      error = function(e) list(status = "FAIL", error = conditionMessage(e))
    )

    # Report the elapsed time for every case: the bootstrap case is slow enough
    # that a creeping runtime is the first sign this test is heading back
    # towards its timeout.
    outcome$elapsed_seconds <- as.numeric(difftime(Sys.time(), started_at, units = "secs"))
    cat(sprintf("  %s: %s (%.1fs)\n", test_case$name, outcome$status, outcome$elapsed_seconds))
    if (outcome$status == "FAIL") {
      cat(sprintf("    %s\n", outcome$error))
    }

    results[[test_case$name]] <- outcome
  }

  # Check overall results
  failed_cases <- names(results)[vapply(results, function(x) x$status == "FAIL", logical(1))]
  total_tests <- length(results)

  if (length(failed_cases) == 0) {
    log_test_result(test_name, "PASS", sprintf("All %d parameter combinations passed", total_tests))
    failure_detail <- NULL
  } else {
    failure_detail <- paste(
      vapply(
        failed_cases,
        function(name) sprintf("%s: %s", name, results[[name]]$error),
        character(1)
      ),
      collapse = "; "
    )
    log_test_result(test_name, "FAIL", sprintf(
      "%d/%d parameter combinations failed (%s)",
      length(failed_cases), total_tests, failure_detail
    ))
  }

  return(list(
    status = if (length(failed_cases) == 0) "PASS" else "FAIL",
    test_name = test_name,
    error = failure_detail,
    results = results
  ))
}
