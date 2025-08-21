# Lambda R Backend Handler
# This replaces the plumber API with a Lambda function

# Load required libraries
library(jsonlite)
library(cli)

# Lambda handler function
handler <- function(event, context) {
  tryCatch(
    {
      # Parse the incoming event
      http_method <- event$httpMethod
      path <- event$path

      # Route based on path and method
      if (path == "/ping" && http_method == "GET") {
        return(handle_ping())
      } else if (path == "/run-model" && http_method == "POST") {
        return(handle_run_model(event$body))
      } else if (path == "/echo" && http_method == "GET") {
        return(handle_echo(event$queryStringParameters$msg))
      } else {
        return(create_response(404, list(error = TRUE, message = "Endpoint not found")))
      }
    },
    error = function(e) {
      cli::cli_alert_danger("Lambda handler error: {e$message}")
      create_response(500, list(error = TRUE, message = paste("Internal server error:", e$message)))
    }
  )
}

# Health check endpoint
handle_ping <- function() {
  create_response(200, list(status = "ok", time = format(Sys.time(), tz = "UTC")))
}

# Echo endpoint
handle_echo <- function(msg = "") {
  create_response(200, list(msg = paste0("The message is: '", msg, "'")))
}

# Main model execution endpoint
handle_run_model <- function(body) {
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
        return(create_response(400, list(error = TRUE, message = "Missing data or parameters")))
      }

      # Run the MAIVE model
      results <- run_maive_model(data, parameters)

      return(create_response(200, list(data = results)))
    },
    error = function(e) {
      cli::cli_alert_danger("Error in run-model: {e$message}")
      create_response(500, list(error = TRUE, message = paste("Model execution error:", e$message)))
    }
  )
}

# Create HTTP response
create_response <- function(status_code, body) {
  list(
    statusCode = status_code,
    headers = list(
      "Content-Type" = "application/json",
      "Access-Control-Allow-Origin" = "*",
      "Access-Control-Allow-Headers" = "Content-Type",
      "Access-Control-Allow-Methods" = "GET,POST,OPTIONS"
    ),
    body = toJSON(body, auto_unbox = TRUE)
  )
}

# Export the handler for Lambda
exports.handler <- handler
