# RTMA Timeout Test Scenario
#
# run_rtma_model() promises that a fit exceeding params$timeoutSeconds comes
# back as "RTMA timed out after N seconds." rather than running until the
# platform kills the process. setTimeLimit could not keep that promise: R
# checks elapsed-time limits only at R-level interrupt points, which a running
# Stan chain never crosses (#518, section 4), so the error arrived, if at all,
# only once the fit it was supposed to interrupt had finished. The fit now runs
# in a forked child the handler kills at the deadline, Stan workers included.
#
# What this scenario pins down, end to end through the server:
#   * an impossible budget produces the documented error, and produces it
#     sooner than the same request takes to succeed. That comparison is the
#     assertion that would have failed before the fork: the old code could only
#     report the timeout after the full fit, so the "timed out" response was
#     always the slower of the two.
#   * the same server then serves a normal fit, so killing a child mid-sample
#     leaves no wreckage behind (orphaned workers competing for the container's
#     CPU, broken parallel bookkeeping).
#   * a budget that is not a positive number is rejected as a bad parameter
#     instead of producing a deadline nothing can satisfy.

# Budget for the request that must time out. Well under the fastest possible
# fit on this fixture (sampling alone takes seconds), so a timeout is the only
# correct outcome, and it is what the response message is asserted to name.
RTMA_TIMEOUT_BUDGET_SEC <- 0.2

# Absolute ceiling on how late the timeout response may arrive. The deadline is
# enforced to about a quarter second, but the request also pays HTTP, JSON and
# fork overhead, and CI machines are slow; the sharp assertion is the
# comparison against the successful fit, not this bound.
RTMA_TIMEOUT_MAX_RESPONSE_SEC <- 30

#' Fail with a message unless a condition holds
#' @param condition Condition that must be TRUE
#' @param message Failure message
expect_rtma_timeout <- function(condition, message) {
  if (!isTRUE(condition)) {
    stop(message)
  }
}

#' Build RTMA parameter JSON for the timeout scenario
#' @param timeout_seconds Wall-clock budget to request, or NULL for the default
#' @return JSON string of parameters
rtma_timeout_params <- function(timeout_seconds = NULL) {
  params <- list(
    modelType = "RTMA",
    favorPositive = TRUE,
    alphaSelect = 0.05,
    ciLevel = 0.95,
    winsorize = 0
  )
  if (!is.null(timeout_seconds)) {
    params$timeoutSeconds <- timeout_seconds
  }
  params_to_json(params)
}

#' POST /run-rtma and report how long the response took to arrive
#' @param data_json JSON string of the dataset
#' @param timeout_seconds Wall-clock budget to request, or NULL for the default
#' @return list(response = <parsed body>, elapsed = <seconds>)
time_rtma_request <- function(data_json, timeout_seconds = NULL) {
  started <- Sys.time()
  response <- test_run_rtma(data_json, rtma_timeout_params(timeout_seconds))
  list(
    response = response,
    elapsed = as.numeric(difftime(Sys.time(), started, units = "secs"))
  )
}

#' Test that the RTMA wall-clock budget is enforced
#' @return Test results
test_rtma_timeout <- function() {
  test_name <- "RTMA Timeout Test"

  tryCatch(
    {
      data_json <- df_to_json(generate_rtma_test_data())

      cat(sprintf(
        "  requesting a fit with a %s second budget...\n",
        RTMA_TIMEOUT_BUDGET_SEC
      ))
      timed_out <- time_rtma_request(data_json, RTMA_TIMEOUT_BUDGET_SEC)

      # The legacy route reports handler errors as a 200 with an error flag.
      expect_rtma_timeout(
        isTRUE(timed_out$response$error),
        sprintf(
          "a %s second budget should time the fit out, but the request returned results",
          RTMA_TIMEOUT_BUDGET_SEC
        )
      )
      expect_rtma_timeout(
        grepl(
          sprintf("RTMA timed out after %s seconds", RTMA_TIMEOUT_BUDGET_SEC),
          timed_out$response$message,
          fixed = TRUE
        ),
        paste(
          "timeout error should carry the documented message, got:",
          timed_out$response$message
        )
      )
      expect_rtma_timeout(
        timed_out$elapsed <= RTMA_TIMEOUT_MAX_RESPONSE_SEC,
        sprintf(
          "timeout response took %.1f s to arrive; the budget is not being enforced",
          timed_out$elapsed
        )
      )
      cat(sprintf("  timed out in %.1f s\n", timed_out$elapsed))

      # Same server, same data, no budget: it must still fit, and it must take
      # longer than the request that gave up on it.
      cat("  running a normal fit on the same server afterwards...\n")
      normal <- time_rtma_request(data_json)
      expect_rtma_timeout(
        !is.null(normal$response$data) && is.numeric(normal$response$data$mu),
        "a normal fit after a timed-out one should still succeed"
      )
      expect_rtma_timeout(
        timed_out$elapsed < normal$elapsed,
        sprintf(
          paste(
            "the timed-out request took %.1f s and the fit it gave up on took %.1f s;",
            "the deadline is not interrupting the fit"
          ),
          timed_out$elapsed,
          normal$elapsed
        )
      )
      cat(sprintf("  normal fit succeeded in %.1f s\n", normal$elapsed))

      # A budget that cannot produce a deadline is a bad request, not a fit
      # that runs forever. No fit starts, so this costs nothing.
      cat("  checking that a non-positive budget is rejected...\n")
      rejected <- time_rtma_request(data_json, 0)
      expect_rtma_timeout(
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
          "Budget enforced in %.1fs against a %.1fs fit; server healthy afterwards",
          timed_out$elapsed,
          normal$elapsed
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
