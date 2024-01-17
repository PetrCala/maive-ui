# main.R

# Make the container library available to R
.libPaths(c("/usr/local/lib/R/site-library", .libPaths()))

print("Hello, world!")

# See: https://www.rplumber.io
library('plumber')

print("Plumber library successfully loaded")

# #* @apiTitle My API
# pr("executables/plumber.R") %>%
#   pr_run(port=8787)