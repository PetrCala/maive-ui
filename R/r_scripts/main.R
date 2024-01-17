# main.R

print("In main.R")

# See: https://www.rplumber.io
library('plumber')

print("Plumber library successfully loaded")

# #* @apiTitle My API
pr("executables/plumber.R") %>%
  pr_run(port=8787, host="0.0.0.0")