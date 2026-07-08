# Lambda R Backend Handler

# Load required libraries
library(plumber) # nolint: undesirable_function_linter.

#* Echo back the input
#* @usage curl --data "a=4&b=3" "http://localhost:8787/sum"
#* @param msg The message to echo
#* @get /echo
function(msg = "") {
  list(msg = paste0("The message is: '", msg, "'"))
}

#* Health check
#* @get /health
function() {
  list(status = "ok", time = format(Sys.time(), tz = "UTC"))
}

#* Server ping
#* @get /ping
function() {
  list(status = "ok", time = format(Sys.time(), tz = "UTC"))
}

#* Run the model
#* @param data The file data to run the model on, passed as a JSON string
#* @param parameters The parameters to run the model on
#* @post /run-model
function(data, parameters) {
  tryCatch(
    {
      # nolint start: undesirable_function_linter.
      source("maive_model.R")
      # nolint end: undesirable_function_linter.

      if (is.null(data) || is.null(parameters)) {
        cli::cli_abort("Missing data or parameters")
      }

      results <- run_maive_model(data, parameters)
      list(data = results)
    },
    error = function(e) {
      err_message <- conditionMessage(e)
      cli::cli_alert_danger("Error in run-model endpoint: {err_message}")
      cli::cli_h2("Error traceback:")
      cli::cli_code(capture.output(traceback()))
      list(
        error = TRUE,
        message = paste("Internal server error:", err_message)
      )
    }
  )
}

#* Run the RTMA (Right-Truncated Meta-Analysis) model
#* @param data The file data to run the model on, passed as a JSON string
#* @param parameters The parameters to run the model on
#* @post /run-rtma
function(data, parameters) {
  tryCatch(
    {
      # nolint start: undesirable_function_linter.
      source("rtma_model.R")
      # nolint end: undesirable_function_linter.

      if (is.null(data) || is.null(parameters)) {
        cli::cli_abort("Missing data or parameters")
      }

      results <- run_rtma_model(data, parameters)
      list(data = results)
    },
    error = function(e) {
      err_message <- conditionMessage(e)
      cli::cli_alert_danger("Error in run-rtma endpoint: {err_message}")
      cli::cli_h2("Error traceback:")
      cli::cli_code(capture.output(traceback()))
      list(
        error = TRUE,
        message = paste("Internal server error:", err_message)
      )
    }
  )
}

# -- Public /v1 API (docs/PUBLIC_API_DESIGN.md) ------------------------------
# Versioned routes with a plain nested JSON contract, server-side validation,
# parameter defaults, and real HTTP status codes. The legacy routes above are
# untouched; the UI depends on them unchanged.

#* Health check (public /v1 alias of /health)
#* @get /v1/health
function() {
  list(status = "ok", time = format(Sys.time(), tz = "UTC"))
}

#* Run the MAIVE/WAIVE/WLS model via the public /v1 API
#* @param include Set to "plot" to include the funnel plot fields in the response
#* @post /v1/run-model
function(req, res, include = "", ...) {
  # nolint start: undesirable_function_linter.
  source("api_v1.R")
  # nolint end: undesirable_function_linter.
  api_v1_run_model(req, res, include = include)
}

#* Run the RTMA model via the public /v1 API
#* @param include Set to "plot" to include the z-score plot fields in the response
#* @post /v1/run-rtma
function(req, res, include = "", ...) {
  # nolint start: undesirable_function_linter.
  source("api_v1.R")
  # nolint end: undesirable_function_linter.
  api_v1_run_rtma(req, res, include = include)
}
