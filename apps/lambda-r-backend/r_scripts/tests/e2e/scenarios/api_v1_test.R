# API v1 Test Scenario
#
# Covers the public /v1 routes (docs/PUBLIC_API_DESIGN.md): plain nested JSON
# request bodies, column resolution by canonical name with positional
# fallback, parameter defaulting, structured 400 validation errors, plot
# opt-in via ?include=plot, the /v1/health alias, and unchanged legacy-route
# behavior.

#' Load a CSV fixture from the shared fixtures directory
load_api_v1_fixture <- function(file) {
  read.csv(file.path(TEST_DATA_DIR, file), stringsAsFactors = FALSE)
}

#' Fail with a message unless a condition holds
expect_api_v1 <- function(condition, message) {
  if (!isTRUE(condition)) {
    stop(message)
  }
}

#' Assert a /v1 response carries the structured 400 validation envelope
expect_api_v1_validation_error <- function(response, label) {
  status <- httr::status_code(response)
  expect_api_v1(
    status == 400,
    sprintf("%s: expected status 400, got %d", label, status)
  )

  body <- v1_parse_body(response)
  expect_api_v1(
    identical(body$error$code, "validation_error"),
    sprintf("%s: expected error code 'validation_error'", label)
  )
  expect_api_v1(
    is.character(body$error$message) && nzchar(body$error$message),
    sprintf("%s: expected a non-empty error message", label)
  )
}

#' Assert a /v1 response succeeded and return its parsed body
expect_api_v1_success <- function(response, label) {
  status <- httr::status_code(response)
  if (status != 200) {
    body <- tryCatch(v1_parse_body(response), error = function(e) NULL)
    detail <- if (!is.null(body$error$message)) body$error$message else ""
    stop(sprintf("%s: expected status 200, got %d. %s", label, status, detail))
  }
  v1_parse_body(response)
}

