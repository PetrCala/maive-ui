# MAIVE E2E Test Suite

This directory contains comprehensive end-to-end tests for the MAIVE Plumber API. The tests verify that the API endpoints work correctly and that the MAIVE calculations produce expected results.

## Structure

```plain
tests/e2e/
├── test_config.R              # Test configuration and parameters
├── run_e2e_tests.R            # Main test runner script
├── utils/
│   ├── api_client.R           # API interaction utilities
│   └── test_helpers.R         # Test helper functions
├── scenarios/
│   ├── basic_maive_test.R     # Basic MAIVE functionality tests
│   ├── publication_bias_test.R # Publication bias detection tests
│   └── edge_cases_test.R      # Edge cases and error handling tests
└── fixtures/
    ├── sample_data_3col.csv   # Sample data with 3 columns
    └── sample_data_4col.csv   # Sample data with 4 columns
```

## Prerequisites

1. **R Environment**: Make sure R is installed and accessible
2. **Required R Packages**: Install the following packages:

   ```r
   install.packages(c("httr", "jsonlite", "cli"))
   ```

3. **MAIVE Package**: The vendor MAIVE package should be available
4. **Running API**: The Plumber API should be running on `http://localhost:8787` (or configure a different URL)

## Running the Tests

### Basic Usage

```bash
# From the r_scripts directory
cd apps/lambda-r-backend/r_scripts/tests/e2e
Rscript run_e2e_tests.R
```

### Running Specific Scenarios

You can run individual test scenarios using the `--scenario` flag:

```bash
# Run only the basic MAIVE test
Rscript run_e2e_tests.R --scenario basic

# Run publication bias detection test
Rscript run_e2e_tests.R --scenario pub-bias-detection

# Run edge case test for minimal data
Rscript run_e2e_tests.R --scenario minimal-data

# Run health check only
Rscript run_e2e_tests.R --scenario health

# List all available scenarios
Rscript run_e2e_tests.R --list-scenarios
```

### Advanced Usage

```bash
# Test against a different API URL
Rscript run_e2e_tests.R --api-url http://localhost:9000

# Run specific scenario with custom API URL
Rscript run_e2e_tests.R --scenario basic --api-url http://localhost:9000

# Run with reduced output
Rscript run_e2e_tests.R --quiet

# Show help
Rscript run_e2e_tests.R --help
```

### From R Console

```r
# Source and run tests interactively
source("tests/e2e/run_e2e_tests.R")
results <- run_e2e_tests()
```

## Available Test Scenarios

The test suite includes the following scenarios that can be run individually:

### Basic Scenarios

- **`basic`**: Basic MAIVE Test - Tests fundamental MAIVE functionality with PET-PEESE method
- **`parameters`**: Parameter Combinations Test - Tests different MAIVE methods (PET, PEESE, PET-PEESE, EK) and parameter combinations

### Publication Bias Scenarios

- **`pub-bias-detection`**: Publication Bias Detection Test - Tests detection of publication bias using data with known bias patterns
- **`pub-bias-methods`**: Publication Bias Methods Test - Tests all MAIVE methods for publication bias detection
- **`pub-bias-strength`**: Publication Bias Strength Test - Tests detection across different bias strengths

### Edge Case Scenarios

- **`minimal-data`**: Minimal Data Test - Tests with the minimum required data (3 studies)
- **`large-dataset`**: Large Dataset Test - Tests with a large dataset (100 studies)
- **`data-with-nas`**: Data with NAs Test - Tests handling of missing values
- **`extreme-values`**: Extreme Values Test - Tests with extreme effect sizes and standard errors
- **`invalid-parameters`**: Invalid Parameters Test - Tests error handling for invalid inputs

### Special Scenarios

- **`health`**: Health Check - Basic API health check
- **`echo`**: Echo Test - Test echo endpoint
- **`all`**: All Tests - Run all available test scenarios (default)

### Test Categories

The scenarios are organized into the following categories:

#### 1. Basic MAIVE Tests

- **Basic MAIVE Test**: Tests fundamental MAIVE functionality with standard parameters
- **Parameter Combinations Test**: Tests different MAIVE methods (PET, PEESE, PET-PEESE, EK) and parameter combinations

#### 2. Publication Bias Tests

- **Publication Bias Detection**: Tests detection of publication bias using data with known bias patterns
- **Publication Bias Methods**: Tests all MAIVE methods for publication bias detection
- **Publication Bias Strength**: Tests detection across different bias strengths

#### 3. Edge Cases Tests

- **Minimal Data**: Tests with the minimum required data (3 studies)
- **Large Dataset**: Tests with a large dataset (100 studies)
- **Data with NAs**: Tests handling of missing values
- **Extreme Values**: Tests with extreme effect sizes and standard errors
- **Invalid Parameters**: Tests error handling for invalid inputs

## Test Data

The tests use generated data that simulates realistic meta-analysis scenarios:

- **Normal Data**: Realistic effect sizes, standard errors, and sample sizes
- **Biased Data**: Data with known publication bias patterns
- **Edge Cases**: Minimal data, large datasets, missing values, extreme values

## Expected Results

### API Response Structure

Each successful API call should return:

```json
{
 "data": {
  "effectEstimate": 0.234,
  "standardError": 0.045,
  "isSignificant": true,
  "andersonRubinCI": [0.145, 0.323],
  "publicationBias": {
   "pValue": 0.023,
   "isSignificant": true
  },
  "firstStageFStatistic": 15.67,
  "hausmanTest": {
   "statistic": 8.45,
   "criticalValue": 3.84,
   "rejectsNull": true
  },
  "seInstrumented": 0.052,
  "funnelPlot": "data:image/png;base64,...",
  "funnelPlotWidth": 800,
  "funnelPlotHeight": 600
 }
}
```

### Validation Checks

- Effect estimates are numeric and reasonable
- Standard errors are positive
- P-values are between 0 and 1
- Funnel plots are generated
- Error handling works for invalid inputs

## Troubleshooting

### Common Issues

1. **API Not Running**: Make sure the Plumber API is started

   ```bash
   # From r_scripts directory
   Rscript executables/plumber.R
   ```

2. **Missing Packages**: Install required R packages

   ```r
   install.packages(c("httr", "jsonlite", "cli"))
   ```

3. **Permission Issues**: Make sure the test script is executable

   ```bash
   chmod +x run_e2e_tests.R
   ```

4. **Port Conflicts**: If port 8787 is in use, start the API on a different port and use `--api-url`

### Debug Mode

To run tests with more detailed output, modify the `verbose` parameter:

```r
results <- run_e2e_tests(verbose = TRUE)
```

## Adding New Tests

To add new test scenarios:

1. Create a new file in `scenarios/` (e.g., `new_feature_test.R`)
2. Define test functions that return a list with `status`, `test_name`, and optional `results`/`error`
3. Add the test to the main runner in `run_e2e_tests.R`
4. Update this README with the new test description

Example test function:

```r
test_new_feature <- function() {
  test_name <- "New Feature Test"

  tryCatch({
    # Test implementation
    # ...

    return(list(
      status = "PASS",
      test_name = test_name,
      results = results
    ))
  }, error = function(e) {
    return(list(
      status = "FAIL",
      test_name = test_name,
      error = e$message
    ))
  })
}
```

## Integration with CI/CD

The test suite can be integrated into CI/CD pipelines:

```yaml
# Example GitHub Actions step
- name: Run E2E Tests
  run: |
    cd apps/lambda-r-backend/r_scripts/tests/e2e
    Rscript run_e2e_tests.R --quiet
```

The script exits with status code 0 on success and 1 on failure, making it suitable for automated testing.
