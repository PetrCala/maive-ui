# host.R

print("In host.R")

# See: https://www.rplumber.io
library("plumber")

print("Plumber library successfully loaded")

# Load the docker-compose environment variables
R_HOST <- Sys.getenv("R_HOST") || "0.0.0.0"
R_PORT <- as.numeric(Sys.getenv("R_PORT")) || 8787

# #* @apiTitle R API
plumber::pr("executables/plumber.R") %>%
  plumber::pr_run(host = R_HOST, port = R_PORT)
