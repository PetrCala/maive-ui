# Structured per-request logging for the model routes (#532)
#
# During the Aug 15 investigation the R output in CloudWatch could not be tied
# to individual requests: cli alerts carry no request id, so there was no way
# to tell which log lines belonged to which run. Every model request now emits
# exactly one JSON line on stdout with the fields an incident query needs:
#
#   {"requestId": "...", "endpoint": "/run-model", "k": 120,
#    "method": "PET-PEESE", "rtma": false, "outcome": "timeout",
#    "durationSec": 121.3}
#
# The line is a pure JSON log event, so CloudWatch Logs Insights discovers the
# fields automatically, e.g.:
#
#   fields requestId, endpoint, k, method, outcome, durationSec
#   | filter ispresent(outcome) | filter outcome != "ok"
#   | sort durationSec desc
#
# Usage in a route handler:
#   log_ctx <- request_log_context(req, "/run-model", rtma = FALSE)
#   on.exit(request_log_emit(log_ctx), add = TRUE)
#   ... request_log_note(log_ctx, k = ..., method = ..., outcome = ...) ...
#
# The context defaults outcome to "error", so a request that fails before the
# handler reaches its outcome mapping still logs a line and logs it as an
# error. Emission is wrapped in tryCatch: logging must never break a request.

# Outcome values the log line may carry. run_request_bounded()'s "died" status
# collapses into "error": for an incident query the distinction lives in the
# cli alerts, and three values keep the outcome field trivially groupable.
REQUEST_LOG_OUTCOMES <- c("ok", "timeout", "error")

#' Map a run_request_bounded() status to a log outcome
#'
#' @param status The status field of a run_request_bounded() outcome
#' @return One of "ok", "timeout" or "error"
request_log_outcome <- function(status) {
  if (is.character(status) && length(status) == 1 && status %in% c("ok", "timeout")) {
    return(status)
  }
  "error"
}

#' Extract the Lambda request id from the request headers
#'
#' The Lambda Web Adapter forwards the invocation context to the app as JSON
#' in the x-amzn-lambda-context header (request_id) and the Function URL
#' request context in x-amzn-request-context (requestId). Local dev has
#' neither, so the id degrades to NA rather than failing.
#'
#' @param req Plumber request object
#' @return The request id as a string, or NA_character_ when unavailable
request_log_request_id <- function(req) {
  headers <- c("HTTP_X_AMZN_LAMBDA_CONTEXT", "HTTP_X_AMZN_REQUEST_CONTEXT")
  for (header in headers) {
    raw <- tryCatch(req[[header]], error = function(e) NULL)
    if (is.null(raw) || !is.character(raw) || !nzchar(raw)) {
      next
    }
    parsed <- tryCatch(jsonlite::fromJSON(raw), error = function(e) NULL)
    if (!is.list(parsed)) {
      next
    }
    for (field in c("request_id", "requestId")) {
      id <- parsed[[field]]
      if (is.character(id) && length(id) == 1 && nzchar(id)) {
        return(id)
      }
    }
  }
  NA_character_
}

#' Create the log context for one model request
#'
#' @param req Plumber request object; the request id is read from its headers
#' @param endpoint Route path logged as the endpoint field
#' @param rtma Whether the request runs the RTMA model
#' @return Mutable context environment for request_log_note()/request_log_emit()
request_log_context <- function(req, endpoint, rtma) {
  ctx <- new.env(parent = emptyenv())
  ctx$request_id <- tryCatch(
    request_log_request_id(req),
    error = function(e) NA_character_
  )
  ctx$endpoint <- endpoint
  ctx$rtma <- isTRUE(rtma)
  ctx$k <- NA_integer_
  ctx$method <- NA_character_
  ctx$outcome <- "error"
  ctx$started <- Sys.time()
  ctx
}

#' Record fields on a request log context
#'
#' Each argument is applied only when it carries a usable scalar, so callers
#' can pass whatever they extracted without guarding every call site.
#'
#' @param ctx Context from request_log_context()
#' @param k Number of rows (estimates) in the request dataset
#' @param method MAIVE method requested (PET, PEESE, PET-PEESE, EK)
#' @param outcome One of REQUEST_LOG_OUTCOMES
request_log_note <- function(ctx, k = NULL, method = NULL, outcome = NULL) {
  if (is.numeric(k) && length(k) == 1 && is.finite(k) && k > 0) {
    ctx$k <- as.integer(k)
  }
  if (is.character(method) && length(method) == 1 && nzchar(method)) {
    ctx$method <- method
  }
  if (is.character(outcome) && length(outcome) == 1 && outcome %in% REQUEST_LOG_OUTCOMES) {
    ctx$outcome <- outcome
  }
  invisible(ctx)
}

#' Record k and method from an already-parsed /v1 request body
#'
#' The /v1 handlers parse the body inside the bounded child process, whose
#' state never comes back to the serving process on the paths that matter most
#' (timeouts, kills). Plumber has already parsed the JSON body into req$body
#' in the serving process, so the log fields are lifted from there at no extra
#' parse cost. Best effort: a body the model layer would reject just leaves
#' the fields at NA.
#'
#' @param ctx Context from request_log_context()
#' @param req Plumber request object
request_log_note_v1_body <- function(ctx, req) {
  tryCatch(
    {
      body <- req$body
      if (!is.list(body)) {
        return(invisible(ctx))
      }
      data <- body$data
      k <- if (is.data.frame(data)) {
        nrow(data)
      } else if (is.list(data)) {
        length(data)
      } else {
        NULL
      }
      params <- body$parameters
      method <- if (is.list(params)) params$maiveMethod else NULL
      request_log_note(ctx, k = k, method = method)
    },
    error = function(e) NULL
  )
  invisible(ctx)
}

#' Record the method from a legacy route's parameters JSON string
#'
#' @param ctx Context from request_log_context()
#' @param parameters_json The raw parameters JSON string the route received
request_log_note_legacy_params <- function(ctx, parameters_json) {
  params <- tryCatch(
    jsonlite::fromJSON(parameters_json),
    error = function(e) NULL
  )
  if (is.list(params)) {
    request_log_note(ctx, method = params$maiveMethod)
  }
  invisible(ctx)
}

#' Emit the single JSON log line for one request
#'
#' Meant to run from on.exit() in the route handler, so exactly one line is
#' written per request on every exit path. Never throws.
#'
#' @param ctx Context from request_log_context()
request_log_emit <- function(ctx) {
  tryCatch(
    {
      duration <- as.numeric(difftime(Sys.time(), ctx$started, units = "secs"))
      line <- jsonlite::toJSON(
        list(
          requestId = ctx$request_id,
          endpoint = ctx$endpoint,
          k = ctx$k,
          method = ctx$method,
          rtma = ctx$rtma,
          outcome = ctx$outcome,
          durationSec = round(duration, 3)
        ),
        auto_unbox = TRUE,
        na = "null"
      )
      writeLines(as.character(line))
    },
    error = function(e) {
      cli::cli_alert_warning("Request log line failed: {conditionMessage(e)}")
    }
  )
  invisible(ctx)
}
