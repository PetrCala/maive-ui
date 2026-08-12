# RTMA Timeout Test Scenario
#
# run_rtma_model() promises that a fit exceeding params$timeoutSeconds fails
# with a clean "RTMA timed out after N seconds." error instead of hanging until
# the platform kills the process. setTimeLimit could not keep that promise: R
# only checks elapsed limits at R-level interrupt points, which a running Stan
# chain never crosses (docs/RTMA_PERFORMANCE.md, section 4). The fit therefore
# runs in a forked child that the handler kills at the deadline, workers
# included. This scenario locks the contract in end to end:
#   * a budget far below any real fit's runtime produces the documented error,
#     near the deadline rather than whenever the chains happen to finish;
#   * the same server then serves a normal fit, so the kill left no broken
#     state behind (stray children, corrupted parallel bookkeeping).

#' Build RTMA parameter JSON for the timeout scenario
#' @param timeout_seconds Optional wall-clock budget to request
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

#' Test that the RTMA wall-clock budget is enforced
#' @return Test results
test_rtma_timeout <- function() {
  test_name <- "RTMA Timeout Test"

  tryCatch(
    {
      test_data <- generate_rtma_test_data()
      data_json <- df_to_json(test_data)

      # 0.2 s is far below the fastest possible fit (sampling alone takes over
      # a second on this fixture), so the only correct outcome is a timeout.
      cat("Requesting an RTMA fit with a 0.2 second budget...\n")
      started <- Sys.time()
      response <- test_run_rtma(data_json, rtma_timeout_params(0.2))
      elapsed <- as.numeric(difftime(Sys.time(), started, units = "secs"))

      # The legacy route reports handler errors as a 200 with an error flag.
      if (!isTRUE(response$error)) {
        stop(paste(
          "A 0.2 second budget should time the fit out,",
          "but the request returned results"
        ))
      }
      if (!grepl("RTMA timed out after 0.2 seconds", response$message, fixed = TRUE)) {
        stop(paste(
          "Timeout error should carry the documented message, got:",
          response$message
        ))
      }
      # Generous bound; the enforcement granularity is about a second, and the
      # request also pays JSON and HTTP overhead. What must never happen is the
      # pre-fork behaviour, where the response arrived only after the full fit.
      if (elapsed > 30) {
        stop(sprintf(
          "Timeout response took %.1f s to arrive; the budget is not being enforced",
          elapsed
        ))
      }
      cat(sprintf("Timed out cleanly in %.1f s\n", elapsed))

      # The kill must not damage the serving process: the same container
      # handles the next request, so a normal fit must still work.
      cat("Running a normal fit on the same server afterwards...\n")
      normal_response <- test_run_rtma(data_json, rtma_timeout_params())
      if (
        is.null(normal_response$data) ||
          !is.numeric(normal_response$data$mu)
      ) {
        stop("A normal fit after a timed-out one should still succeed")
      }

      log_test_result(
        test_name, "PASS",
        "Timeout budget enforced and server healthy afterwards"
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
