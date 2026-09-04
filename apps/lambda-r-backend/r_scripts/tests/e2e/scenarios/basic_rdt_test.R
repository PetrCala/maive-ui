# Basic RDT (Residual Discontinuity Test) Scenario (#559)
#
# RDT is a diagnostic, not an estimator: it reports the jump in the residual
# of log(SE) on log(N) at |t| = 1.96 and no corrected effect. These checks
# pin the response contract the UI's RDTResultsSummary reads, the input
# guards (sample size mandatory, minimum counts each side of the cutoff) and
# the first-stage warning that fires when standard errors are an exact
# function of sample size.

#' Post a data frame to /run-rdt and return the parsed results
#' @param df Data frame with effect, se, n_obs and optionally study_id
#' @return The `data` field of the response
rdt_results_for <- function(df) {
  response <- test_run_rdt(df_to_json(df), params_to_json(list(modelType = "RDT")))
  if (!is.list(response) || is.null(response$data)) {
    stop(paste(
      "Response should contain a 'data' field; got:",
      if (is.null(response$message)) "no message" else response$message
    ))
  }
  response$data
}

#' Check one fit block (headline, sensitivity or placebo) has the right shape
#' @param fit Parsed fit block
#' @param label Name used in error messages
check_rdt_fit_block <- function(fit, label) {
  if (!is.null(fit$unavailable)) {
    stop(sprintf("%s fit should be available on this fixture, got: %s", label, fit$unavailable))
  }
  for (field in c("jump", "jumpSE", "pValue", "bandwidth", "nLeft", "nRight", "studies")) {
    if (!is.numeric(fit[[field]]) || length(fit[[field]]) != 1) {
      stop(sprintf("%s fit: %s should be a single number", label, field))
    }
  }
  if (length(fit$jumpCI) != 2) {
    stop(sprintf("%s fit: jumpCI should have 2 elements", label))
  }
  if (fit$jumpCI[[1]] > fit$jump || fit$jumpCI[[2]] < fit$jump) {
    stop(sprintf("%s fit: jump should lie inside jumpCI", label))
  }
  if (fit$pValue < 0 || fit$pValue > 1) {
    stop(sprintf("%s fit: pValue should be in [0, 1]", label))
  }
  invisible(TRUE)
}

#' Check that the input guards refuse what RDT cannot analyse
check_rdt_input_guards <- function(df) {
  cat("Checking RDT input guards...\n")

  no_n_obs <- test_run_rdt(df_to_json(df[, c("bs", "sebs")]), params_to_json(list()))
  if (!isTRUE(no_n_obs$error) || !grepl("sample size", no_n_obs$message)) {
    stop("A two-column upload should be refused with a message naming the sample size column")
  }

  too_few <- test_run_rdt(df_to_json(df[1:20, ]), params_to_json(list()))
  if (!isTRUE(too_few$error) || !grepl("at least 30", too_few$message)) {
    stop("Fewer than 30 usable estimates should be refused with the minimum in the message")
  }

  # Every estimate on one side of the cutoff: t is forced above 1.96.
  one_sided <- df
  one_sided$bs <- abs(one_sided$bs) + 3 * one_sided$sebs
  one_side <- test_run_rdt(df_to_json(one_sided), params_to_json(list()))
  if (!isTRUE(one_side$error) || !grepl("each side", one_side$message)) {
    stop("Fewer than 10 estimates on one side of the cutoff should be refused, naming both counts")
  }

  invisible(TRUE)
}

#' Check the first-stage warning on standard errors that are an exact function of N
check_rdt_exact_first_stage <- function(df) {
  cat("Checking RDT first-stage warning...\n")
  exact <- df
  exact$sebs <- 1 / sqrt(exact$Ns)
  results <- rdt_results_for(exact)
  if (results$firstStage$rSquared < 0.99) {
    stop("An SE that is exactly 1/sqrt(N) should give a first-stage R-squared above 0.99")
  }
  if (!any(grepl("R-squared", unlist(results$warnings)))) {
    stop("A first-stage R-squared above 0.99 should raise a warning")
  }
  invisible(TRUE)
}

