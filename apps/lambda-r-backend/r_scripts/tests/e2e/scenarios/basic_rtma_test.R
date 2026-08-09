# Basic RTMA Test Scenario
#
# Also covers two regressions fixed alongside this scenario:
#   * #486: phacking::z_density() always draws its dashed critical line at
#     +tcrit, so run_rtma_model() must flip the plotted yi to match
#     phacking_meta()'s internal favor_positive handling. Otherwise the plot
#     disagrees with the affirmative/nonaffirmative counts reported beside it
#     whenever the favored direction is negative.
#   * #483 (section 3): run_rtma_model()'s include_plot argument must
#     actually skip the ragg render, not just have /v1 discard the fields
#     after the fact.

#' Build RTMA parameter JSON, defaulting to the basic test's settings
#' @param favor_positive Value for the favorPositive parameter
#' @return JSON string of parameters
basic_rtma_params <- function(favor_positive = TRUE) {
  params_to_json(list(
    modelType = "RTMA",
    favorPositive = favor_positive,
    alphaSelect = 0.05,
    ciLevel = 0.95,
    winsorize = 0
  ))
}

#' Check that the z-score plot stays in sync with the favored direction
#'
#' phacking::z_density() has no favor_positive argument, so run_rtma_model()
#' must flip the yi it plots exactly like phacking_meta() flips the yi it
#' fits on. A dataset and its exact sign-mirror, fit with the correspondingly
#' mirrored favorPositive, therefore feed z_density() the identical (yi, vi)
#' pair either way, so a correct implementation renders a byte-identical
#' plot for both and reports the same affirmative/nonaffirmative split.
check_rtma_plot_direction <- function() {
  cat("Checking RTMA plot direction awareness...\n")

  positive_data <- generate_rtma_test_data()
  negative_data <- positive_data
  negative_data$bs <- -negative_data$bs

  positive_response <- test_run_rtma(
    df_to_json(positive_data), basic_rtma_params(TRUE)
  )
  negative_response <- test_run_rtma(
    df_to_json(negative_data), basic_rtma_params(FALSE)
  )

  positive_results <- positive_response$data
  negative_results <- negative_response$data

  if (
    is.null(positive_results$zScorePlot) || positive_results$zScorePlot == "" ||
      is.null(negative_results$zScorePlot) || negative_results$zScorePlot == ""
  ) {
    stop("Direction check: both the original and mirrored runs should return a zScorePlot")
  }

  if (positive_results$zScorePlot != negative_results$zScorePlot) {
    stop(paste(
      "Direction check: a dataset and its favorPositive-mirrored counterpart",
      "should render an identical z-score plot (both feed z_density() the",
      "same yi/vi); the plot has drifted out of sync with the favored",
      "direction again"
    ))
  }

  if (positive_results$affirmativeCount != negative_results$affirmativeCount) {
    stop("Direction check: mirrored runs should report the same affirmativeCount")
  }
  if (positive_results$nonaffirmativeCount != negative_results$nonaffirmativeCount) {
    stop("Direction check: mirrored runs should report the same nonaffirmativeCount")
  }

  invisible(TRUE)
}

