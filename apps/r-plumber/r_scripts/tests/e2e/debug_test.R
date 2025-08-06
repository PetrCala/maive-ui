#!/usr/bin/env Rscript

# Debug script to test the API with better error handling

library(httr)
library(jsonlite)

# Test data
test_data <- data.frame(
  bs = c(0.245, 0.312, 0.178),
  sebs = c(0.089, 0.102, 0.076),
  Ns = c(156, 203, 134)
)

# Test parameters
params <- list(
  modelType = "MAIVE",
  includeStudyDummies = TRUE,
  includeStudyClustering = TRUE,
  standardErrorTreatment = "clustered_cr2",
  computeAndersonRubin = TRUE,
  maiveMethod = "PET",
  shouldUseInstrumenting = TRUE
)

# Convert to JSON
file_data_json <- toJSON(test_data, auto_unbox = TRUE)
params_json <- toJSON(params, auto_unbox = TRUE)

cat("Testing API with debug info...\n")
cat("File data JSON:", file_data_json, "\n")
cat("Parameters JSON:", params_json, "\n")

# Test the API
tryCatch(
  {
    response <- POST(
      "http://localhost:8787/run-model",
      body = list(
        file_data = file_data_json,
        parameters = params_json
      ),
      encode = "form",
      timeout(30)
    )

    cat("Response status:", status_code(response), "\n")
    cat("Response headers:", "\n")
    print(headers(response))

    if (status_code(response) == 200) {
      content <- content(response, "parsed")
      cat("Success! Response:", "\n")
      print(content)
    } else {
      cat("Error response:", "\n")
      print(content(response, "text"))
    }
  },
  error = function(e) {
    cat("Error:", e$message, "\n")
  }
)