#' Test the public /v1 API surface
#' @return Test results
test_api_v1 <- function() {
  test_name <- "API v1 Test"

  tryCatch(
    {
      fixture_3col <- load_api_v1_fixture("sample_data_3col.csv")
      fixture_4col <- load_api_v1_fixture("sample_data_4col.csv")

      canonical_df <- data.frame(
        effect = fixture_3col$bs,
        se = fixture_3col$sebs,
        n_obs = fixture_3col$Ns
      )
      canonical_rows <- df_to_v1_rows(canonical_df)
      positional_rows <- df_to_v1_rows(fixture_3col) # keys bs/sebs/Ns -> positional

      # The raw 4-column fixture has one unique study per row, which violates
      # the "rows >= unique studies + 3" rule; regroup into 5 studies of 4
      # rows for the happy path and keep the raw fixture for the 400 test.
      grouped_4col <- fixture_4col
      grouped_4col$study_id <- paste0("study_", rep(seq_len(5), each = 4))
      grouped_rows <- df_to_v1_rows(grouped_4col)

      # 1. GET /v1/health
      cat("Testing GET /v1/health...\n")
      health_body <- expect_api_v1_success(v1_get("/v1/health"), "GET /v1/health")
      expect_api_v1(
        identical(health_body$status, "ok"),
        "GET /v1/health: expected status field 'ok'"
      )
      expect_api_v1(
        is.character(health_body$time) && nzchar(health_body$time),
        "GET /v1/health: expected a non-empty time field"
      )

      # 2. Happy path with explicit parameters (positional 4-column data)
      cat("Testing /v1/run-model happy path with explicit parameters...\n")
      explicit_params <- list(
        modelType = "MAIVE",
        maiveMethod = "PET-PEESE",
        weight = "equal_weights",
        standardErrorTreatment = "clustered_cr2",
        includeStudyDummies = FALSE,
        includeStudyClustering = TRUE,
        computeAndersonRubin = FALSE,
        useLogFirstStage = FALSE,
        winsorize = 0,
        shouldUseInstrumenting = TRUE
      )
      explicit_body <- expect_api_v1_success(
        v1_post_json(
          "/v1/run-model",
          list(data = grouped_rows, parameters = explicit_params)
        ),
        "explicit-params run"
      )
      expect_api_v1(
        is.numeric(explicit_body$effectEstimate),
        "explicit-params run: effectEstimate should be numeric"
      )
      expect_api_v1(
        is.numeric(explicit_body$standardError) && explicit_body$standardError > 0,
        "explicit-params run: standardError should be positive"
      )
      expect_api_v1(
        is.null(explicit_body$data),
        "explicit-params run: results must be at the top level (no data envelope)"
      )
      expect_api_v1(
        is.null(explicit_body$funnelPlot) && is.null(explicit_body$funnelPlotWidth),
        "explicit-params run: plot fields must be stripped by default"
      )

      # 3. Minimal request: data only, all defaults applied
      cat("Testing /v1/run-model minimal request (defaults)...\n")
      minimal_body <- expect_api_v1_success(
        v1_post_json("/v1/run-model", list(data = canonical_rows)),
        "minimal run"
      )
      expect_api_v1(
        is.numeric(minimal_body$effectEstimate),
        "minimal run: effectEstimate should be numeric"
      )
      expect_api_v1(
        is.null(minimal_body$funnelPlot),
        "minimal run: plot fields must be stripped by default"
      )

      # 4. Positional fallback matches canonical resolution on the same data
      cat("Testing /v1/run-model positional column fallback...\n")
      positional_body <- expect_api_v1_success(
        v1_post_json("/v1/run-model", list(data = positional_rows)),
        "positional run"
      )
      expect_api_v1(
        abs(positional_body$effectEstimate - minimal_body$effectEstimate) < 1e-8,
        "positional run: estimate should match the canonical-name run"
      )

      # 5. Canonical names win over key order
      cat("Testing /v1/run-model canonical name resolution...\n")
      scrambled_rows <- lapply(canonical_rows, function(row) {
        row[c("n_obs", "effect", "se")]
      })
      scrambled_body <- expect_api_v1_success(
        v1_post_json("/v1/run-model", list(data = scrambled_rows)),
        "scrambled-keys run"
      )
      expect_api_v1(
        abs(scrambled_body$effectEstimate - minimal_body$effectEstimate) < 1e-8,
        "scrambled-keys run: canonical keys must be resolved by name, not position"
      )

      # 6. Plot opt-in via ?include=plot
      cat("Testing /v1/run-model plot opt-in...\n")
      plot_body <- expect_api_v1_success(
        v1_post_json(
          "/v1/run-model",
          list(data = canonical_rows),
          query = list(include = "plot")
        ),
        "plot opt-in run"
      )
      expect_api_v1(
        is.character(plot_body$funnelPlot) &&
          startsWith(plot_body$funnelPlot, "data:image/png;base64,"),
        "plot opt-in run: funnelPlot should be a PNG data URI"
      )
      expect_api_v1(
        is.numeric(plot_body$funnelPlotWidth) && plot_body$funnelPlotWidth > 0,
        "plot opt-in run: funnelPlotWidth should be positive"
      )

      # 7. Validation failures return structured 400s
      cat("Testing /v1/run-model validation errors...\n")
      expect_api_v1_validation_error(
        v1_post_json("/v1/run-model", list(data = canonical_rows[1:3])),
        "too few rows"
      )

      five_col_rows <- lapply(canonical_rows, function(row) {
        c(stats::setNames(row, c("a", "b", "c")), list(d = 1, e = 2))
      })
      expect_api_v1_validation_error(
        v1_post_json("/v1/run-model", list(data = five_col_rows)),
        "wrong column count"
      )

      non_numeric_rows <- canonical_rows
      non_numeric_rows[[1]]$effect <- "not-a-number"
      expect_api_v1_validation_error(
        v1_post_json("/v1/run-model", list(data = non_numeric_rows)),
        "non-numeric effect"
      )

      bad_se_rows <- canonical_rows
      bad_se_rows[[1]]$se <- 0
      expect_api_v1_validation_error(
        v1_post_json("/v1/run-model", list(data = bad_se_rows)),
        "non-positive se"
      )

      bad_n_obs_rows <- canonical_rows
      bad_n_obs_rows[[1]]$n_obs <- 10.5
      expect_api_v1_validation_error(
        v1_post_json("/v1/run-model", list(data = bad_n_obs_rows)),
        "non-integer n_obs"
      )

      # The raw 4-column fixture: 20 rows, 20 unique studies -> rule violated
      expect_api_v1_validation_error(
        v1_post_json("/v1/run-model", list(data = df_to_v1_rows(fixture_4col))),
        "rows vs unique studies rule"
      )

      expect_api_v1_validation_error(
        v1_post_json("/v1/run-model", list(parameters = list(modelType = "MAIVE"))),
        "missing data field"
      )

      expect_api_v1_validation_error(
        v1_post_json(
          "/v1/run-model",
          list(data = canonical_rows, parameters = list(modelType = "INVALID"))
        ),
        "invalid modelType enum"
      )

      expect_api_v1_validation_error(
        v1_post_json(
          "/v1/run-model",
          list(data = canonical_rows, parameters = list(computeAndersonRubin = "yes"))
        ),
        "non-boolean flag parameter"
      )

      # A body that is not valid JSON fails before the handler runs; the
      # global error handler in host.R must still produce the 400 envelope.
      expect_api_v1_validation_error(
        v1_post_raw("/v1/run-model", "not json at all"),
        "malformed JSON body"
      )

      # Canonical names are matched case-insensitively
      cat("Testing /v1/run-model case-insensitive canonical names...\n")
      uppercase_rows <- lapply(canonical_rows, function(row) {
        stats::setNames(row, toupper(names(row)))
      })
      uppercase_body <- expect_api_v1_success(
        v1_post_json("/v1/run-model", list(data = uppercase_rows)),
        "uppercase-keys run"
      )
      expect_api_v1(
        abs(uppercase_body$effectEstimate - minimal_body$effectEstimate) < 1e-8,
        "uppercase-keys run: canonical names must match case-insensitively"
      )

      # 8. RTMA: minimal request with defaults, plots stripped
      # Deterministic data with a solid share of nonaffirmative estimates;
      # mostly-affirmative datasets make the phacking sampler unpredictably
      # slow, which would flake this test.
      cat("Testing /v1/run-rtma minimal request (this may take a while)...\n")
      rtma_data <- data.frame(
        effect = rep(c(0.05, 0.10, 0.15, 0.25, 0.35), each = 8),
        se = rep(0.1, 40)
      )
      rtma_body <- expect_api_v1_success(
        v1_post_json(
          "/v1/run-rtma",
          list(data = df_to_v1_rows(rtma_data)),
          timeout = 300
        ),
        "RTMA minimal run"
      )
      expect_api_v1(
        is.numeric(rtma_body$mu),
        "RTMA minimal run: mu should be numeric"
      )
      expect_api_v1(
        length(rtma_body$muCI) == 2,
        "RTMA minimal run: muCI should have 2 elements"
      )
      expect_api_v1(
        is.null(rtma_body$zScorePlot) && is.null(rtma_body$zScorePlotWidth),
        "RTMA minimal run: plot fields must be stripped by default"
      )

      # 9. RTMA validation failure: single-column data
      cat("Testing /v1/run-rtma validation errors...\n")
      one_col_rows <- lapply(fixture_3col$bs, function(value) list(x = value))
      expect_api_v1_validation_error(
        v1_post_json("/v1/run-rtma", list(data = one_col_rows)),
        "RTMA single column"
      )

      # 10. Legacy routes still behave as before (200 + data envelope,
      # and 200 with an error body on failure)
      cat("Testing legacy route parity...\n")
      legacy_response <- test_run_model(
        df_to_json(grouped_4col),
        params_to_json(DEFAULT_PARAMETERS)
      )
      expect_api_v1(
        is.numeric(legacy_response$data$effectEstimate),
        "legacy run-model: expected results under a data envelope"
      )
      expect_api_v1(
        is.character(legacy_response$data$funnelPlot) &&
          nzchar(legacy_response$data$funnelPlot),
        "legacy run-model: funnel plot should still be included"
      )

      legacy_error_response <- httr::POST(
        paste0(API_BASE_URL, "/run-model"),
        body = list(
          data = "not json",
          parameters = params_to_json(DEFAULT_PARAMETERS)
        ),
        encode = "form",
        httr::timeout(API_TIMEOUT)
      )
      expect_api_v1(
        httr::status_code(legacy_error_response) == 200,
        "legacy run-model error: must keep returning HTTP 200"
      )
      legacy_error_body <- httr::content(legacy_error_response, "parsed")
      expect_api_v1(
        isTRUE(legacy_error_body$error),
        "legacy run-model error: must keep the {error: true} body shape"
      )

      log_test_result(
        test_name, "PASS",
        "Public /v1 endpoints working correctly; legacy routes unchanged"
      )

      return(list(
        status = "PASS",
        test_name = test_name
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