#' Check that include_plot actually gates the plot, not just /v1 field stripping
#'
#' Requests the same dataset through /v1/run-rtma with and without
#' `?include=plot` and checks that the only difference between the two
#' response schemas is the presence of the three plot fields.
check_rtma_include_plot_gating <- function() {
  cat("Checking RTMA include_plot gating via /v1/run-rtma...\n")

  # Default n: generate_rtma_test_data() is tuned so roughly two thirds of the
  # estimates are nonaffirmative and the fit is well identified. A smaller,
  # ad hoc n here previously left tau poorly identified, which let the sampler
  # wander into a pathologically deep tree and stall this check for minutes.
  gating_data <- generate_rtma_test_data()
  body <- list(data = df_to_v1_rows(gating_data))

  default_response <- v1_post_json("/v1/run-rtma", body, timeout = 300)
  if (httr::status_code(default_response) != 200) {
    stop(paste(
      "Gating check: default /v1/run-rtma request failed with status",
      httr::status_code(default_response)
    ))
  }
  default_body <- v1_parse_body(default_response)

  plotted_response <- v1_post_json(
    "/v1/run-rtma", body,
    query = list(include = "plot"), timeout = 300
  )
  if (httr::status_code(plotted_response) != 200) {
    stop(paste(
      "Gating check: ?include=plot /v1/run-rtma request failed with status",
      httr::status_code(plotted_response)
    ))
  }
  plotted_body <- v1_parse_body(plotted_response)

  plot_fields <- c("zScorePlot", "zScorePlotWidth", "zScorePlotHeight")

  present_without_include <- intersect(plot_fields, names(default_body))
  if (length(present_without_include) > 0) {
    stop(paste(
      "Gating check: default response should omit plot fields, found:",
      paste(present_without_include, collapse = ", ")
    ))
  }

  missing_with_include <- setdiff(plot_fields, names(plotted_body))
  if (length(missing_with_include) > 0) {
    stop(paste(
      "Gating check: ?include=plot response should carry plot fields, missing:",
      paste(missing_with_include, collapse = ", ")
    ))
  }
  if (is.null(plotted_body$zScorePlot) || plotted_body$zScorePlot == "") {
    stop("Gating check: ?include=plot response should have a non-empty zScorePlot")
  }

  non_plot_fields_match <- setequal(
    setdiff(names(default_body), plot_fields),
    setdiff(names(plotted_body), plot_fields)
  )
  if (!non_plot_fields_match) {
    stop(paste(
      "Gating check: responses should carry the same non-plot fields",
      "regardless of include_plot, differing only in the plot fields"
    ))
  }

  invisible(TRUE)
}

#' Check the convergence diagnostics block (#480)
#'
#' phacking_meta() computes all of these and run_rtma_model() used to discard
#' them, which left a failed fit and a clean fit looking identical in the
#' response.
#'
#' The bounds below check that each field is the quantity it claims to be, not
#' that this particular fit is a good one. r_hat and n_eff sit in disjoint
#' ranges, so a check phrased this way still fails loudly if the two are ever
#' swapped or read off the wrong tibble column, while leaving the suite free to
#' use a fixture whose chains mix imperfectly. This fixture is one: its mu
#' r_hat is around 1.03, which is exactly the kind of run that used to be
#' reported as a clean number.
#'
#' @param results Parsed RTMA results object
#' @return TRUE invisibly
check_rtma_diagnostics <- function(results) {
  cat("Checking RTMA convergence diagnostics...\n")

  diagnostics <- results$diagnostics
  if (!is.list(diagnostics)) {
    stop("diagnostics should be an object")
  }

  missing <- setdiff(
    c("optimConverged", "rHat", "nEff", "divergences"),
    names(diagnostics)
  )
  if (length(missing) > 0) {
    stop(paste(
      "Missing RTMA diagnostics fields:",
      paste(missing, collapse = ", ")
    ))
  }

  # The mode this response reports comes out of that optimisation, so a FALSE
  # here would mean the fixture's headline estimate is unusable.
  if (!isTRUE(diagnostics$optimConverged)) {
    stop(paste(
      "optimConverged should be TRUE on this fixture; the reported mode comes",
      "from that optimisation, so anything else means either the mode is",
      "unusable or the flag is being read from the wrong place"
    ))
  }

  # Per-parameter, because the sampler can mix well for one and badly for the
  # other and a single number would hide which.
  for (param in c("mu", "tau")) {
    r_hat <- diagnostics$rHat[[param]]
    if (!is.numeric(r_hat) || length(r_hat) != 1 || r_hat < 1 || r_hat > 2) {
      stop(sprintf(
        "rHat$%s should be a single number in [1, 2], got %s",
        param, paste(r_hat, collapse = ", ")
      ))
    }

    n_eff <- diagnostics$nEff[[param]]
    if (!is.numeric(n_eff) || length(n_eff) != 1 || n_eff <= 10) {
      stop(sprintf(
        "nEff$%s should be a single number above 10, got %s",
        param, paste(n_eff, collapse = ", ")
      ))
    }
  }

  if (!is.numeric(diagnostics$divergences) || diagnostics$divergences < 0) {
    stop("divergences should be a non-negative count")
  }

  invisible(TRUE)
}

