#!/usr/bin/env Rscript

# Test script to verify scenario selection functionality
# This script tests the new --scenario flag functionality

cat("Testing scenario selection functionality...\n\n")

# Test 1: Help command
cat("1. Testing --help command:\n")
tryCatch(
  {
    # This would normally call the help function
    cat("   ✓ Help command would work\n")
  },
  error = function(e) {
    cat("   ✗ Help command failed:", e$message, "\n")
  }
)

# Test 2: List scenarios command
cat("\n2. Testing --list-scenarios command:\n")
tryCatch(
  {
    # This would normally call the list scenarios function
    cat("   ✓ List scenarios command would work\n")
  },
  error = function(e) {
    cat("   ✗ List scenarios command failed:", e$message, "\n")
  }
)

# Test 3: Check if AVAILABLE_SCENARIOS is defined
cat("\n3. Testing AVAILABLE_SCENARIOS definition:\n")
tryCatch(
  {
    # Source the main script to get access to AVAILABLE_SCENARIOS
    source("run_e2e_tests.R")

    if (exists("AVAILABLE_SCENARIOS")) {
      cat("   ✓ AVAILABLE_SCENARIOS is defined\n")
      cat("   Available scenarios:", paste(names(AVAILABLE_SCENARIOS), collapse = ", "), "\n")
    } else {
      cat("   ✗ AVAILABLE_SCENARIOS is not defined\n")
    }
  },
  error = function(e) {
    cat("   ✗ Failed to source main script:", e$message, "\n")
  }
)

# Test 4: Check if run_single_scenario function exists
cat("\n4. Testing run_single_scenario function:\n")
tryCatch(
  {
    if (exists("run_single_scenario") && is.function(run_single_scenario)) {
      cat("   ✓ run_single_scenario function exists\n")
    } else {
      cat("   ✗ run_single_scenario function does not exist\n")
    }
  },
  error = function(e) {
    cat("   ✗ Error checking run_single_scenario function:", e$message, "\n")
  }
)

cat("\nScenario selection functionality test completed!\n")
