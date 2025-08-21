# MAIVE Model Debugging Scripts

This directory contains R scripts that allow you to run the MAIVE model locally without making API calls, enabling interactive debugging with `browser()`.

## Files

- `debug_run_model.R` - Main script containing the extracted logic from the plumber endpoint
- `debug_interactive.R` - Interactive debugging environment setup
- `maive_debug.R` - The script to debug; a clone of the MAIVE::maive function.
- `README_debug.md` - This file

## Usage

### Option 1: Interactive Debugging (Recommended)

1. Start R in interactive mode:

   ```bash
   cd lambda-r-backend/r_scripts
   R
   ```

2. Source the interactive debugging script:

   ```r
   source("debug/debug_interactive.R")
   ```

3. Add a `browser()` call in the `run_model_locally` function where you want to pause:

   ```r
   # Edit the debug_run_model.R file and add browser() where needed
   browser()  # Add this line where you want to pause
   ```

4. Run the function:

   ```r
   result <- run_model_locally(test_file_data, test_parameters)
   ```

5. When the browser() is hit, you can inspect variables:

   ```r
   # In the browser prompt:
   ls()  # List all variables
   str(df)  # Inspect the data frame
   str(params)  # Inspect parameters
   str(maive_res)  # Inspect MAIVE results
   ```

### Option 2: Non-interactive Execution

Run the script directly:

```bash
cd lambda-r-backend/r_scripts
Rscript debug/debug_run_model.R
```

## Test Data

The scripts include the same test data from your CURL example:

**File Data:**

```json
[
 { "bs": 0.245, "sebs": 0.089, "Ns": 156 },
 { "bs": 0.312, "sebs": 0.102, "Ns": 203 }
]
```

**Parameters:**

```json
{
 "modelType": "MAIVE",
 "includeStudyDummies": true,
 "includeStudyClustering": true,
 "standardErrorTreatment": "clustered_cr2",
 "computeAndersonRubin": false,
 "maiveMethod": "PET",
 "shouldUseInstrumenting": true
}
```

## Key Differences from API Call

1. **Direct Function Call**: Instead of making an HTTP POST request, the script calls the function directly
2. **Local Environment**: All variables are available in the local R environment for inspection
3. **Browser Debugging**: You can add `browser()` calls anywhere in the function to pause execution and inspect variables
4. **No Network Overhead**: Faster execution since there's no HTTP overhead

## Debugging Tips

1. **Add browser() strategically**: Place `browser()` calls before and after key operations:

   ```r
   # Before MAIVE call
   browser()
   maive_res <- MAIVE::maive(...)

   # After MAIVE call
   browser()
   ```

2. **Inspect data transformations**: Check the data frame at each step:

   ```r
   # In browser prompt:
   head(df)  # See the data
   names(df)  # Check column names
   str(df)    # Detailed structure
   ```

3. **Check parameters**: Verify parameter parsing:

   ```r
   # In browser prompt:
   print(params)
   print(maive_method)
   print(studylevel)
   ```

4. **Examine MAIVE results**: Inspect the MAIVE function output:

   ```r
   # In browser prompt:
   names(maive_res)
   str(maive_res)
   maive_res$beta
   maive_res$SE
   ```

## Troubleshooting

- **Working Directory**: Make sure you're in the `lambda-r-backend/r_scripts` directory
- **Dependencies**: Ensure all required R packages are installed
- **MAIVE Package**: Make sure the MAIVE package is available in your R environment
- **File Paths**: The scripts assume they're run from the `r_scripts` directory

## Example Debugging Session

```r
# Start R and load the environment
source("debug/debug_interactive.R")

# Add browser() call in debug_run_model.R (line 200, before MAIVE call)
# Then run:
result <- run_model_locally(test_file_data, test_parameters)

# In browser prompt:
ls()                    # See all variables
head(df)               # Check data
print(maive_method)    # Check method
print(studylevel)      # Check study level
c                      # Continue execution

# Check results
print(result$data)
```