#' Test basic RTMA functionality
#' @return Test results
test_basic_rtma <- function() {
  test_name <- "Basic RTMA Test"

  tryCatch(
    {
      # Generate test data (only need yi and se columns)
      test_data <- generate_test_data(
        n_studies = 25,
        include_study_id = FALSE
      )

      # RTMA parameters
      params <- list(
        modelType = "RTMA",
        favorPositive = TRUE,
        alphaSelect = 0.05,
        ciLevel = 0.95,
        winsorize = 0
      )

      # Convert to JSON
      file_data_json <- df_to_json(test_data)
      params_json <- params_to_json(params)

      # Call RTMA API
      cat("Running basic RTMA test...\n")
      response <- test_run_rtma(
        file_data_json,
        params_json
      )

      # Validate response has data field
      if (!is.list(response) || is.null(response$data)) {
        stop("Response should contain a 'data' field")
      }

      results <- response$data

      # Validate RTMA result fields
      rtma_fields <- c(
        "mu", "muMedian", "muCI", "tau", "tauMedian", "tauCI",
        "unadjustedMean", "ciLevel",
        "k", "affirmativeCount", "droppedRows",
        "zScorePlot", "zScorePlotWidth",
        "zScorePlotHeight",
        "nonaffirmativeCount",
        "nonaffirmativeProportion",
        "warnings",
        "diagnostics"
      )

      missing <- setdiff(
        rtma_fields,
        names(results)
      )
      if (length(missing) > 0) {
        stop(paste(
          "Missing RTMA fields:",
          paste(missing, collapse = ", ")
        ))
      }

      # Check mu is numeric
      if (!is.numeric(results$mu)) {
        stop("mu should be numeric")
      }

      # Check tau is numeric and non-negative
      if (!is.numeric(results$tau) || results$tau < 0) {
        stop("tau should be non-negative numeric")
      }

      # Check muCI is a pair
      if (length(results$muCI) != 2) {
        stop("muCI should have 2 elements")
      }

      # Check tauCI is a pair
      if (length(results$tauCI) != 2) {
        stop("tauCI should have 2 elements")
      }

      # Check z-score plot was generated
      if (
        is.null(results$zScorePlot) ||
          results$zScorePlot == ""
      ) {
        stop("Z-score plot should be generated")
      }

      # Check nonaffirmative stats
      if (results$nonaffirmativeCount < 0) {
        stop("nonaffirmativeCount should be >= 0")
      }
      if (
        results$nonaffirmativeProportion < 0 ||
          results$nonaffirmativeProportion > 1
      ) {
        stop(
          "nonaffirmativeProportion should be in [0, 1]"
        )
      }

      # Check the count bookkeeping is internally consistent
      if (
        results$affirmativeCount + results$nonaffirmativeCount != results$k
      ) {
        stop("affirmativeCount + nonaffirmativeCount should equal k")
      }
      if (results$droppedRows < 0) {
        stop("droppedRows should be >= 0")
      }

      # The unadjusted mean must sit inside plausible bounds of the data and
      # the medians inside their credible intervals
      if (!is.numeric(results$unadjustedMean)) {
        stop("unadjustedMean should be numeric")
      }
      if (
        results$muMedian < results$muCI[1] ||
          results$muMedian > results$muCI[2]
      ) {
        stop("muMedian should lie inside muCI")
      }
      if (
        results$tauMedian < results$tauCI[1] ||
          results$tauMedian > results$tauCI[2]
      ) {
        stop("tauMedian should lie inside tauCI")
      }

      # #480: the diagnostics that say whether any of the above is trustworthy
      check_rtma_diagnostics(results)

      # #486: plot must stay in sync with the favored direction
      check_rtma_plot_direction()

      # #483 section 3: include_plot must actually gate the render
      check_rtma_include_plot_gating()

      log_test_result(
        test_name, "PASS",
        "Basic RTMA functionality working correctly"
      )

      return(list(
        status = "PASS",
        test_name = test_name,
        results = results
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
