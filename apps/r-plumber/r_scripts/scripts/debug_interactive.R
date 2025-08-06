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
