# Test Helper Utilities for E2E Tests

#' Generate sample test data
#' @param n_studies Number of studies
#' @param include_study_id Whether to include study_id column
#' @return Data frame with test data
generate_test_data <- function(n_studies = 20, include_study_id = TRUE) {
  set.seed(123) # For reproducible tests

  # Generate realistic effect sizes and standard errors
  true_effect <- 0.3
  publication_bias <- 0.1

  # Generate effect sizes with some publication bias
  effects <- rnorm(n_studies, mean = true_effect, sd = 0.2)
  # Add publication bias - smaller effects are less likely to be published
  effects <- effects + publication_bias * (effects > 0)

  # Generate standard errors (smaller for larger sample sizes)
  sample_sizes <- round(runif(n_studies, 100, 1000))
  standard_errors <- 1 / sqrt(sample_sizes) + rnorm(n_studies, 0, 0.01)

  # Create data frame
  df <- data.frame(
    bs = effects,
    sebs = standard_errors,
    Ns = sample_sizes
  )

  if (include_study_id) {
    df$study_id <- paste0("study_", 1:n_studies)
  }

  return(df)
}

#' Generate data with known publication bias
#' @param n_studies Number of studies
#' @param bias_strength Strength of publication bias
#' @return Data frame with publication bias
generate_biased_data <- function(n_studies = 30, bias_strength = 0.5) {
  set.seed(456)

  # Generate many studies
  n_total <- n_studies * 3

  effects <- rnorm(n_total, mean = 0.2, sd = 0.3)
  sample_sizes <- round(runif(n_total, 50, 500))
  standard_errors <- 1 / sqrt(sample_sizes) + rnorm(n_total, 0, 0.02)

  # Calculate p-values
  z_scores <- effects / standard_errors
  p_values <- 2 * (1 - pnorm(abs(z_scores)))

  # Apply publication bias - only publish significant results
  significant <- p_values < 0.05
  published <- significant | (runif(n_total) < 0.3) # 30% chance of publishing non-significant

  # Select published studies
  published_indices <- which(published)[1:n_studies]

  df <- data.frame(
    bs = effects[published_indices],
    sebs = standard_errors[published_indices],
    Ns = sample_sizes[published_indices],
    study_id = paste0("study_", 1:n_studies)
  )

  return(df)
}

#' Assert that API response has expected structure
#' @param response API response
#' @param expected_fields Expected field names
assert_response_structure <- function(response, expected_fields = NULL) {
  if (is.null(expected_fields)) {
    expected_fields <- c("data")
  }

  if (!is.list(response)) {
    stop("Response should be a list")
  }

  missing_fields <- setdiff(expected_fields, names(response))
  if (length(missing_fields) > 0) {
    stop(paste("Missing expected fields:", paste(missing_fields, collapse = ", ")))
  }

  if ("data" %in% names(response)) {
    data_fields <- c(
      "effectEstimate", "standardError", "isSignificant",
      "andersonRubinCI", "publicationBias", "firstStageFTest",
      "hausmanTest", "seInstrumented", "funnelPlot"
    )

    missing_data_fields <- setdiff(data_fields, names(response$data))
    if (length(missing_data_fields) > 0) {
      stop(paste("Missing expected data fields:", paste(missing_data_fields, collapse = ", ")))
    }
  }
}

#' Assert that MAIVE results are reasonable
#' @param results MAIVE results from API
assert_maive_results <- function(results) {
  # Check that effect estimate is numeric
  if (!is.numeric(results$data$effectEstimate)) {
    stop("Effect estimate should be numeric")
  }

  # Check that standard error is positive
  if (results$data$standardError <= 0) {
    stop("Standard error should be positive")
  }

  # Check that significance is boolean
  if (!is.logical(results$data$isSignificant)) {
    stop("isSignificant should be logical")
  }

  # Check publication bias structure
  if (!is.list(results$data$publicationBias)) {
    stop("publicationBias should be a list")
  }

  if (!("pValue" %in% names(results$data$publicationBias))) {
    stop("publicationBias should have pValue field")
  }

  # Check Hausman test structure
  if (!is.list(results$data$hausmanTest)) {
    stop("hausmanTest should be a list")
  }

  hausman_fields <- c("statistic", "criticalValue", "rejectsNull")
  missing_hausman <- setdiff(hausman_fields, names(results$data$hausmanTest))
  if (length(missing_hausman) > 0) {
    stop(paste("Missing Hausman test fields:", paste(missing_hausman, collapse = ", ")))
  }
}

#' Compare results with expected values
#' @param actual Actual results
#' @param expected Expected results
#' @param tolerance Tolerance for numeric comparisons
compare_results <- function(actual, expected, tolerance = 0.01) {
  differences <- list()

  # Compare numeric fields
  numeric_fields <- c("effectEstimate", "standardError")
  for (field in numeric_fields) {
    if (field %in% names(actual) && field %in% names(expected)) {
      diff <- abs(actual[[field]] - expected[[field]])
      if (diff > tolerance) {
        differences[[field]] <- paste("Difference:", diff, "exceeds tolerance:", tolerance)
      }
    }
  }

  # Compare publication bias p-value
  if ("publicationBias" %in% names(actual) && "publicationBias" %in% names(expected)) {
    actual_p <- actual$publicationBias$pValue
    expected_p <- expected$publicationBias$pValue
    if (abs(actual_p - expected_p) > tolerance) {
      differences[["publicationBias_pValue"]] <- paste("P-value difference:", abs(actual_p - expected_p))
    }
  }

  return(differences)
}

#' Log test results
#' @param test_name Name of the test
#' @param status Test status (PASS/FAIL)
#' @param message Additional message
#' @param details Additional details
log_test_result <- function(test_name, status, message = "", details = NULL) {
  timestamp <- format(Sys.time(), "%Y-%m-%d %H:%M:%S")
  cat(sprintf("[%s] %s: %s %s\n", timestamp, status, test_name, message))

  if (!is.null(details)) {
    cat("  Details:", paste(details, collapse = ", "), "\n")
  }
}
