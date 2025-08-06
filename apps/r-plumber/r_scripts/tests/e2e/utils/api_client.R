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
#' @param file_data JSON string of file data
#' @param parameters JSON string of parameters
#' @param base_url Base URL of the API
#' @param timeout Timeout in seconds
#' @return Response from run-model endpoint
test_run_model <- function(file_data, parameters,
                           base_url = API_BASE_URL,
                           timeout = API_TIMEOUT) {
  tryCatch(
    {
      response <- httr::POST(
        paste0(base_url, "/run-model"),
        body = list(
          file_data = file_data,
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
