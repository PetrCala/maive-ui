# Lambda R Backend Handler
# Used for local development

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

pr <- plumber::plumb("index.R")
pr$setSerializer(plumber::serializer_unboxed_json())

# ---- GLOBAL CORS FILTER -------------------------------------------------
`%||%` <- function(a, b) if (is.null(a) || length(a) == 0 || identical(a, "")) b else a # nolint: object_name_linter.

pr$filter("cors", function(req, res) {
  # default to empty string when Origin is absent
  origin <- req$HTTP_ORIGIN %||% ""

  # only enable permissive CORS for localhost during local dev
  if (nzchar(origin) & grepl("localhost", origin, fixed = TRUE)) {
    res$setHeader("Access-Control-Allow-Origin", origin) # or "*" if you prefer
    res$setHeader("Vary", "Origin")
    res$setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
    res$setHeader(
      "Access-Control-Allow-Headers",
      req$HTTP_ACCESS_CONTROL_REQUEST_HEADERS %||% "Content-Type, Authorization"
    )

    # short-circuit preflight
    if (identical(req$REQUEST_METHOD, "OPTIONS")) {
      res$status <- 204
      res$body <- ""
      return(res)
    }
  }

  # always continue down the chain
  forward()
})

# ---- GLOBAL ERROR HANDLER ------------------------------------------------
# Body parsing runs before route handlers, so a malformed JSON body never
# reaches the /v1 handlers' own error mapping and would surface as plumber's
# default 500. Give /v1 requests the structured envelope (see
# docs/PUBLIC_API_DESIGN.md section 6.1); keep plumber's default shape for all
# other routes so legacy behavior is unchanged.
pr$setErrorHandler(function(req, res, err) {
  err_message <- conditionMessage(err)
  path <- req$PATH_INFO %||% ""

  if (startsWith(path, "/v1/")) {
    is_parse_error <- grepl(
      "lexical error|parse error|invalid|unexpected",
      err_message,
      ignore.case = TRUE
    )
    if (is_parse_error) {
      res$status <- 400L
      return(list(error = list(
        code = "validation_error",
        message = paste0(
          "Request body must be valid JSON of the form ",
          "{\"data\": [...], \"parameters\": {...}}."
        )
      )))
    }
    cli::cli_alert_danger("Unhandled error on {path}: {err_message}")
    res$status <- 500L
    return(list(error = list(
      code = "internal_error",
      message = "Internal server error."
    )))
  }

  cli::cli_alert_danger("Unhandled error on {path}: {err_message}")
  res$status <- 500L
  list(error = "500 - Internal server error")
})

# ---- PRELOAD PHACKING (issue #483, section 1) -----------------------------
# rtma_model.R:5 runs `library(phacking)` at source() time, and index.R /
# api_v1.R source() it on every RTMA request. Loading the namespace costs
# ~11s, and ragg's first text render separately warms a font cache. Without
# this, whichever request happens to be the first RTMA call served by a given
# Lambda container pays both costs. Preload here, once per container, before
# plumber starts listening, so no request pays them.
#
# Trade-off: every container now pays this preload, including ones that end
# up serving only MAIVE requests, so a cold MAIVE-only container also waits
# behind it. A scheduled /health keep-warm ping (also proposed in #483) would
# avoid this by keeping containers warm instead of letting them go cold; that
# is left as a follow-up, not implemented here.
cli::cli_alert_info("Preloading phacking and warming ragg font cache...")
preload_start <- Sys.time()

tryCatch(
  {
    # nolint start: undesirable_function_linter.
    source("rtma_model.R")
    # nolint end: undesirable_function_linter.
    render_z_density_plot(yi = c(-2, -1, 0, 1, 2), vi = c(1, 1, 1, 1, 1))
  },
  error = function(e) {
    cli::cli_alert_danger("Phacking preload failed: {conditionMessage(e)}")
  }
)

preload_elapsed <- round(as.numeric(Sys.time() - preload_start, units = "secs"), 2)
cli::cli_alert_success("Phacking preload finished in {preload_elapsed}s")

pr$run(host = R_HOST, port = R_PORT)
