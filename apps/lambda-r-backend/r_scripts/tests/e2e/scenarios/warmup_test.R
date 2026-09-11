# Warm-up Hold Test Scenario
#
# /warmup exists for scripts/warmLambdas.sh: it keeps a Lambda container busy
# for a few seconds so that concurrent warm-up requests each land on their own
# container instead of queueing behind one that is already warm. The cap is the
# part that matters for cost: the route must never hold a container for longer
# than 5 s, whatever the caller asks for.
#
# What this scenario pins down:
#   * a requested hold is honoured and echoed back in `held`
#   * a request above the cap is clamped to 5 s, both in `held` and in how long
#     the response takes to arrive
#   * a missing, negative or non-numeric value holds for 0 s

WARMUP_MAX_HOLD_SEC <- 5
# Slack for request overhead when checking how long a clamped hold took.
WARMUP_TIMING_SLACK_SEC <- 1.5

#' Fail with a message unless a condition holds
#' @param condition Condition that must be TRUE
#' @param message Failure message
expect_warmup <- function(condition, message) {
  if (!isTRUE(condition)) {
    stop(message)
  }
}

#' Describe a seconds value for failure messages
#' @param seconds Value sent as the seconds query parameter, or NULL
#' @return A printable string
warmup_label <- function(seconds) {
  if (is.null(seconds)) "<missing>" else as.character(seconds)
}

#' GET /warmup and time the response
#' @param seconds Value for the seconds query parameter, or NULL to omit it
#' @return List with the echoed hold (`held`) and wall-clock time (`elapsed`)
warmup_request <- function(seconds = NULL) {
  query <- if (is.null(seconds)) list() else list(seconds = seconds)
  started <- Sys.time()
  response <- httr::GET(
    paste0(API_BASE_URL, "/warmup"),
    query = query,
    httr::timeout(30)
  )
  elapsed <- as.numeric(difftime(Sys.time(), started, units = "secs"))
  expect_warmup(
    httr::status_code(response) == 200,
    sprintf(
      "/warmup with seconds=%s returned status %d",
      warmup_label(seconds), httr::status_code(response)
    )
  )
  body <- httr::content(response, "parsed")
  list(held = as.numeric(unlist(body$held)), elapsed = elapsed)
}

test_warmup <- function() {
  test_name <- "Warm-up Hold Test"

  tryCatch(
    {
      one <- warmup_request(1)
      expect_warmup(
        identical(one$held, 1),
        paste("a 1 s hold should echo held = 1, got:", format(one$held))
      )
      expect_warmup(
        one$elapsed >= 1,
        sprintf("a 1 s hold returned after only %.2f s", one$elapsed)
      )
      cat(sprintf("  1 s hold returned after %.2f s\n", one$elapsed))

      capped <- warmup_request(60)
      expect_warmup(
        identical(capped$held, WARMUP_MAX_HOLD_SEC),
        paste(
          "a 60 s request should be clamped to", WARMUP_MAX_HOLD_SEC,
          "s, got held =", format(capped$held)
        )
      )
      expect_warmup(
        capped$elapsed < WARMUP_MAX_HOLD_SEC + WARMUP_TIMING_SLACK_SEC,
        sprintf(
          "a clamped hold took %.1f s; the %s s cap is not being enforced",
          capped$elapsed, WARMUP_MAX_HOLD_SEC
        )
      )
      cat(sprintf("  60 s request clamped, returned after %.2f s\n", capped$elapsed))

      for (seconds in list(NULL, -3, "abc")) {
        zero <- warmup_request(seconds)
        expect_warmup(
          identical(zero$held, 0),
          sprintf(
            "seconds=%s should hold 0 s, got held = %s",
            warmup_label(seconds), format(zero$held)
          )
        )
      }
      cat("  missing, negative and non-numeric values hold 0 s\n")

      list(status = "PASS", test_name = test_name)
    },
    error = function(e) {
      list(status = "FAIL", test_name = test_name, error = e$message)
    }
  )
}