#' Check that a missing study column is reported and changes the clustering
check_rdt_no_study_column <- function(df) {
  cat("Checking RDT without a study column...\n")
  results <- rdt_results_for(df[, c("bs", "sebs", "Ns")])
  if (!identical(results$hasStudyColumn, FALSE)) {
    stop("hasStudyColumn should be FALSE for a three-column upload")
  }
  if (!any(grepl("no study column", unlist(results$warnings)))) {
    stop("A three-column upload should warn that standard errors are clustered by estimate")
  }
  if (results$studies != results$nLeft + results$nRight) {
    stop("Without a study column every estimate in the window should be its own cluster")
  }
  invisible(TRUE)
}

#' Test basic RDT functionality
#' @return Test results
test_basic_rdt <- function() {
  test_name <- "Basic RDT Test"

  tryCatch(
    {
      test_data <- generate_rdt_test_data()

      cat("Running basic RDT test...\n")
      results <- rdt_results_for(test_data)

      if (!identical(results$model, "RDT")) {
        stop("The payload should name its model as RDT in the `model` field")
      }

      rdt_fields <- c(
        "model", "jump", "jumpSE", "jumpCI", "pValue", "cutoff", "bandwidth",
        "windowT", "nLeft", "nRight", "studies", "hasStudyColumn", "k",
        "droppedRows", "minDetectableJump", "firstStage", "sensitivity",
        "placebo", "warnings", "plot", "plotWidth", "plotHeight"
      )
      missing <- setdiff(rdt_fields, names(results))
      if (length(missing) > 0) {
        stop(paste("Missing RDT fields:", paste(missing, collapse = ", ")))
      }

      check_rdt_fit_block(results, "Headline")
      check_rdt_fit_block(results$sensitivity$half, "Half-bandwidth")
      check_rdt_fit_block(results$sensitivity$double, "Double-bandwidth")
      check_rdt_fit_block(results$placebo$below, "Placebo below")
      check_rdt_fit_block(results$placebo$above, "Placebo above")

      if (results$cutoff != 1.96) {
        stop("cutoff should be 1.96")
      }
      if (results$bandwidth < 0.25 || results$bandwidth > 2) {
        stop("bandwidth should be clamped to [0.25, 1.0] log points (widened only for a starved side)")
      }
      if (length(results$windowT) != 2 || results$windowT[[1]] >= 1.96 || results$windowT[[2]] <= 1.96) {
        stop("windowT should bracket |t| = 1.96")
      }
      if (abs(results$minDetectableJump - 2.8 * results$jumpSE) > 1e-8) {
        stop("minDetectableJump should be 2.8 times the standard error")
      }
      if (results$nLeft < 5 || results$nRight < 5) {
        stop("Each side of the cutoff should keep at least 5 estimates inside the window")
      }
      if (results$k != nrow(test_data) || results$droppedRows != 0) {
        stop("Every row of the fixture should be usable")
      }
      if (!isTRUE(results$hasStudyColumn)) {
        stop("hasStudyColumn should be TRUE for a four-column upload")
      }
      if (results$studies > length(unique(test_data$study_id))) {
        stop("studies should not exceed the number of distinct study ids")
      }
      if (abs(results$firstStage$slope + 0.5) > 0.15) {
        stop("The first-stage slope of log(SE) on log(N) should be close to -0.5 on this fixture")
      }
      if (results$placebo$below$cutoff >= 1.96 || results$placebo$above$cutoff <= 1.96) {
        stop("Placebo cutoffs should sit on their own side of 1.96")
      }
      if (is.null(results$plot) || !startsWith(results$plot, "data:image/png;base64,")) {
        stop("The plot should be a base64 PNG data URI")
      }

      check_rdt_input_guards(test_data)
      check_rdt_exact_first_stage(test_data)
      check_rdt_no_study_column(test_data)

      log_test_result(test_name, "PASS", "Basic RDT functionality working correctly")
      return(list(status = "PASS", test_name = test_name, results = results))
    },
    error = function(e) {
      log_test_result(test_name, "FAIL", e$message)
      return(list(status = "FAIL", test_name = test_name, error = e$message))
    }
  )
}
