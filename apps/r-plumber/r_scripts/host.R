# host.R

cli::cli_alert_info("In host.R")

library("plumber") # nolint: undesirable_function_linter.
cli::cli_alert_success("Plumber library successfully loaded")

# Load the docker-compose environment variables
R_HOST <- Sys.getenv("R_HOST")
R_PORT <- as.numeric(Sys.getenv("R_PORT"))

# #* @apiTitle R API
pr("executables/plumber.R") %>%
  pr_run(host = R_HOST, port = R_PORT)
