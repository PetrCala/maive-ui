# Response Cleanup Test Scenario (#554)
#
# Three regressions in the response layer, after the statistics themselves are
# already right: a serializer that rounded small standard errors to 0, a
# degenerate dataset that crashed the request or was reported as significant,
# and package warnings that never reached the caller.

# Eight elasticity-scale rows with a strong instrument. The true SE is about
# 2.3e-05, which jsonlite's default four digits printed as 0.
SMALL_SE_FIXTURE <- data.frame(
  effect = c(0.00093, 0.00072, 0.0012, 0.00057, 0.00105, 0.00066, 0.00081, 0.0009),
  se = c(0.00036, 0.00027, 0.00048, 0.00021, 0.00042, 0.00024, 0.00033, 0.00039),
  n_obs = c(280, 490, 150, 810, 200, 620, 330, 240)
)

# Twelve rows with the same effect: a perfect fit with a numerically zero SE and
# an undefined Hausman statistic.
IDENTICAL_EFFECTS_FIXTURE <- data.frame(
  effect = rep(0.3, 12),
  se = c(0.1, 0.12, 0.08, 0.15, 0.09, 0.11, 0.13, 0.07, 0.14, 0.1, 0.12, 0.09),
  n_obs = c(120, 95, 200, 60, 150, 80, 110, 175, 90, 130, 105, 140)
)

#' Run the legacy /run-model route and fail on its 200-with-error envelope
#' @param df Data frame to submit
#' @return Parsed response with a populated `data` field
run_model_or_fail <- function(df) {
  response <- test_run_model(df_to_json(df), params_to_json(DEFAULT_PARAMETERS))
  if (isTRUE(response$error) || is.null(response$data)) {
    stop(paste("run-model returned an error:", response$message))
  }
  response
}

#' Assert that a response field is a JSON array of strings
#' @param warnings The parsed `warnings` field
assert_warnings_array <- function(warnings) {
  if (is.null(warnings) || !is.list(warnings)) {
    stop("warnings should be a JSON array")
  }
  if (length(warnings) > 0 && !all(vapply(warnings, is.character, logical(1)))) {
    stop("warnings should contain only strings")
  }
}

#' Test that small standard errors survive JSON serialization
#' @return Test results
test_small_se_precision <- function() {
  test_name <- "Small SE Precision Test"

  tryCatch(
    {
      cat("Testing that a standard error of ~2.3e-05 is not serialized as 0...\n")
      response <- run_model_or_fail(SMALL_SE_FIXTURE)
      assert_response_structure(response)
      results <- response$data

      if (!is.numeric(results$standardError) || results$standardError <= 0) {
        stop(paste("standardError should be positive, got:", results$standardError))
      }
      if (results$standardError >= 1e-04) {
        stop(paste("standardError should be on the 1e-05 scale, got:", results$standardError))
      }
      if (!isTRUE(results$isSignificant)) {
        stop("A strong, precisely estimated effect should be significant")
      }

      log_test_result(test_name, "PASS", sprintf("standardError = %g", results$standardError))

      return(list(status = "PASS", test_name = test_name, results = results))
    },
    error = function(e) {
      log_test_result(test_name, "FAIL", e$message)
      return(list(status = "FAIL", test_name = test_name, error = e$message))
    }
  )
}

#' Test that identical effects return a structured result with no invented verdict
#' @return Test results
test_identical_effects <- function() {
  test_name <- "Identical Effects Test"

  tryCatch(
    {
      cat("Testing twelve rows with identical effects...\n")
      response <- run_model_or_fail(IDENTICAL_EFFECTS_FIXTURE)
      assert_response_structure(response)
      results <- response$data

      if (!is.numeric(results$effectEstimate)) {
        stop("effectEstimate should be numeric")
      }
      if (abs(results$effectEstimate - 0.3) > 1e-06) {
        stop(paste("effectEstimate should be 0.3, got:", results$effectEstimate))
      }
      if (isTRUE(results$isSignificant)) {
        stop("A numerically zero standard error must not be reported as significant")
      }
      if (isTRUE(results$publicationBias$isSignificant) && !is.numeric(results$publicationBias$pValue)) {
        stop("publicationBias.isSignificant must not be TRUE without a p-value")
      }
      if (isTRUE(results$hausmanTest$rejectsNull) && !is.numeric(results$hausmanTest$statistic)) {
        stop("hausmanTest.rejectsNull must not be TRUE without a statistic")
      }
      for (field in c("isSignificant")) {
        value <- results[[field]]
        if (!is.null(value) && !is.logical(value)) {
          stop(paste(field, "should be a boolean or null"))
        }
      }
      assert_warnings_array(results$warnings)
      if (length(results$warnings) == 0) {
        stop("A perfect fit should carry at least one warning")
      }

      # The public /v1 route must answer 200 too, not the old 500.
      v1_response <- httr::POST(
        paste0(API_BASE_URL, "/v1/run-model"),
        body = list(
          data = IDENTICAL_EFFECTS_FIXTURE,
          parameters = list(modelType = "MAIVE")
        ),
        encode = "json",
        httr::timeout(API_TIMEOUT)
      )
      if (httr::status_code(v1_response) != 200) {
        stop(paste("/v1/run-model returned status", httr::status_code(v1_response)))
      }
      v1_results <- httr::content(v1_response, "parsed")
      if (isTRUE(v1_results$isSignificant)) {
        stop("/v1/run-model must not report the degenerate fit as significant")
      }

      log_test_result(
        test_name, "PASS",
        sprintf(
          "isSignificant = %s, %d warning(s)",
          if (is.null(results$isSignificant)) "null" else results$isSignificant,
          length(results$warnings)
        )
      )

      return(list(status = "PASS", test_name = test_name, results = results))
    },
    error = function(e) {
      log_test_result(test_name, "FAIL", e$message)
      return(list(status = "FAIL", test_name = test_name, error = e$message))
    }
  )
}

#' Test that MAIVE package warnings reach the response
#' @return Test results
test_maive_warnings <- function() {
  test_name <- "MAIVE Warnings Test"

  tryCatch(
    {
      cat("Testing that a small-sample IV run returns its warning...\n")
      response <- run_model_or_fail(SMALL_SE_FIXTURE)
      results <- response$data

      assert_warnings_array(results$warnings)
      if (length(results$warnings) == 0) {
        stop("Expected a non-empty warnings array for an 8-row IV run")
      }
      warning_text <- unlist(results$warnings)
      if (!any(grepl("small for IV estimation|Weak instrument", warning_text))) {
        stop(paste("Expected a small-sample or weak-instrument warning, got:", paste(warning_text, collapse = " | ")))
      }
      if (!is.character(results$instrument_strength) || !nzchar(results$instrument_strength)) {
        stop("instrument_strength should be a non-empty string")
      }

      log_test_result(
        test_name, "PASS",
        sprintf("%d warning(s), instrument_strength = %s", length(warning_text), results$instrument_strength)
      )

      return(list(status = "PASS", test_name = test_name, results = results))
    },
    error = function(e) {
      log_test_result(test_name, "FAIL", e$message)
      return(list(status = "FAIL", test_name = test_name, error = e$message))
    }
  )
}
