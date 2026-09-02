# Resolver Parity Test Scenario (#555)
#
# The UI's shared parameter resolver (apps/react-ui/client/src/lib/
# parameterResolver.ts) and the backend's api_v1.R resolve the same request
# on the same data to the same parameters. Both are pinned to
# fixtures/resolver_parity.json: the Vitest suite runs the cases through the
# TypeScript resolver, and this scenario posts them to the live /v1 routes and
# checks the `resolvedParameters` / `recipe` echo (or the 400) the backend
# returns.

#' Read the shared parity fixture
load_resolver_parity_cases <- function() {
  jsonlite::fromJSON(
    file.path(TEST_DATA_DIR, "resolver_parity.json"),
    simplifyVector = FALSE
  )$cases
}

#' Fail with a message unless a condition holds
expect_parity <- function(condition, message) {
  if (!isTRUE(condition)) {
    stop(message)
  }
}

#' Rows to post for a case, chosen by family and data shape
resolver_parity_rows <- function(case) {
  if (identical(case$family, "rtma")) {
    # Deterministic data with a solid share of nonaffirmative estimates so the
    # sampler finishes quickly (same dataset as api_v1_test.R).
    rtma_data <- data.frame(
      effect = rep(c(0.05, 0.10, 0.15, 0.25, 0.35), each = 8),
      se = rep(0.1, 40)
    )
    return(df_to_v1_rows(rtma_data))
  }

  if (isTRUE(case$dataShape$hasStudyIdColumn)) {
    fixture <- read.csv(file.path(TEST_DATA_DIR, "sample_data_4col.csv"), stringsAsFactors = FALSE)
    # Regroup into 5 studies of 4 rows so the rows >= studies + 3 rule holds.
    fixture$study_id <- paste0("study_", rep(seq_len(5), each = 4))
    return(df_to_v1_rows(fixture))
  }

  fixture <- read.csv(file.path(TEST_DATA_DIR, "sample_data_3col.csv"), stringsAsFactors = FALSE)
  df_to_v1_rows(data.frame(effect = fixture$bs, se = fixture$sebs, n_obs = fixture$Ns))
}

#' Compare one resolved field with its expected value
expect_parity_field <- function(case_name, key, actual, expected) {
  expect_parity(
    !is.null(actual),
    sprintf("%s: resolvedParameters is missing `%s`", case_name, key)
  )
  same <- if (is.numeric(expected)) {
    is.numeric(actual) && isTRUE(all.equal(as.numeric(actual), as.numeric(expected)))
  } else {
    identical(actual, expected)
  }
  expect_parity(
    same,
    sprintf(
      "%s: resolvedParameters$%s is %s, expected %s",
      case_name, key, paste(format(actual), collapse = ","), paste(format(expected), collapse = ",")
    )
  )
}

#' Test that the backend resolver matches the shared fixture
#' @return Test results
test_resolver_parity <- function() {
  test_name <- "Resolver Parity Test"

  tryCatch(
    {
      cases <- load_resolver_parity_cases()
      expect_parity(length(cases) > 0, "fixture has no cases")

      for (case in cases) {
        path <- if (identical(case$family, "rtma")) "/v1/run-rtma" else "/v1/run-model"
        cat(sprintf("Testing %s: %s...\n", path, case$name))

        # An empty `parameters` list must serialize as {} rather than [] so the
        # backend reads it as an object.
        parameters <- if (length(case$parameters) == 0) {
          structure(list(), names = character(0))
        } else {
          case$parameters
        }
        response <- v1_post_json(
          path,
          list(data = resolver_parity_rows(case), parameters = parameters),
          timeout = 300
        )
        status <- httr::status_code(response)
        body <- v1_parse_body(response)

        if (!is.null(case$expectedErrorContains)) {
          expect_parity(
            status == 400,
            sprintf("%s: expected status 400, got %d", case$name, status)
          )
          expect_parity(
            identical(body$error$code, "validation_error"),
            sprintf("%s: expected error code 'validation_error'", case$name)
          )
          expect_parity(
            grepl(case$expectedErrorContains, body$error$message, fixed = TRUE),
            sprintf(
              "%s: error message '%s' does not contain '%s'",
              case$name, body$error$message, case$expectedErrorContains
            )
          )
          next
        }

        if (status != 200) {
          detail <- if (!is.null(body$error$message)) body$error$message else ""
          stop(sprintf("%s: expected status 200, got %d. %s", case$name, status, detail))
        }
        expect_parity(
          is.list(body$resolvedParameters),
          sprintf("%s: response is missing resolvedParameters", case$name)
        )
        for (key in names(case$expected)) {
          expect_parity_field(case$name, key, body$resolvedParameters[[key]], case$expected[[key]])
        }
        expect_parity(
          setequal(names(body$resolvedParameters), names(case$expected)),
          sprintf(
            "%s: resolvedParameters keys are [%s], expected [%s]",
            case$name,
            paste(names(body$resolvedParameters), collapse = ", "),
            paste(names(case$expected), collapse = ", ")
          )
        )
        expected_recipe <- case$expectedRecipe
        actual_recipe <- body$recipe
        expect_parity(
          identical(actual_recipe, expected_recipe),
          sprintf(
            "%s: recipe is %s, expected %s",
            case$name,
            if (is.null(actual_recipe)) "null" else actual_recipe,
            if (is.null(expected_recipe)) "null" else expected_recipe
          )
        )
      }

      log_test_result(
        test_name, "PASS",
        sprintf("Backend resolver matches the shared fixture on all %d cases", length(cases))
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
