# Request Log Test Scenario (#532)
#
# Every model request emits exactly one structured JSON line (request_log.R)
# so CloudWatch Logs Insights can tie R output to individual requests. The
# server's stdout is not observable over HTTP, so this scenario exercises the
# helpers directly: it sources request_log.R and asserts on the emitted line.
#
# What this scenario pins down:
#   * the emitted line is a single, pure JSON log event carrying exactly the
#     incident-query fields: requestId, endpoint, k, method, rtma, outcome,
#     durationSec, inputHash
#   * the request id is read from the Lambda Web Adapter context headers and
#     degrades to null outside Lambda
#   * the caller-computed input hash (#529) is read from x-maive-input-hash
#     and degrades to null when absent
#   * outcomes map to ok/timeout/error, with unknown statuses (died included)
#     collapsing to error, and a request that never reached its outcome
#     mapping logging error by default
#   * k and method are lifted from a plumber-parsed /v1 body in both shapes
#     plumber produces (data frame rows and row-object lists)

#' Fail with a message unless a condition holds
#' @param condition Condition that must be TRUE
#' @param message Failure message
expect_request_log <- function(condition, message) {
  if (!isTRUE(condition)) {
    stop(message)
  }
}

#' Source request_log.R into a private environment
#' @return Environment containing the request log helpers
request_log_helpers <- function() {
  helpers <- new.env()
  source(file.path("..", "..", "request_log.R"), local = helpers)
  helpers
}

#' Build a fake plumber request environment
#' @param headers Named list of header fields to set on the request
#' @return Environment mimicking a plumber req object
request_log_fake_req <- function(headers = list()) {
  req <- new.env()
  for (name in names(headers)) {
    assign(name, headers[[name]], envir = req)
  }
  req
}

#' Capture the single line request_log_emit() writes for a context
#' @param helpers Environment from request_log_helpers()
#' @param ctx Context from request_log_context()
#' @return The parsed JSON line as a named list
request_log_capture_line <- function(helpers, ctx) {
  lines <- capture.output(helpers$request_log_emit(ctx))
  expect_request_log(
    length(lines) == 1,
    sprintf("Exactly one log line must be emitted per request; got %d", length(lines))
  )
  parsed <- tryCatch(
    jsonlite::fromJSON(lines[1], simplifyVector = FALSE),
    error = function(e) NULL
  )
  expect_request_log(
    is.list(parsed),
    paste("The log line must be valid JSON; got:", lines[1])
  )
  parsed
}

