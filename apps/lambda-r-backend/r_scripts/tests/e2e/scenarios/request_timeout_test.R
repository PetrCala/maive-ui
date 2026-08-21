# Request Timeout Test Scenario (#526)
#
# The MAIVE path had no wall-clock guard at all: the RTMA fit ran in a bounded
# child, but a /run-model request (bootstrap standard errors above all) could
# grind until the platform killed it at the function timeout, which is exactly
# what the Aug 15 incident's 600 s hard kills were. Every model request now
# runs under a request-level budget (request_bounds.R): the whole handler runs
# in a forked child killed at the deadline, and the caller gets a structured
# payload (error, code "timeout", the budget, elapsed seconds) instead of a
# dropped connection.
#
# What this scenario pins down, end to end through the server, on the route
# the old fit-level guard never covered:
#   * a budget far below the analysis' runtime produces the structured timeout
#     payload, and produces it promptly
#   * the same server then serves a normal request, so killing an analysis
#     mid-run leaves no wreckage behind
#   * a budget that is not a positive number is rejected as a bad parameter

# Budget for the request that must time out. Well under the bootstrap run's
# time on REQUEST_TIMEOUT_N_STUDIES rows, so a timeout is the only correct
# outcome.
REQUEST_TIMEOUT_BUDGET_SEC <- 0.5

# Rows for the run that must time out. Wild-bootstrap standard errors on this
# many rows take well over the enforced deadline (budget plus the one-second
# grace) on any machine this suite runs on.
REQUEST_TIMEOUT_N_STUDIES <- 200

# Absolute ceiling on how late the timeout response may arrive. The deadline
# is enforced to about a quarter second past budget plus grace, but the
# request also pays HTTP, JSON and fork overhead, and CI machines are slow.
REQUEST_TIMEOUT_MAX_RESPONSE_SEC <- 30

#' Fail with a message unless a condition holds
#' @param condition Condition that must be TRUE
#' @param message Failure message
expect_request_timeout <- function(condition, message) {
  if (!isTRUE(condition)) {
    stop(message)
  }
}

#' Build MAIVE parameter JSON for the request timeout scenario
#' @param timeout_seconds Wall-clock budget to request, or NULL for the default
#' @param se_treatment Standard error treatment to request
#' @return JSON string of parameters
request_timeout_params <- function(timeout_seconds = NULL,
                                   se_treatment = "bootstrap") {
  params <- DEFAULT_PARAMETERS
  params$standardErrorTreatment <- se_treatment
  if (!is.null(timeout_seconds)) {
    params$timeoutSeconds <- timeout_seconds
  }
  params_to_json(params)
}

#' POST /run-model and report how long the response took to arrive
#' @param data_json JSON string of the dataset
#' @param params_json JSON string of the parameters
#' @return list(response = <parsed body>, elapsed = <seconds>)
time_model_request <- function(data_json, params_json) {
  started <- Sys.time()
  response <- test_run_model(data_json, params_json)
  list(
    response = response,
    elapsed = as.numeric(difftime(Sys.time(), started, units = "secs"))
  )
}

#' Test that the request-level wall-clock budget is enforced on /run-model
#' @return Test results
test_request_timeout <- function() {
  test_name <- "Request Timeout Test"

  tryCatch(
    {
      heavy_data <- df_to_json(
        generate_test_data(n_studies = REQUEST_TIMEOUT_N_STUDIES)
      )

      cat(sprintf(
        "  requesting a bootstrap run with a %s second budget...\n",
        REQUEST_TIMEOUT_BUDGET_SEC
      ))
      timed_out <- time_model_request(
        heavy_data,
        request_timeout_params(REQUEST_TIMEOUT_BUDGET_SEC)
      )

      # The legacy route reports handler errors as a 200 with an error flag;
      # the structured payload adds code and the budget (#526).
      expect_request_timeout(
        isTRUE(timed_out$response$error),
        sprintf(
          "a %s second budget should time the run out, but the request returned results",
          REQUEST_TIMEOUT_BUDGET_SEC
        )
      )
      expect_request_timeout(
        identical(timed_out$response$code, "timeout"),
        paste(
          "timeout error should carry code \"timeout\", got:",
          format(timed_out$response$code)
        )
      )
      expect_request_timeout(
        grepl(
          sprintf("timed out after %s seconds", REQUEST_TIMEOUT_BUDGET_SEC),
          timed_out$response$message,
          fixed = TRUE
        ),
        paste(
          "timeout error should name the requested budget, got:",
          timed_out$response$message
        )
      )
      expect_request_timeout(
        isTRUE(
          abs(
            as.numeric(timed_out$response$timeoutSeconds) -
              REQUEST_TIMEOUT_BUDGET_SEC
          ) < 1e-9
        ),
        paste(
          "timeout payload should echo the budget in timeoutSeconds, got:",
          format(timed_out$response$timeoutSeconds)
        )
      )
      expect_request_timeout(
        timed_out$elapsed <= REQUEST_TIMEOUT_MAX_RESPONSE_SEC,
        sprintf(
          "timeout response took %.1f s to arrive; the budget is not being enforced",
          timed_out$elapsed
        )
      )
      cat(sprintf("  timed out in %.1f s\n", timed_out$elapsed))

      # Same server, default budget, a light request: it must still work, so
      # killing the bootstrap run's process tree left nothing broken behind.
      cat("  running a normal analysis on the same server afterwards...\n")
      normal <- time_model_request(
        df_to_json(generate_test_data(n_studies = 20)),
        request_timeout_params(se_treatment = "clustered_cr2")
      )
      expect_request_timeout(
        !is.null(normal$response$data) &&
          is.numeric(normal$response$data$effectEstimate),
        "a normal analysis after a timed-out one should still succeed"
      )
      cat(sprintf("  normal analysis succeeded in %.1f s\n", normal$elapsed))

      # A budget that cannot produce a deadline is a bad request, not a run
      # that goes unbounded. No analysis starts, so this costs nothing.
      cat("  checking that a non-positive budget is rejected...\n")
      rejected <- time_model_request(
        heavy_data,
        request_timeout_params(0)
      )
      expect_request_timeout(
        isTRUE(rejected$response$error) &&
          grepl("timeoutSeconds", rejected$response$message, fixed = TRUE),
        paste(
          "a zero budget should be rejected as an invalid parameter, got:",
          rejected$response$message
        )
      )

      log_test_result(
        test_name, "PASS",
        sprintf(
          "Budget enforced in %.1fs on /run-model; server healthy afterwards",
          timed_out$elapsed
        )
      )

      return(list(
        status = "PASS",
        test_name = test_name
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
