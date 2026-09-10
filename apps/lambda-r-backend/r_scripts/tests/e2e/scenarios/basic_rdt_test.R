# Basic RDT (Residual Discontinuity Test) Scenario (#559)
#
# RDT is a diagnostic, not an estimator: it reports the jump in the residual
# of log(SE) on log(N) at |t| = 1.96 and no corrected effect. These checks
# pin the response contract the UI's RDTResultsSummary reads, the input
# guards (sample size mandatory, minimum counts each side of the cutoff), the
# first-stage warning that fires when standard errors are an exact function of
# sample size, the warning for standard errors that were back-computed from
# a rounded t-statistic rather than reported (#564), the thin-data guards for
# a running variable on too few distinct |t| values and for a single study,
# and the smallest detectable jump as an exact noncentral-t multiple of the
# standard error on the headline degrees of freedom (#573).

#' Source rdt_model.R into a private environment
#'
#' The file only defines constants and functions, so sourcing it is cheap and
#' lets the pure helpers be checked directly, on the pattern of
#' request_log_helpers().
#' @return Environment containing the RDT helpers
rdt_model_helpers <- function() {
  helpers <- new.env()
  source(file.path("..", "..", "rdt_model.R"), local = helpers)
  helpers
}

#' Independent computation of the 80%-power multiplier on a t reference
#'
#' The noncentrality m at which P(|T_{df, ncp = m}| > qt(0.975, df)) = 0.80,
#' written separately from the backend so the headline assertion is against
#' the formula rather than the backend's own helper.
#' @param df Degrees of freedom
#' @return The multiplier
rdt_expected_detectable_multiple <- function(df) {
  crit <- stats::qt(0.975, df)
  stats::uniroot(
    function(m) stats::pt(crit, df, ncp = m, lower.tail = FALSE) + stats::pt(-crit, df, ncp = m) - 0.80,
    c(0, 30),
    tol = 1e-10
  )$root
}

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

#' Check the thin-data guards that used to surface raw R errors (#573)
#'
#' The fixtures put every estimate on a few t-statistics by setting the
#' standard error to |effect / t|, and post at full precision (`digits = NA`)
#' the way the browser does: `df_to_json` rounds to four decimals, which
#' smears the repeated t-statistics into noise the guard is not about.
check_rdt_thin_data_guards <- function(df) {
  cat("Checking RDT thin-data guards...\n")
  refuse <- function(data) {
    test_run_rdt(
      jsonlite::toJSON(data, auto_unbox = TRUE, digits = NA),
      params_to_json(list(modelType = "RDT"))
    )
  }
  expect_refusal <- function(response, wanted, raw, label) {
    message <- if (is.null(response$message)) "a successful response" else response$message
    if (!isTRUE(response$error) || !grepl(wanted, message, fixed = TRUE)) {
      stop(sprintf("%s should be refused with a message naming %s; got: %s", label, wanted, message))
    }
    if (grepl(raw, message, fixed = TRUE)) {
      stop(sprintf("%s surfaced the raw R error: %s", label, message))
    }
  }

  # Three t-statistics, both sides of the cutoff populated, so the per-side
  # guard passes and the IK pilot cubic is what would fail.
  few_t <- df
  few_t$sebs <- abs(few_t$bs) / rep(c(1.0, 2.5, 1.5), length.out = nrow(few_t))
  expect_refusal(
    refuse(few_t), "distinct values of |t|", "missing value where TRUE/FALSE needed",
    "A running variable on three distinct |t| values"
  )

  # Six values clear the dataset floor, but every estimate below the cutoff
  # sits on one of them, so the local fit has nothing to draw a line through.
  one_below <- df
  one_below$sebs <- abs(one_below$bs) / rep(c(1.5, 2.0, 2.2, 2.5, 3.0, 4.0), length.out = nrow(one_below))
  expect_refusal(
    refuse(one_below), "inside the estimation window", "leading minor",
    "A window with one distinct |t| value below the cutoff"
  )

  single_study <- df
  single_study$study_id <- "study_1"
  expect_refusal(
    refuse(single_study), "single study", "Cluster-robust variance estimation",
    "Every estimate from a single study"
  )

  # A study id is user text and must reach the message verbatim, braces
  # included; cli would otherwise read "{b}" as a glue expression and fail
  # with a raw R error instead of this guard (#573). "(a{b}c)" has no spaces,
  # so the legacy route's line wrapping cannot split it.
  braced_study <- df
  braced_study$study_id <- "a{b}c"
  expect_refusal(
    refuse(braced_study), "(a{b}c)", "Could not evaluate cli",
    "A single study whose id contains braces"
  )

  invisible(TRUE)
}

