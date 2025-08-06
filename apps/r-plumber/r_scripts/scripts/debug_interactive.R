#!/usr/bin/env Rscript

# Interactive debugging script for MAIVE model
# This script loads the function and allows you to debug interactively

if (!grepl("r_scripts$", getwd())) {
  stop("This script must be run from the r_scripts directory")
}

# Load required libraries
library(jsonlite)
library(cli)

# MAIVE dependencies
maive_deps <- c("clubSandwich", "varhandle", "pracma", "sandwich", "metafor")
lapply(maive_deps, library, character.only = TRUE)

# Source the funnel plot module
source("modules/funnel_plot.R", local = TRUE)

# Source the main function from the debug script
source("scripts/debug_run_model.R")

# Test data from the CURL example
test_data <- data.frame(
  bs = round(runif(20, 0.1, 0.5), 3),
  sebs = round(runif(20, 0.05, 0.15), 3),
  Ns = sample(100:300, 20, replace = TRUE)
)
test_file_data <- jsonlite::toJSON(test_data, auto_unbox = TRUE)
test_parameters <- '{"modelType":"MAIVE","includeStudyDummies":true,"includeStudyClustering":true,"standardErrorTreatment":"clustered_cr2","computeAndersonRubin":true,"maiveMethod":"PET","shouldUseInstrumenting":true}'

cat("=== MAIVE Model Debugging Environment ===\n")
cat("Available variables:\n")
cat("- test_file_data: JSON string with test data\n")
cat("- test_parameters: JSON string with test parameters\n")
cat("- run_model_locally(): Function to run the model\n")
cat("\n")
cat("To debug with browser():\n")
cat("1. Add browser() call in the run_model_locally function\n")
cat("2. Run: result <- run_model_locally(test_file_data, test_parameters)\n")
cat("3. Use browser commands to inspect variables\n")
cat("\n")
cat("Example usage:\n")
cat("result <- run_model_locally(test_file_data, test_parameters)\n")
cat("\n")

# Parse the test data for easier inspection
parsed_data <- jsonlite::fromJSON(test_file_data)
parsed_params <- jsonlite::fromJSON(test_parameters)

cat("Parsed test data:\n")
print(parsed_data)
cat("\nParsed parameters:\n")
print(parsed_params)
cat("\n")
