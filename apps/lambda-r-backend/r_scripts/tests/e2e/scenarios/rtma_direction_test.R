# RTMA Favored Direction Test Scenario
#
# Regression coverage for the two direction bugs in run_rtma_model():
#
#   * phacking_meta() fits on -yi when favor_positive = FALSE and reports mu on
#     that flipped scale. The unmapped value used to reach the caller, so a
#     negative literature came back with a positive corrected mean.
#   * phacking_meta() warns when the favored direction is opposite the pooled
#     estimate, but the error-only tryCatch swallowed it, so a run that
#     truncated nothing looked like a clean correction.

#' Fail with a message unless a condition holds
expect_rtma <- function(condition, message) {
  if (!isTRUE(condition)) {
    stop(message)
  }
}

#' Build the RTMA parameter JSON with favorPositive overridden
#' @param favor_positive Value for the favorPositive parameter
#' @return JSON string of parameters
rtma_direction_params <- function(favor_positive) {
  params_to_json(list(
    modelType = "RTMA",
    favorPositive = favor_positive,
    alphaSelect = 0.05,
    ciLevel = 0.95,
    winsorize = 0
  ))
}

#' Run /run-rtma for one direction setting and return the results object
#' @param df Data frame of estimates (effect, se in the first two columns)
#' @param favor_positive Value for the favorPositive parameter
#' @param label Label used in failure messages
#' @return Parsed results object
run_rtma_direction_case <- function(df, favor_positive, label) {
  cat(sprintf("  %s...\n", label))
  response <- test_run_rtma(df_to_json(df), rtma_direction_params(favor_positive))

  expect_rtma(
    is.list(response) && !is.null(response$data),
    sprintf("%s: response should contain a 'data' field", label)
  )
  results <- response$data

  expect_rtma(
    "warnings" %in% names(results),
    sprintf("%s: results should carry a 'warnings' field", label)
  )
  expect_rtma(
    is.numeric(results$mu) && length(results$mu) == 1,
    sprintf("%s: mu should be a single number", label)
  )
  expect_rtma(
    length(results$muCI) == 2,
    sprintf("%s: muCI should have 2 elements", label)
  )
  expect_rtma(
    results$muCI[[1]] < results$muCI[[2]],
    sprintf("%s: muCI should be ordered [lower, upper]", label)
  )

  results
}

#' Collect the warning messages that name the favored direction
#' @param results Parsed RTMA results object
#' @return Character vector of matching messages
rtma_direction_warnings <- function(results) {
  messages <- unlist(results$warnings)
  if (is.null(messages)) {
    return(character(0))
  }
  messages[grepl("direction", messages, ignore.case = TRUE)]
}

#' Test that RTMA respects the favored direction and reports direction problems
#' @return Test results
test_rtma_direction <- function() {
  test_name <- "RTMA Favored Direction Test"

  tryCatch(
    {
      # One dataset and its exact mirror image. Fitting yi with
      # favorPositive = TRUE and -yi with favorPositive = FALSE is the same
      # model, so mu must come back negated and the credible interval mirrored.
      positive_data <- generate_rtma_test_data()
      negative_data <- positive_data
      negative_data$bs <- -negative_data$bs

      cat("Running RTMA favored direction test...\n")

      positive_results <- run_rtma_direction_case(
        positive_data, TRUE, "positive data, favorPositive = TRUE"
      )
      negative_results <- run_rtma_direction_case(
        negative_data, FALSE, "negative data, favorPositive = FALSE"
      )
      wrong_results <- run_rtma_direction_case(
        negative_data, TRUE, "negative data, favorPositive = TRUE (wrong way round)"
      )

      # 1. Signs follow the data, not phacking's internal orientation
      expect_rtma(
        positive_results$mu > 0,
        sprintf(
          "Positive data with favorPositive = TRUE should give mu > 0, got %.6f",
          positive_results$mu
        )
      )
      expect_rtma(
        negative_results$mu < 0,
        sprintf(
          "Negative data with favorPositive = FALSE should give mu < 0, got %.6f",
          negative_results$mu
        )
      )
      expect_rtma(
        negative_results$muCI[[2]] < 0,
        sprintf(
          "Negative data with favorPositive = FALSE should give a negative muCI, got [%.6f, %.6f]",
          negative_results$muCI[[1]], negative_results$muCI[[2]]
        )
      )

      # 2. The two fits mirror each other. Both now run under the same pinned
      # seed (#479), but they are still separate fits, so compare with a
      # tolerance well above Monte Carlo noise but far below the sign error this
      # guards against (which doubles the magnitude).
      mu_tolerance <- 0.25 * abs(positive_results$mu)
      # Interval bounds are posterior quantiles, so the long tail carries far
      # more Monte Carlo noise than the mode. Scale their tolerance to the
      # interval width: an unflipped bound would miss by more than twice this.
      ci_tolerance <- 0.75 *
        (positive_results$muCI[[2]] - positive_results$muCI[[1]])
      expect_rtma(
        abs(positive_results$mu + negative_results$mu) < mu_tolerance,
        sprintf(
          "Mirrored fits should give negated mu: %.6f vs %.6f",
          positive_results$mu, negative_results$mu
        )
      )
      expect_rtma(
        abs(positive_results$muCI[[1]] + negative_results$muCI[[2]]) < ci_tolerance &&
          abs(positive_results$muCI[[2]] + negative_results$muCI[[1]]) < ci_tolerance,
        sprintf(
          "Mirrored fits should give a mirrored muCI: [%.6f, %.6f] vs [%.6f, %.6f]",
          positive_results$muCI[[1]], positive_results$muCI[[2]],
          negative_results$muCI[[1]], negative_results$muCI[[2]]
        )
      )

      # 3. tau is a scale parameter, so it is not flipped and stays positive
      expect_rtma(
        negative_results$tau > 0,
        sprintf("tau should stay positive, got %.6f", negative_results$tau)
      )
      expect_rtma(
        abs(positive_results$tau - negative_results$tau) < 0.25 * positive_results$tau,
        sprintf(
          "Mirrored fits should give the same tau: %.6f vs %.6f",
          positive_results$tau, negative_results$tau
        )
      )

      # 4. Fitting the correct direction raises no direction warning; fitting
      # the wrong one surfaces it instead of silently returning an uncorrected
      # estimate.
      expect_rtma(
        length(rtma_direction_warnings(negative_results)) == 0,
        paste(
          "Correctly oriented fit should raise no direction warning, got:",
          paste(rtma_direction_warnings(negative_results), collapse = " | ")
        )
      )
      expect_rtma(
        length(rtma_direction_warnings(wrong_results)) > 0,
        paste(
          "Wrong-direction fit should surface a direction warning, got:",
          paste(unlist(wrong_results$warnings), collapse = " | ")
        )
      )

      log_test_result(
        test_name, "PASS",
        "RTMA reports mu on the caller's sign convention and flags a wrong favored direction"
      )

      return(list(
        status = "PASS",
        test_name = test_name,
        results = list(
          positive = positive_results,
          negative = negative_results,
          wrong_direction = wrong_results
        )
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
