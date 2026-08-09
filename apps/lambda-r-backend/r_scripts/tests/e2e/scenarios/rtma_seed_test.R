# RTMA Seed Reproducibility Test Scenario
#
# phacking::phacking_meta() takes no seed argument, so RStan used to draw a
# fresh one on every call: identical input returned a different credible
# interval each time, because the mode comes from a deterministic optimisation
# but the interval is a posterior quantile (#479). run_rtma_model() now seeds
# the sampler immediately before the fit and reports the seed it used.
#
# The check that matters is bit-identity, not "close enough": a tolerance would
# pass just as happily with the seed removed again.

# Keep in sync with RTMA_DEFAULT_SEED in rtma_model.R. Asserted end to end so a
# request that sets no seed still runs pinned, rather than silently drifting
# back to a per-call random draw.
RTMA_EXPECTED_DEFAULT_SEED <- 2025

# Arbitrary non-default seed, so a run that echoes it proves the request value
# was honored rather than the default being reported back.
RTMA_TEST_SEED <- 4242

#' Fail with a message unless a condition holds
expect_rtma_seed <- function(condition, message) {
  if (!isTRUE(condition)) {
    stop(message)
  }
}

#' Build RTMA parameter JSON, optionally pinning the seed
#' @param seed Seed to request, or NULL to leave it to the backend default
#' @return JSON string of parameters
rtma_seed_params <- function(seed = NULL) {
  params <- list(
    modelType = "RTMA",
    favorPositive = TRUE,
    alphaSelect = 0.05,
    ciLevel = 0.95,
    winsorize = 0
  )
  if (!is.null(seed)) {
    params$seed <- seed
  }
  params_to_json(params)
}

#' Extract the numeric fields a seeded run must reproduce exactly
#' @param results Parsed RTMA results object
#' @return Named list of scalars and interval bounds
rtma_seed_fingerprint <- function(results) {
  list(
    mu = results$mu,
    muMedian = results$muMedian,
    muCILower = results$muCI[[1]],
    muCIUpper = results$muCI[[2]],
    tau = results$tau,
    tauMedian = results$tauMedian,
    tauCILower = results$tauCI[[1]],
    tauCIUpper = results$tauCI[[2]]
  )
}

#' Report every field where two runs disagree, formatted for a failure message
#' @param left Fingerprint of the first run
#' @param right Fingerprint of the second run
#' @return Character vector of differing fields, empty when the runs agree
rtma_seed_differences <- function(left, right) {
  differing <- vapply(names(left), function(field) {
    !identical(left[[field]], right[[field]])
  }, logical(1))

  vapply(names(left)[differing], function(field) {
    sprintf("%s: %.10f vs %.10f", field, left[[field]], right[[field]])
  }, character(1))
}

#' Run /run-rtma once and return its parsed results
#' @param df Data frame of estimates
#' @param seed Seed to request, or NULL for the backend default
#' @param label Label used in progress output and failure messages
#' @return Parsed results object
run_rtma_seed_case <- function(df, seed, label) {
  cat(sprintf("  %s...\n", label))
  response <- test_run_rtma(df_to_json(df), rtma_seed_params(seed))

  expect_rtma_seed(
    is.list(response) && !is.null(response$data),
    sprintf("%s: response should contain a 'data' field", label)
  )
  results <- response$data

  expect_rtma_seed(
    !is.null(results$seed),
    sprintf("%s: results should carry the seed the sampler ran under", label)
  )
  expect_rtma_seed(
    is.numeric(results$seed) && length(results$seed) == 1,
    sprintf("%s: seed should be a single number, got %s", label, class(results$seed))
  )

  results
}

