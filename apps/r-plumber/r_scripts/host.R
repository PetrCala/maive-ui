cli::cli_alert_info("In host.R")

library("plumber") # nolint: undesirable_function_linter.
cli::cli_alert_success("Plumber library successfully loaded")

R_HOST <- Sys.getenv("R_HOST")
R_PORT <- as.numeric(Sys.getenv("R_PORT"))

pr <- plumb("executables/plumber.R")

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
    return(res)
  }

  # 3. Otherwise continue down the chain
  forward()
})

pr$run(host = R_HOST, port = R_PORT)
