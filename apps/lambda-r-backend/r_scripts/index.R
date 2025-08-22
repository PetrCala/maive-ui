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
      cli::cli_alert_danger("Error in run-model endpoint: {e$message}")
      cli::cli_h2("Error traceback:")
      cli::cli_code(capture.output(traceback()))
      list(
        error = TRUE,
        message = paste("Internal server error:", e$message)
      )
    }
  )
}