#' Check that /v1/run-rtma honors, echoes, and validates the seed parameter
#' @param df Data frame of estimates
#' @param expected Fingerprint of the legacy-route run with the same seed
#' @return TRUE invisibly
check_rtma_seed_v1 <- function(df, expected) {
  rows <- df_to_v1_rows(df)

  cat("  /v1/run-rtma with an explicit seed...\n")
  seeded_response <- v1_post_json(
    "/v1/run-rtma",
    list(data = rows, parameters = list(seed = RTMA_TEST_SEED)),
    timeout = 300
  )
  expect_rtma_seed(
    httr::status_code(seeded_response) == 200,
    sprintf(
      "/v1 seeded request failed with status %d",
      httr::status_code(seeded_response)
    )
  )
  seeded_body <- v1_parse_body(seeded_response)
  expect_rtma_seed(
    identical(as.numeric(seeded_body$seed), as.numeric(RTMA_TEST_SEED)),
    sprintf(
      "/v1 should echo the requested seed %s, got %s",
      RTMA_TEST_SEED, seeded_body$seed
    )
  )

  # Same data, same seed, different route: the fit must land on the same
  # numbers, otherwise /v1 is dropping the seed somewhere on the way through.
  differences <- rtma_seed_differences(expected, rtma_seed_fingerprint(seeded_body))
  expect_rtma_seed(
    length(differences) == 0,
    paste(
      "/v1 and the legacy route disagree for the same data and seed:",
      paste(differences, collapse = " | ")
    )
  )

  cat("  /v1/run-rtma with no seed (backend default)...\n")
  default_response <- v1_post_json(
    "/v1/run-rtma", list(data = rows),
    timeout = 300
  )
  expect_rtma_seed(
    httr::status_code(default_response) == 200,
    sprintf(
      "/v1 default request failed with status %d",
      httr::status_code(default_response)
    )
  )
  default_body <- v1_parse_body(default_response)
  expect_rtma_seed(
    identical(as.numeric(default_body$seed), as.numeric(RTMA_EXPECTED_DEFAULT_SEED)),
    sprintf(
      "A request with no seed should run under the default seed %s, got %s",
      RTMA_EXPECTED_DEFAULT_SEED, default_body$seed
    )
  )

  cat("  /v1/run-rtma rejects an invalid seed...\n")
  invalid_response <- v1_post_json(
    "/v1/run-rtma",
    list(data = rows, parameters = list(seed = 1.5)),
    timeout = 60
  )
  expect_rtma_seed(
    httr::status_code(invalid_response) == 400,
    sprintf(
      "A non-integer seed should be rejected with 400, got %d",
      httr::status_code(invalid_response)
    )
  )
  invalid_body <- v1_parse_body(invalid_response)
  expect_rtma_seed(
    identical(invalid_body$error$code, "validation_error"),
    "A non-integer seed should return a validation_error envelope"
  )

  invisible(TRUE)
}

#' Test that RTMA runs are reproducible under a pinned seed
#' @return Test results
test_rtma_seed <- function() {
  test_name <- "RTMA Seed Reproducibility Test"

  tryCatch(
    {
      cat("Running RTMA seed reproducibility test...\n")

      # Rounded to 4 decimals because the two routes serialize the payload at
      # different precision (the legacy helper uses jsonlite's default
      # digits = 4, /v1 sends digits = NA). Pre-rounded input survives both
      # unchanged, so the cross-route check below compares two fits of the same
      # numbers rather than of two slightly different datasets.
      test_data <- round(generate_rtma_test_data(), 4)

      first <- run_rtma_seed_case(
        test_data, RTMA_TEST_SEED, "first run with an explicit seed"
      )
      second <- run_rtma_seed_case(
        test_data, RTMA_TEST_SEED, "second run with the same input and seed"
      )

      expect_rtma_seed(
        identical(as.numeric(first$seed), as.numeric(RTMA_TEST_SEED)),
        sprintf(
          "The response should echo the requested seed %s, got %s",
          RTMA_TEST_SEED, first$seed
        )
      )

      differences <- rtma_seed_differences(
        rtma_seed_fingerprint(first),
        rtma_seed_fingerprint(second)
      )
      expect_rtma_seed(
        length(differences) == 0,
        paste(
          "Two runs with the same input and seed must agree to every digit;",
          "these differ in", paste(differences, collapse = " | ")
        )
      )

      check_rtma_seed_v1(test_data, rtma_seed_fingerprint(first))

      log_test_result(
        test_name, "PASS",
        "Identical input and seed reproduce identical RTMA results"
      )

      return(list(
        status = "PASS",
        test_name = test_name,
        results = first
      ))
    },
    error = function(e) {
      log_test_result(test_name, "FAIL", e$message)
      return(list(
        status = "FAIL",
        test_name = test_name,
        error = e$message
      ))
    }
  )
}