#' Check the smallest detectable jump against the exact noncentral-t rule (#573)
#'
#' The interval beside it is a t interval on Satterthwaite degrees of freedom,
#' so the multiplier is the noncentrality that gives 80% power on the same
#' df, not the normal-theory 2.8. Checked three ways: the backend helper
#' against the reference values at df 2.2, 4 and 8; the headline result on the
#' basic fixture against an independent root search on its reported df; and
#' end to end at two cluster counts, where the multiple must track the df.
check_rdt_detectable_jump <- function(results) {
  cat("Checking RDT smallest detectable jump...\n")
  helpers <- rdt_model_helpers()
  reference <- c("2.2" = 5.208, "4" = 3.761, "8" = 3.201)
  for (df in names(reference)) {
    got <- helpers$rdt_detectable_jump_multiple(as.numeric(df))
    if (abs(got - reference[[df]]) > 5e-4) {
      stop(sprintf("The detectable-jump multiple at df %s should be %.3f; got %.4f", df, reference[[df]], got))
    }
  }

  expect_exact_multiple <- function(fit, label) {
    expected <- rdt_expected_detectable_multiple(fit$df)
    ratio <- fit$minDetectableJump / fit$jumpSE
    if (abs(ratio - expected) > 1e-6 * expected) {
      stop(sprintf(
        "%s: minDetectableJump / jumpSE should be the exact 80%%-power multiple %.4f at df %.2f; got %.4f",
        label, expected, fit$df, ratio
      ))
    }
    if (ratio <= 2.8) {
      stop(sprintf("%s: the t-based multiple must exceed the normal-theory 2.8; got %.4f", label, ratio))
    }
    ratio
  }
  expect_exact_multiple(results, "Basic fixture")

  few_clusters <- rdt_results_for(generate_rdt_test_data(n = 150, n_studies = 6))
  many_clusters <- rdt_results_for(generate_rdt_test_data(n = 400, n_studies = 40))
  if (few_clusters$df >= 8 || many_clusters$df <= 15) {
    stop(sprintf(
      "The two cluster counts should straddle the df range (got %.2f and %.2f)",
      few_clusters$df, many_clusters$df
    ))
  }
  few_multiple <- expect_exact_multiple(few_clusters, "Six clusters")
  many_multiple <- expect_exact_multiple(many_clusters, "Forty clusters")
  if (few_multiple <= many_multiple || few_multiple < 3.3 || many_multiple > 3.0) {
    stop(sprintf(
      "The multiple should fall with the degrees of freedom; got %.4f at df %.2f and %.4f at df %.2f",
      few_multiple, few_clusters$df, many_multiple, many_clusters$df
    ))
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

#' Check that a constant standard-error column is refused rather than analysed
#'
#' log(SE) then has no variation at all, so the residual the whole test is built
#' on is identically zero and only QR rounding error at ~1e-15 survives. Before
#' the guard this returned a full result whose half-bandwidth window reported
#' p = 0.002, i.e. the significance of floating-point noise. The R-squared
#' warning cannot catch it: both sums of squares are ~1e-31, so the ratio came
#' out at 0.4999 rather than near 1.
check_rdt_constant_se <- function(df) {
  cat("Checking RDT constant standard error guard...\n")

  constant <- df
  constant$sebs <- 0.1
  response <- test_run_rdt(df_to_json(constant), params_to_json(list(modelType = "RDT")))
  if (!isTRUE(response$error) || !grepl("no usable variation", response$message)) {
    stop(paste(
      "A constant se column should be refused with a message naming the missing variation; got:",
      if (is.null(response$message)) "a successful response" else response$message
    ))
  }

  # Just above the tolerance the column is analysable again, so the guard does
  # not swallow genuinely near-constant but varying standard errors.
  nearly <- df
  nearly$sebs <- 0.1 * (1 + seq_len(nrow(nearly)) * 1e-3)
  ok <- rdt_results_for(nearly)
  if (!is.numeric(ok$jump)) {
    stop("A standard-error column that varies above the tolerance should still produce a jump")
  }

  invisible(TRUE)
}

#' Check the warning that fires when standard errors were back-computed (#564)
#'
#' The detector reads how many significant digits the standard errors carry, so
#' these posts serialize at full precision (`digits = NA`) the way the browser
#' does; the shared `df_to_json` rounds to four decimals and would erase the
#' fingerprint the check is about.
check_rdt_reconstructed_se <- function(df) {
  cat("Checking RDT reconstructed standard error warning...\n")
  warns_reconstructed <- function(data) {
    response <- test_run_rdt(
      jsonlite::toJSON(data, auto_unbox = TRUE, digits = NA),
      params_to_json(list(modelType = "RDT"))
    )
    if (!is.list(response) || is.null(response$data)) {
      stop(paste(
        "Response should contain a 'data' field; got:",
        if (is.null(response$message)) "no message" else response$message
      ))
    }
    any(grepl("back-computed", unlist(response$data$warnings)))
  }

  if (warns_reconstructed(df)) {
    stop("Reported standard errors should not raise the back-computed warning")
  }

  # Standard errors recovered as |effect / t| from a t-statistic printed to
  # two decimal places, as they are in literatures that never report an SE.
  recon <- df
  recon$sebs <- abs(recon$bs / round(recon$bs / recon$sebs, 2))
  if (!warns_reconstructed(recon)) {
    stop("Standard errors back-computed from a 2dp t-statistic should raise a warning")
  }

  # Three printed decimals leave |t| off the 2dp grid, so honest coarse
  # reporting is not flagged.
  recon3 <- df
  recon3$sebs <- abs(recon3$bs / round(recon3$bs / recon3$sebs, 3))
  if (warns_reconstructed(recon3)) {
    stop("Standard errors back-computed from a 3dp t-statistic should not raise a warning")
  }

  invisible(TRUE)
}

#' Check that the reported jump has the sign of the discontinuity in the data
#'
#' The unplanted fixture has no discontinuity, so every other assertion here
#' passes under a sign flip in the estimator (#565). These two do not: a
#' downward jump is planted first, then an upward one, on a fixture large
#' enough to separate them from noise by a wide margin (the planted jumps are
#' about -0.33 and +0.27 against an unplanted -0.03).
check_rdt_jump_sign <- function() {
  cat("Checking the sign of the RDT jump...\n")
  base <- generate_rdt_test_data(n = 400, n_studies = 40)

  down <- rdt_results_for(plant_rdt_jump(base, 0.30))
  if (down$jump > -0.15) {
    stop(sprintf(
      "Shrinking the standard errors above the cutoff should give a downward jump; got %+0.4f",
      down$jump
    ))
  }
  if (down$pValue > 0.01) {
    stop(sprintf("The planted downward jump should be significant; got p = %0.4f", down$pValue))
  }

  up <- rdt_results_for(plant_rdt_jump(base, -0.30))
  if (up$jump < 0.15) {
    stop(sprintf(
      "Inflating the standard errors above the cutoff should give an upward jump; got %+0.4f",
      up$jump
    ))
  }
  if (up$pValue > 0.01) {
    stop(sprintf("The planted upward jump should be significant; got p = %0.4f", up$pValue))
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
        "model", "jump", "jumpSE", "jumpCI", "pValue", "df", "cutoff", "bandwidth",
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
      if (!is.numeric(results$df) || results$df <= 0) {
        stop("df should be the positive Satterthwaite degrees of freedom of the jump")
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

      check_rdt_detectable_jump(results)
      check_rdt_jump_sign()
      check_rdt_input_guards(test_data)
      check_rdt_thin_data_guards(test_data)
      check_rdt_constant_se(test_data)
      check_rdt_exact_first_stage(test_data)
      check_rdt_no_study_column(test_data)
      check_rdt_reconstructed_se(test_data)

      log_test_result(test_name, "PASS", "Basic RDT functionality working correctly")
      return(list(status = "PASS", test_name = test_name, results = results))
    },
    error = function(e) {
      log_test_result(test_name, "FAIL", e$message)
      return(list(status = "FAIL", test_name = test_name, error = e$message))
    }
  )
}
