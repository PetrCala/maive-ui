# E2E Test Configuration

# API Configuration
API_BASE_URL <- "http://localhost:8787"
API_TIMEOUT <- 30 # seconds

# Test Data Configuration
TEST_DATA_DIR <- "fixtures"

# Expected Results Configuration
EXPECTED_RESULTS_FILE <- "fixtures/expected_results.json"

# Test Scenarios Configuration
SCENARIOS <- list(
  basic_maive = list(
    name = "Basic MAIVE Test",
    description = "Tests basic MAIVE functionality with standard parameters"
  ),
  publication_bias = list(
    name = "Publication Bias Test",
    description = "Tests publication bias detection"
  ),
  different_methods = list(
    name = "Different Methods Test",
    description = "Tests all MAIVE methods (PET, PEESE, PET-PEESE, EK)"
  ),
  edge_cases = list(
    name = "Edge Cases Test",
    description = "Tests edge cases and error conditions"
  )
)

# Default Parameters for Testing
DEFAULT_PARAMETERS <- list(
  modelType = "MAIVE",
  includeStudyDummies = TRUE,
  includeStudyClustering = TRUE,
  standardErrorTreatment = "clustered_cr2",
  computeAndersonRubin = FALSE,
  maiveMethod = "PET-PEESE",
  weight = "equal_weights",
  shouldUseInstrumenting = TRUE
)
