# NaN Instrumented SE Test Scenario (#571)
#
# Twenty rows with the same effect and standard errors that grow with the
# sample size. The levels first stage fits a negative variance for the first
# row. Before MAIVE 0.4.0, sqrt() turned it into NaN: the response carried the
# string "NaN" inside the number-typed seInstrumented array, next to two raw
# base-R warnings ("NaNs produced", "essentially perfect fit"). MAIVE 0.4.0
# (PetrCala/MAIVE#24) excludes the estimate itself and warns with the count
# (n_excluded), so this scenario pins the current contract: "NA" for that
# instrumented SE, the package's exclusion warning, and no raw base-R warning.
# It needs the pinned MAIVE (0.4.0 or later); a local library on an older
# MAIVE fails the exclusion check (scripts/install-maive-tag.sh updates it).
#
# Uses run_model_or_fail() and assert_warnings_array() from
# response_cleanup_test.R, which the runner sources first.

# Same rows as the reproduction in the issue: i = 0..19.
NAN_SE_INSTRUMENTED_FIXTURE <- local({
  i <- 0:19
  data.frame(
    effect = rep(0.3, 20),
    se = 0.05 + 0.005 * i,
    n_obs = 100 + 37 * i
  )
})

#' Locate docs/api/openapi.yaml from wherever the runner was started
#' @return Absolute path to the spec
openapi_spec_path <- function() {
  candidates <- c(
    file.path("..", "..", "..", "..", "..", "docs", "api", "openapi.yaml"), # from tests/e2e
    file.path("..", "..", "..", "docs", "api", "openapi.yaml"), # from r_scripts
    file.path("docs", "api", "openapi.yaml") # from the repository root
  )
  for (candidate in candidates) {
    if (file.exists(candidate)) {
      return(normalizePath(candidate))
    }
  }
  stop("docs/api/openapi.yaml not found relative to the working directory")
}

#' Rewrite OpenAPI 3.0 `nullable: true` into JSON Schema type unions
#'
#' ajv validates JSON Schema, where `nullable` is not a keyword: a `null`
#' value would fail `type: boolean`. A node with a `type` gets `"null"`
#' appended to it; a node without one (a bare `allOf`/`oneOf`) is wrapped in
#' an `anyOf` with `{type: "null"}`.
#' @param node A parsed schema node
#' @return The node with every `nullable` translated
openapi_nullable_to_json_schema <- function(node) {
  if (!is.list(node)) {
    return(node)
  }
  if (isTRUE(node$nullable)) {
    node$nullable <- NULL
    if (!is.null(node$type)) {
      node$type <- I(c(as.character(node$type), "null"))
    } else {
      node <- list(anyOf = list(node, list(type = "null")))
    }
  }
  lapply(node, openapi_nullable_to_json_schema)
}

#' Build a validator for one documented 200 response schema
#'
#' Reads docs/api/openapi.yaml, takes the `application/json` schema of the
#' given path's POST 200 response, and resolves its `$ref`s against the spec's
#' own components, so the e2e suite checks the same contract the UI ships at
#' /openapi.yaml.
#' @param path The documented path, e.g. "/v1/run-model"
#' @return A jsonvalidate validator function
openapi_response_validator <- function(path) {
  spec_text <- readLines(openapi_spec_path(), encoding = "UTF-8", warn = FALSE)
  # I() keeps single-element YAML sequences (`enum: ["NA"]`, `required: [x]`)
  # as JSON arrays when the schema is serialized below.
  spec <- yaml::yaml.load(paste(spec_text, collapse = "\n"), handlers = list(seq = function(x) I(x)))
  response_schema <- spec$paths[[path]]$post$responses[["200"]]$content[["application/json"]]$schema
  if (is.null(response_schema)) {
    stop(paste("No 200 JSON schema documented for POST", path))
  }
  root <- c(response_schema, list(components = list(schemas = spec$components$schemas)))
  root <- openapi_nullable_to_json_schema(root)
  jsonvalidate::json_validator(jsonlite::toJSON(root, auto_unbox = TRUE), engine = "ajv")
}

