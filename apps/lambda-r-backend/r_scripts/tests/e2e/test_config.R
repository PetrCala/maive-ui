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
  ),
  basic_rtma = list(
    name = "Basic RTMA Test",
    description = "Tests basic RTMA functionality with phacking package"
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
  shouldUseInstrumenting = TRUE,
  useLogFirstStage = FALSE,
  winsorize = 0,
  # The UI forwards the full ModelParameters object, which carries the
  # RTMA-only favorPositive key. run_maive_model must tolerate extra keys.
  favorPositive = TRUE
)
