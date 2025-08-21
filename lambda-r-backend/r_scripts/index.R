# Lambda R Backend Handler
# This replaces the plumber API with a Lambda function

# Load required libraries
library(plumber)

#* Echo back the input
#* @usage curl --data "a=4&b=3" "http://localhost:8787/sum"
#* @param msg The message to echo
#* @get /echo
function(msg = "") {
  list(msg = paste0("The message is: '", msg, "'"))
}

#* Health check
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

      # Parse JSON body
      if (is.character(body)) {
        body_data <- fromJSON(body)
      } else {
        body_data <- body
      }

      # Extract data and parameters
      data <- body_data$data
      parameters <- body_data$parameters

      if (is.null(data) || is.null(parameters)) {
        return(list(error = TRUE, message = "Missing data or parameters"))
      }

      results <- run_maive_model(data, parameters)
      return(list(data = results))
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