#' Test that an undefined instrumented SE is "NA", never "NaN", and validates
#' @return Test results
test_nan_se_instrumented <- function() {
  test_name <- "NaN Instrumented SE Test"

  tryCatch(
    {
      cat("Testing twenty identical effects whose first stage fits a negative variance...\n")

      response <- httr::POST(
        paste0(API_BASE_URL, "/v1/run-model"),
        body = list(
          data = NAN_SE_INSTRUMENTED_FIXTURE,
          parameters = list(modelType = "MAIVE")
        ),
        encode = "json",
        httr::timeout(API_TIMEOUT)
      )
      if (httr::status_code(response) != 200) {
        stop(paste("/v1/run-model returned status", httr::status_code(response)))
      }
      body_text <- httr::content(response, "text", encoding = "UTF-8")
      results <- jsonlite::fromJSON(body_text, simplifyVector = FALSE)

      se_instrumented <- results$seInstrumented
      if (!is.list(se_instrumented) || length(se_instrumented) != nrow(NAN_SE_INSTRUMENTED_FIXTURE)) {
        stop(sprintf(
          "seInstrumented should be an array with one entry per row, got length %d",
          length(se_instrumented)
        ))
      }
      is_na_string <- vapply(se_instrumented, function(x) identical(x, "NA"), logical(1))
      is_number <- vapply(se_instrumented, function(x) is.numeric(x) && is.finite(x), logical(1))
      if (!all(is_na_string | is_number)) {
        stop("seInstrumented entries must be finite numbers or the string \"NA\"")
      }
      if (!any(is_na_string)) {
        stop("Expected at least one \"NA\" entry in seInstrumented for this dataset")
      }
      if (!any(is_number)) {
        stop("Expected the well-defined rows to keep numeric instrumented SEs")
      }
      # The quotes matter: warning text may legitimately contain the letters
      # (MAIVE before 0.4.0 raised "NaNs produced"); a JSON string value "NaN"
      # is the bug.
      if (grepl("\"NaN\"", body_text, fixed = TRUE)) {
        stop("The raw response must not contain the JSON string \"NaN\" anywhere")
      }

      assert_warnings_array(results$warnings)
      warning_text <- unlist(results$warnings)
      if (any(grepl("essentially perfect fit", warning_text, fixed = TRUE))) {
        stop("The raw base-R 'essentially perfect fit' warning must not reach the caller")
      }
      # MAIVE 0.4.0 reports the excluded estimates itself (PetrCala/MAIVE#24),
      # which is the explicit replacement #571 asked for before "NaNs produced"
      # could go. Pin the replacement, and that the raw warning is gone.
      # Whitespace is collapsed because the legacy routes wrap cli messages.
      flat_warnings <- gsub("\\s+", " ", warning_text)
      if (!any(grepl("excluded from the analysis \\(n_excluded = [0-9]+\\)", flat_warnings))) {
        stop("Expected the package's exclusion warning with the n_excluded count")
      }
      if (any(grepl("NaNs produced", flat_warnings, fixed = TRUE))) {
        stop("The raw base-R 'NaNs produced' warning should no longer reach the caller")
      }

      validate <- openapi_response_validator("/v1/run-model")
      is_valid <- validate(body_text, verbose = TRUE)
      if (!isTRUE(is_valid)) {
        errors <- attr(is_valid, "errors")
        detail <- if (is.null(errors)) "" else paste(errors$instancePath, errors$message, collapse = "; ")
        stop(paste("Response does not validate against the openapi.yaml schema:", detail))
      }

      # The legacy /run-model route the browser uses shares the result builder.
      legacy <- run_model_or_fail(NAN_SE_INSTRUMENTED_FIXTURE)
      legacy_se <- legacy$data$seInstrumented
      if (!any(vapply(legacy_se, function(x) identical(x, "NA"), logical(1)))) {
        stop("/run-model should report the undefined instrumented SE as \"NA\" too")
      }
      if (any(vapply(legacy_se, function(x) identical(x, "NaN"), logical(1)))) {
        stop("/run-model must not carry the string \"NaN\" in seInstrumented")
      }

      log_test_result(
        test_name, "PASS",
        sprintf(
          "%d of %d instrumented SEs undefined, %d warning(s), schema valid",
          sum(is_na_string), length(se_instrumented), length(warning_text)
        )
      )

      return(list(status = "PASS", test_name = test_name, results = results))
    },
    error = function(e) {
      log_test_result(test_name, "FAIL", e$message)
      return(list(status = "FAIL", test_name = test_name, error = e$message))
    }
  )
}