#' Run the request log test scenario
#' @return Test result list
test_request_log <- function() {
  test_name <- "Request Log Test"

  tryCatch(
    {
      cat("Running request log test...\n")

      helpers <- request_log_helpers()

      # Outcome mapping: ok and timeout pass through, everything else
      # (died, garbage, missing) collapses to error.
      expect_request_log(
        identical(helpers$request_log_outcome("ok"), "ok"),
        "Outcome ok must map to ok"
      )
      expect_request_log(
        identical(helpers$request_log_outcome("timeout"), "timeout"),
        "Outcome timeout must map to timeout"
      )
      expect_request_log(
        identical(helpers$request_log_outcome("died"), "error"),
        "Outcome died must collapse to error"
      )
      expect_request_log(
        identical(helpers$request_log_outcome(NULL), "error"),
        "A missing outcome status must collapse to error"
      )

      # Request id from the Lambda Web Adapter context headers.
      lambda_req <- request_log_fake_req(list(
        HTTP_X_AMZN_LAMBDA_CONTEXT = '{"request_id":"lambda-req-1"}',
        HTTP_X_MAIVE_INPUT_HASH = "abc123hash"
      ))
      expect_request_log(
        identical(helpers$request_log_request_id(lambda_req), "lambda-req-1"),
        "The request id must be read from x-amzn-lambda-context"
      )
      url_req <- request_log_fake_req(list(
        HTTP_X_AMZN_REQUEST_CONTEXT = '{"requestId":"url-req-1"}'
      ))
      expect_request_log(
        identical(helpers$request_log_request_id(url_req), "url-req-1"),
        "The request id must fall back to x-amzn-request-context"
      )
      expect_request_log(
        is.na(helpers$request_log_request_id(request_log_fake_req())),
        "Outside Lambda the request id must degrade to NA"
      )

      # Input hash from the caller's x-maive-input-hash header (#529).
      expect_request_log(
        identical(helpers$request_log_input_hash(lambda_req), "abc123hash"),
        "The input hash must be read from x-maive-input-hash"
      )
      expect_request_log(
        is.na(helpers$request_log_input_hash(request_log_fake_req())),
        "Without the header the input hash must degrade to NA"
      )

      # A full context round trip: noted fields land in the line, and the
      # line carries exactly the incident-query fields.
      ctx <- helpers$request_log_context(lambda_req, "/run-model", rtma = FALSE)
      helpers$request_log_note(ctx, k = 120, method = "PET-PEESE", outcome = "timeout")
      line <- request_log_capture_line(helpers, ctx)

      expected_fields <- c(
        "requestId", "endpoint", "k", "method", "rtma", "outcome",
        "durationSec", "inputHash"
      )
      expect_request_log(
        identical(sort(names(line)), sort(expected_fields)),
        sprintf(
          "The log line must carry exactly the fields %s; got %s",
          paste(expected_fields, collapse = ", "),
          paste(names(line), collapse = ", ")
        )
      )
      expect_request_log(
        identical(line$requestId, "lambda-req-1"),
        "The log line must carry the request id"
      )
      expect_request_log(
        identical(line$endpoint, "/run-model"),
        "The log line must carry the endpoint"
      )
      expect_request_log(
        identical(line$k, 120L),
        "The log line must carry k as an integer"
      )
      expect_request_log(
        identical(line$method, "PET-PEESE"),
        "The log line must carry the method"
      )
      expect_request_log(
        identical(line$rtma, FALSE),
        "The log line must carry the rtma flag"
      )
      expect_request_log(
        identical(line$outcome, "timeout"),
        "The log line must carry the noted outcome"
      )
      expect_request_log(
        is.numeric(line$durationSec) && line$durationSec >= 0,
        "The log line must carry a non-negative duration"
      )
      expect_request_log(
        identical(line$inputHash, "abc123hash"),
        "The log line must carry the input hash"
      )

      # A context that never reaches its outcome mapping logs an error, and
      # unnoted fields serialize as null rather than being dropped.
      bare_ctx <- helpers$request_log_context(
        request_log_fake_req(), "/v1/run-rtma",
        rtma = TRUE
      )
      bare_line <- request_log_capture_line(helpers, bare_ctx)
      expect_request_log(
        identical(bare_line$outcome, "error"),
        "A request that never noted an outcome must log error"
      )
      expect_request_log(
        is.null(bare_line$requestId) && is.null(bare_line$k) && is.null(bare_line$method),
        "Unknown requestId, k and method must serialize as null"
      )
      expect_request_log(
        is.null(bare_line$inputHash),
        "An unknown input hash must serialize as null"
      )
      expect_request_log(
        identical(bare_line$rtma, TRUE),
        "The rtma flag must be TRUE on the RTMA endpoints"
      )

      # Invalid notes must not clobber recorded state.
      helpers$request_log_note(ctx, k = -1, method = character(0), outcome = "exploded")
      expect_request_log(
        identical(ctx$k, 120L) && identical(ctx$method, "PET-PEESE") &&
          identical(ctx$outcome, "timeout"),
        "Invalid note values must leave recorded fields untouched"
      )

      # k and method lifted from a plumber-parsed /v1 body, in both body
      # shapes plumber produces.
      df_req <- request_log_fake_req(list(
        body = list(
          data = data.frame(effect = c(1, 2, 3), se = c(0.1, 0.2, 0.3)),
          parameters = list(maiveMethod = "EK")
        )
      ))
      df_ctx <- helpers$request_log_context(df_req, "/v1/run-model", rtma = FALSE)
      helpers$request_log_note_v1_body(df_ctx, df_req)
      expect_request_log(
        identical(df_ctx$k, 3L) && identical(df_ctx$method, "EK"),
        "k and method must be lifted from a data frame body"
      )

      rows_req <- request_log_fake_req(list(
        body = list(
          data = list(
            list(effect = 1, se = 0.1),
            list(effect = 2, se = 0.2)
          ),
          parameters = list()
        )
      ))
      rows_ctx <- helpers$request_log_context(rows_req, "/v1/run-rtma", rtma = TRUE)
      helpers$request_log_note_v1_body(rows_ctx, rows_req)
      expect_request_log(
        identical(rows_ctx$k, 2L) && is.na(rows_ctx$method),
        "k must be lifted from a row-object body, method staying NA"
      )

      # Legacy parameters JSON string.
      legacy_ctx <- helpers$request_log_context(
        request_log_fake_req(), "/run-model",
        rtma = FALSE
      )
      helpers$request_log_note_legacy_params(
        legacy_ctx, '{"maiveMethod":"PEESE","timeoutSeconds":30}'
      )
      expect_request_log(
        identical(legacy_ctx$method, "PEESE"),
        "The method must be lifted from a legacy parameters JSON string"
      )
      helpers$request_log_note_legacy_params(legacy_ctx, "not json")
      expect_request_log(
        identical(legacy_ctx$method, "PEESE"),
        "Unparseable legacy parameters must leave the method untouched"
      )

      log_test_result(
        test_name, "PASS",
        "One valid JSON line per request with the expected fields"
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
