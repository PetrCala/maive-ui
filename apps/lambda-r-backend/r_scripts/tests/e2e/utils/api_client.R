# API Client for E2E Tests

#' Test API health endpoint
#' @param base_url Base URL of the API
#' @return Response from health check
test_health_check <- function(base_url = API_BASE_URL) {
  tryCatch(
    {
      response <- httr::GET(paste0(base_url, "/ping"))
      if (httr::status_code(response) == 200) {
        return(httr::content(response, "parsed"))
      } else {
        stop(paste("Health check failed with status:", httr::status_code(response)))
      }
    },
    error = function(e) {
      stop(paste("Health check error:", e$message))
    }
  )
}

#' Test echo endpoint
#' @param msg Message to echo
#' @param base_url Base URL of the API
#' @return Response from echo endpoint
test_echo <- function(msg = "test", base_url = API_BASE_URL) {
  tryCatch(
    {
      response <- httr::GET(paste0(base_url, "/echo"),
        query = list(msg = msg)
      )
      if (httr::status_code(response) == 200) {
        return(httr::content(response, "parsed"))
      } else {
        stop(paste("Echo test failed with status:", httr::status_code(response)))
      }
    },
    error = function(e) {
      stop(paste("Echo test error:", e$message))
    }
  )
}

#' Test run-model endpoint
#' @param data JSON string of file data
#' @param parameters JSON string of parameters
#' @param base_url Base URL of the API
#' @param timeout Timeout in seconds
#' @return Response from run-model endpoint
test_run_model <- function(data, parameters,
                           base_url = API_BASE_URL,
                           timeout = API_TIMEOUT) {
  tryCatch(
    {
      response <- httr::POST(
        paste0(base_url, "/run-model"),
        body = list(
          data = data,
          parameters = parameters
        ),
        encode = "form",
        httr::timeout(timeout)
      )

      if (httr::status_code(response) == 200) {
        return(httr::content(response, "parsed"))
      } else {
        stop(paste("Run-model test failed with status:", httr::status_code(response)))
      }
    },
    error = function(e) {
      stop(paste("Run-model test error:", e$message))
    }
  )
}

#' Test run-rtma endpoint
#' @param data JSON string of file data
#' @param parameters JSON string of parameters
#' @param base_url Base URL of the API
#' @param timeout Timeout in seconds
#' @return Response from run-rtma endpoint
test_run_rtma <- function(data, parameters,
                          base_url = API_BASE_URL,
                          timeout = 300) {
  tryCatch(
    {
      response <- httr::POST(
        paste0(base_url, "/run-rtma"),
        body = list(
          data = data,
          parameters = parameters
        ),
        encode = "form",
        httr::timeout(timeout)
      )

      if (httr::status_code(response) == 200) {
        return(httr::content(response, "parsed"))
      } else {
        stop(paste("Run-rtma test failed with status:", httr::status_code(response)))
      }
    },
    error = function(e) {
      stop(paste("Run-rtma test error:", e$message))
    }
  )
}

#' POST a plain nested JSON body to a public /v1 endpoint
#'
#' Unlike the legacy helpers above, this sends `application/json` (no form
#' encoding, no double-encoded JSON strings) and returns the raw httr response
#' so tests can assert on HTTP status codes and error envelopes.
#'
#' @param path Endpoint path (e.g. "/v1/run-model")
#' @param body Request body as an R list (e.g. list(data = ..., parameters = ...))
#' @param query Optional named list of query parameters (e.g. list(include = "plot"))
#' @param base_url Base URL of the API
#' @param timeout Timeout in seconds
#' @return Raw httr response object
v1_post_json <- function(path, body, query = NULL,
                         base_url = API_BASE_URL,
                         timeout = API_TIMEOUT) {
  httr::POST(
    paste0(base_url, path),
    body = jsonlite::toJSON(body, auto_unbox = TRUE, digits = NA, null = "null"),
    httr::content_type_json(),
    query = query,
    httr::timeout(timeout)
  )
}

#' GET a public /v1 endpoint
#' @param path Endpoint path (e.g. "/v1/health")
#' @param base_url Base URL of the API
#' @param timeout Timeout in seconds
#' @return Raw httr response object
v1_get <- function(path, base_url = API_BASE_URL, timeout = API_TIMEOUT) {
  httr::GET(paste0(base_url, path), httr::timeout(timeout))
}

#' Parse a /v1 JSON response body into an R list
#' @param response Raw httr response object
#' @return Parsed response body
v1_parse_body <- function(response) {
  httr::content(response, "parsed")
}

#' Convert a data frame into a list of /v1 row objects
#' @param df Data frame to convert
#' @return Unnamed list of named lists, one per row
df_to_v1_rows <- function(df) {
  lapply(seq_len(nrow(df)), function(i) as.list(df[i, , drop = FALSE]))
}

#' Convert data frame to JSON string for API
#' @param df Data frame to convert
#' @return JSON string
df_to_json <- function(df) {
  jsonlite::toJSON(df, auto_unbox = TRUE)
}

#' Convert parameters list to JSON string for API
#' @param params Parameters list to convert
#' @return JSON string
params_to_json <- function(params) {
  jsonlite::toJSON(params, auto_unbox = TRUE)
}
