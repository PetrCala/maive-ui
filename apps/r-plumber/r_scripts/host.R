cli::cli_alert_info("In host.R")

library("plumber") # nolint: undesirable_function_linter.
cli::cli_alert_success("Plumber library successfully loaded")

parse_environment_variables <- function() {
  cli::cli_alert_info("Parsing environment variables...")

  # Parse R_HOST
  r_host <- Sys.getenv("R_HOST")
  cli::cli_alert_info("R_HOST environment variable: '{r_host}' (type: {typeof(r_host)})")

  # Parse R_PORT
  r_port_raw <- Sys.getenv("R_PORT")
  r_port <- as.numeric(r_port_raw)
  cli::cli_alert_info("R_PORT environment variable: '{r_port_raw}' -> parsed as: {r_port} (type: {typeof(r_port)})")

  # Validate the parsed values
  if (is.na(r_host) || r_host == "") {
    cli::cli_alert_danger("R_HOST is missing or empty! This will cause connection issues.")
  } else {
    cli::cli_alert_success("R_HOST is set to: {r_host}")
  }

  if (is.na(r_port) || r_port <= 0) {
    cli::cli_alert_danger("R_PORT is missing, invalid, or <= 0! This will cause connection issues.")
  } else {
    cli::cli_alert_success("R_PORT is set to: {r_port}")
  }

  # Return the parsed values
  list(host = r_host, port = r_port)
}

# Parse environment variables
env_vars <- parse_environment_variables()
R_HOST <- env_vars$host
R_PORT <- env_vars$port

cli::cli_alert_info("Starting plumber server...")

pr <- plumber::plumb("executables/plumber.R")
pr$setSerializer(plumber::serializer_unboxed_json())

# ---- GLOBAL CORS FILTER -------------------------------------------------
pr$filter("cors", function(req, res) {
  # 1. CORS headers for every response
  res$setHeader("Access-Control-Allow-Origin", "*")
  res$setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
  res$setHeader(
    "Access-Control-Allow-Headers",
    req$HTTP_ACCESS_CONTROL_REQUEST_HEADERS %||% "Content-Type, Authorization"
  )

  # 2. If this is the pre-flight, return a blank 200 *right now*
  if (identical(req$REQUEST_METHOD, "OPTIONS")) {
    res$status <- 200
    res$body <- ""
    return(res)
  }

  # 3. Otherwise continue down the chain
  forward()
})

pr$run(host = R_HOST, port = R_PORT)
