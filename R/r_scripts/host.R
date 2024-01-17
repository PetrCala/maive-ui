# host.R

print("In host.R")

# See: https://www.rplumber.io
library('plumber')

print("Plumber library successfully loaded")

# Load the docker-compose environment variables
R_HOST = Sys.getenv("R_HOST")
R_PORT = Sys.getenv("R_PORT")

# #* @apiTitle R API
pr("executables/plumber.R") %>%
  pr_run(host=R_HOST, port=R_PORT)