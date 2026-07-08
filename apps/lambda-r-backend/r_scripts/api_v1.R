# Public /v1 API helpers
#
# Request parsing, column resolution (design D5), server-side validation
# (design section 6.2), parameter defaulting (design D6), and structured error
# envelopes (design section 6.1) for the versioned public routes in index.R.
# The legacy routes (/run-model, /run-rtma) do not use this file and keep their
# existing behavior. See docs/PUBLIC_API_DESIGN.md.

API_V1_MODEL_TYPES <- c("MAIVE", "WAIVE", "WLS")
API_V1_MAIVE_METHODS <- c("PET", "PEESE", "PET-PEESE", "EK")
API_V1_WEIGHTS <- c(
  "equal_weights",
  "standard_weights",
  "adjusted_weights",
  "study_weights"
)
API_V1_SE_TREATMENTS <- c(
  "not_clustered",
  "clustered",
  "clustered_cr2",
  "bootstrap"
)

API_V1_MAIVE_CANONICAL <- c("effect", "se", "n_obs")
API_V1_RTMA_CANONICAL <- c("effect", "se")

API_V1_MAIVE_PLOT_FIELDS <- c("funnelPlot", "funnelPlotWidth", "funnelPlotHeight")
API_V1_RTMA_PLOT_FIELDS <- c("zScorePlot", "zScorePlotWidth", "zScorePlotHeight")

# Messages raised by the model layer that describe bad input rather than an
# unexpected failure; these map to 400 instead of 500. The first five mirror
# the validation patterns recognized inside run_maive_model().
API_V1_MODEL_VALIDATION_PATTERNS <- c(
  "Insufficient data",
  "Missing required columns",
  "must be numeric",
  "must be positive",
  "degrees of freedom",
  "Data must have"
)

API_V1_BODY_SHAPE_MESSAGE <- paste0(
  "Request body must be a JSON object of the form ",
  '{"data": [...], "parameters": {...}}.'
)

#' Signal a validation error that the /v1 handlers translate into a 400
#'
#' @param msg Human-readable description of the problem
api_v1_abort_validation <- function(msg) {
  # "{msg}" keeps cli from glue-interpolating braces inside the message itself
  cli::cli_abort("{msg}", class = "api_v1_validation_error", call = NULL)
}

#' Build the structured error envelope (design section 6.1)
#'
#' @param res Plumber response object; its status code is set here
#' @param status HTTP status code
#' @param code Machine-readable error code (e.g. "validation_error")
#' @param msg Human-readable error message
#' @return The error envelope to serialize as the response body
api_v1_error_body <- function(res, status, code, msg) {
  res$status <- status
  list(error = list(code = code, message = msg))
}

#' Check whether a parsed value is a JSON object (named list)
api_v1_is_json_object <- function(x) {
  is.list(x) && !is.data.frame(x) && (length(x) == 0 || !is.null(names(x)))
}

#' Parse the plain nested JSON body of a /v1 POST request
#'
#' Unlike the legacy routes, /v1 accepts `data` and `parameters` as plain JSON
#' values (design D4), so the raw body is parsed here without simplification to
#' preserve each row's keys for column resolution.
#'
#' @param req Plumber request object
#' @return The request body as a named list
api_v1_request_body <- function(req) {
  raw_json <- NULL
  if (!is.null(req$bodyRaw) && length(req$bodyRaw) > 0) {
    raw_json <- rawToChar(req$bodyRaw)
  } else if (!is.null(req$postBody) && length(req$postBody) > 0) {
    raw_json <- paste(req$postBody, collapse = "\n")
  }

  if (!is.null(raw_json) && nzchar(trimws(raw_json))) {
    parsed <- tryCatch(
      jsonlite::fromJSON(raw_json, simplifyVector = FALSE),
      error = function(e) NULL
    )
    if (!api_v1_is_json_object(parsed)) {
      api_v1_abort_validation(API_V1_BODY_SHAPE_MESSAGE)
    }
    return(parsed)
  }

  # Fall back to the body plumber already parsed when the raw body is not
  # available on the request object.
  if (api_v1_is_json_object(req$body) && length(req$body) > 0) {
    return(req$body)
  }

  api_v1_abort_validation(API_V1_BODY_SHAPE_MESSAGE)
}

#' Extract one column from a list of row objects
#'
#' @param rows List of named lists (JSON row objects)
#' @param key Column key to extract; missing values become NA
#' @return Atomic vector with one value per row
api_v1_extract_column <- function(rows, key) {
  values <- lapply(rows, function(row) {
    value <- row[[key]]
    if (is.null(value) || length(value) == 0) NA else value
  })
  if (any(vapply(values, length, integer(1)) != 1)) {
    api_v1_abort_validation(
      sprintf("Each `%s` value must be a scalar (a single number or string).", key)
    )
  }
  unlist(values, use.names = FALSE)
}

#' Convert the `data` field into a named list of columns
#'
#' Accepts either a list of row objects (from api_v1_request_body) or a data
#' frame (when falling back to plumber's own body parsing).
#'
#' @param data The `data` field of the request body
#' @return Named list of equal-length column vectors, in key order
api_v1_data_columns <- function(data) {
  if (is.null(data)) {
    api_v1_abort_validation(
      "The request body must include a non-empty `data` array of row objects."
    )
  }

  if (is.data.frame(data)) {
    if (nrow(data) == 0 || ncol(data) == 0) {
      api_v1_abort_validation("The `data` array must contain at least one row.")
    }
    return(as.list(data))
  }

  if (!is.list(data) || length(data) == 0 || !is.null(names(data))) {
    api_v1_abort_validation(
      "The `data` field must be a non-empty JSON array of row objects."
    )
  }

  rows_are_objects <- vapply(data, function(row) {
    is.list(row) && length(row) > 0 && !is.null(names(row)) && all(nzchar(names(row)))
  }, logical(1))
  if (!all(rows_are_objects)) {
    api_v1_abort_validation(
      "Each entry in `data` must be a JSON object keyed by column name."
    )
  }

  keys <- names(data[[1]])
  columns <- lapply(keys, function(key) api_v1_extract_column(data, key))
  names(columns) <- keys
  columns
}

#' Resolve MAIVE-family columns per design D5
#'
#' Canonical keys (effect, se, n_obs, study_id) are selected by name when all
#' required ones are present; otherwise the keys are taken positionally, which
#' keeps parity with the legacy positional contract.
#'
#' @param data The `data` field of the request body
#' @return Named list of columns: effect, se, n_obs and optionally study_id
api_v1_resolve_maive_columns <- function(data) {
  columns <- api_v1_data_columns(data)
  keys <- names(columns)

  if (all(API_V1_MAIVE_CANONICAL %in% keys)) {
    selected <- API_V1_MAIVE_CANONICAL
    if ("study_id" %in% keys) {
      selected <- c(selected, "study_id")
    }
    return(columns[selected])
  }

  if (length(keys) < 3 || length(keys) > 4) {
    api_v1_abort_validation(
      sprintf("Data must have 3 or 4 columns; found %d.", length(keys))
    )
  }
  names(columns) <- c("effect", "se", "n_obs", "study_id")[seq_along(columns)]
  columns
}

#' Resolve RTMA columns per design D5 (effect, se)
#'
#' @param data The `data` field of the request body
#' @return Named list with effect and se columns
api_v1_resolve_rtma_columns <- function(data) {
  columns <- api_v1_data_columns(data)
  keys <- names(columns)

  if (all(API_V1_RTMA_CANONICAL %in% keys)) {
    return(columns[API_V1_RTMA_CANONICAL])
  }

  if (length(keys) < 2) {
    api_v1_abort_validation(
      sprintf("Data must have at least 2 columns (effect, se); found %d.", length(keys))
    )
  }
  columns <- columns[1:2]
  names(columns) <- API_V1_RTMA_CANONICAL
  columns
}

#' Coerce a column to numeric, rejecting missing or non-numeric entries
api_v1_coerce_numeric_column <- function(values, column) {
  parsed <- suppressWarnings(as.numeric(values))
  if (any(is.na(parsed))) {
    api_v1_abort_validation(
      sprintf(
        "The %s column must contain only numeric values with no missing entries.",
        column
      )
    )
  }
  if (any(!is.finite(parsed))) {
    api_v1_abort_validation(
      sprintf("The %s column must contain only finite values.", column)
    )
  }
  parsed
}

#' Validate MAIVE-family data per design section 6.2
#'
#' Mirrors the UI validation page rules so API callers get structured 400s:
#' 3 or 4 columns, at least 4 rows, numeric effect/se/n_obs, se > 0, n_obs
#' positive integers, and rows >= unique studies + 3 when study_id is present.
#'
#' @param data The `data` field of the request body
#' @return Validated data frame ready for the positional model contract
api_v1_validate_maive_data <- function(data) {
  columns <- api_v1_resolve_maive_columns(data)
  n_rows <- length(columns[[1]])

  if (n_rows < 4) {
    api_v1_abort_validation(
      sprintf("Data must contain at least 4 rows; found %d.", n_rows)
    )
  }

  df <- data.frame(
    effect = api_v1_coerce_numeric_column(columns$effect, "effect"),
    se = api_v1_coerce_numeric_column(columns$se, "se"),
    n_obs = api_v1_coerce_numeric_column(columns$n_obs, "n_obs"),
    stringsAsFactors = FALSE
  )

  if (any(df$se <= 0)) {
    api_v1_abort_validation(
      "The se column must contain only positive values (greater than 0)."
    )
  }
  if (any(df$n_obs <= 0 | abs(df$n_obs - round(df$n_obs)) > .Machine$double.eps^0.5)) {
    api_v1_abort_validation(
      "The n_obs column must contain only positive integers (greater than 0)."
    )
  }

  if (!is.null(columns$study_id)) {
    study_id_text <- trimws(as.character(columns$study_id))
    if (any(is.na(columns$study_id) | !nzchar(study_id_text))) {
      api_v1_abort_validation(
        "The study_id column contains empty values. Study IDs can be strings or numbers."
      )
    }
    if (n_rows < length(unique(study_id_text)) + 3) {
      api_v1_abort_validation(
        "The number of rows must be larger than the number of unique study IDs plus 3."
      )
    }
    df$study_id <- columns$study_id
  }

  df
}

#' Validate RTMA data per design section 6.2
#'
#' Rows with missing or non-positive se are dropped by run_rtma_model itself
#' (matching legacy behavior), so only overall usability is enforced here.
#'
#' @param data The `data` field of the request body
#' @return Validated two-column data frame (effect, se)
api_v1_validate_rtma_data <- function(data) {
  columns <- api_v1_resolve_rtma_columns(data)

  df <- data.frame(
    effect = suppressWarnings(as.numeric(columns$effect)),
    se = suppressWarnings(as.numeric(columns$se)),
    stringsAsFactors = FALSE
  )

  valid <- !is.na(df$effect) & !is.na(df$se) & df$se > 0
  if (!any(valid)) {
    api_v1_abort_validation(
      "Data must contain at least one row with a numeric effect and a positive se."
    )
  }

  df
}

#' Normalize the `parameters` field into a named list
api_v1_parameters_object <- function(parameters) {
  if (is.null(parameters)) {
    return(list())
  }
  if (!api_v1_is_json_object(parameters)) {
    api_v1_abort_validation("The `parameters` field must be a JSON object.")
  }
  parameters
}

#' Validate an enum parameter, falling back to its default when absent
api_v1_enum_parameter <- function(params, name, choices, default) {
  value <- params[[name]]
  if (is.null(value)) {
    return(default)
  }
  if (!is.character(value) || length(value) != 1 || !(value %in% choices)) {
    api_v1_abort_validation(
      sprintf(
        "Invalid %s value: %s. Must be one of: %s.",
        name,
        paste(unlist(value), collapse = ", "),
        paste(choices, collapse = ", ")
      )
    )
  }
  value
}

#' Validate a boolean parameter, falling back to its default when absent
api_v1_flag_parameter <- function(params, name, default) {
  value <- params[[name]]
  if (is.null(value)) {
    return(default)
  }
  if (!is.logical(value) || length(value) != 1 || is.na(value)) {
    api_v1_abort_validation(
      sprintf("Invalid %s value: must be true or false.", name)
    )
  }
  value
}

#' Validate the winsorize parameter (percent; 0 disables)
api_v1_winsorize_parameter <- function(params) {
  value <- params$winsorize
  if (is.null(value)) {
    return(0)
  }
  if (!is.numeric(value) || length(value) != 1 || is.na(value) || value < 0 || value >= 100) {
    api_v1_abort_validation(
      "Invalid winsorize value: must be a percentage between 0 (disabled) and 100."
    )
  }
  value
}

#' Validate a parameter that must lie strictly between 0 and 1
api_v1_unit_interval_parameter <- function(params, name, default) {
  value <- params[[name]]
  if (is.null(value)) {
    return(default)
  }
  if (!is.numeric(value) || length(value) != 1 || is.na(value) || value <= 0 || value >= 1) {
    api_v1_abort_validation(
      sprintf("Invalid %s value: must be a number strictly between 0 and 1.", name)
    )
  }
  value
}

#' Apply MAIVE-family parameter defaults per design D6
#'
#' All parameters are optional; defaults match the UI's
#' CONFIG.DEFAULT_MODEL_PARAMETERS. shouldUseInstrumenting is derived from
#' modelType (WLS -> FALSE, otherwise TRUE) unless explicitly provided.
#'
#' @param parameters The `parameters` field of the request body (may be NULL)
#' @return Complete parameter list for run_maive_model()
api_v1_default_maive_parameters <- function(parameters) {
  params <- api_v1_parameters_object(parameters)
  model_type <- api_v1_enum_parameter(params, "modelType", API_V1_MODEL_TYPES, "MAIVE")

  should_use_instrumenting <- if (is.null(params$shouldUseInstrumenting)) {
    !identical(model_type, "WLS")
  } else {
    api_v1_flag_parameter(params, "shouldUseInstrumenting", NA)
  }

  list(
    modelType = model_type,
    maiveMethod = api_v1_enum_parameter(
      params, "maiveMethod", API_V1_MAIVE_METHODS, "PET-PEESE"
    ),
    weight = api_v1_enum_parameter(
      params, "weight", API_V1_WEIGHTS, "equal_weights"
    ),
    standardErrorTreatment = api_v1_enum_parameter(
      params, "standardErrorTreatment", API_V1_SE_TREATMENTS, "clustered_cr2"
    ),
    includeStudyDummies = api_v1_flag_parameter(params, "includeStudyDummies", FALSE),
    includeStudyClustering = api_v1_flag_parameter(params, "includeStudyClustering", FALSE),
    computeAndersonRubin = api_v1_flag_parameter(params, "computeAndersonRubin", FALSE),
    useLogFirstStage = api_v1_flag_parameter(params, "useLogFirstStage", FALSE),
    winsorize = api_v1_winsorize_parameter(params),
    shouldUseInstrumenting = should_use_instrumenting
  )
}

#' Apply RTMA parameter defaults per design D6
#'
#' The internal parallelize/timeoutSeconds knobs are deliberately not exposed;
#' run_rtma_model falls back to its own safe defaults for them.
#'
#' @param parameters The `parameters` field of the request body (may be NULL)
#' @return Complete parameter list for run_rtma_model()
api_v1_default_rtma_parameters <- function(parameters) {
  params <- api_v1_parameters_object(parameters)

  list(
    favorPositive = api_v1_flag_parameter(params, "favorPositive", TRUE),
    alphaSelect = api_v1_unit_interval_parameter(params, "alphaSelect", 0.05),
    ciLevel = api_v1_unit_interval_parameter(params, "ciLevel", 0.95),
    winsorize = api_v1_winsorize_parameter(params)
  )
}

#' Check whether ?include=plot was requested (design D7)
api_v1_include_plot <- function(include) {
  if (is.null(include)) {
    return(FALSE)
  }
  requested <- unlist(strsplit(as.character(include), ",", fixed = TRUE))
  any(trimws(requested) == "plot")
}

#' Drop base64 plot fields from a results object
api_v1_strip_plot_fields <- function(results, plot_fields) {
  results[!(names(results) %in% plot_fields)]
}

#' Check whether a model error message describes invalid input
api_v1_is_validation_message <- function(msg) {
  any(vapply(API_V1_MODEL_VALIDATION_PATTERNS, function(pattern) {
    grepl(pattern, msg, ignore.case = TRUE)
  }, logical(1)))
}

#' Run a /v1 handler, mapping errors to the structured envelope
#'
#' Validation errors (both the api_v1_validation_error condition and
#' validation-type model errors) become 400s; anything else becomes a 500.
#'
#' @param res Plumber response object
#' @param endpoint Endpoint label used in log messages
#' @param run Zero-argument function producing the success response body
api_v1_handle <- function(res, endpoint, run) {
  tryCatch(
    run(),
    api_v1_validation_error = function(e) {
      err_message <- conditionMessage(e)
      cli::cli_alert_warning("Validation error in {endpoint}: {err_message}")
      api_v1_error_body(res, 400L, "validation_error", err_message)
    },
    error = function(e) {
      err_message <- conditionMessage(e)
      if (api_v1_is_validation_message(err_message)) {
        cli::cli_alert_warning("Validation error in {endpoint}: {err_message}")
        return(api_v1_error_body(res, 400L, "validation_error", err_message))
      }
      cli::cli_alert_danger("Error in {endpoint}: {err_message}")
      api_v1_error_body(
        res, 500L, "internal_error",
        paste("Internal server error:", err_message)
      )
    }
  )
}

#' Handle POST /v1/run-model
#'
#' @param req Plumber request object (plain nested JSON body)
#' @param res Plumber response object
#' @param include Query parameter; "plot" embeds the funnel plot fields
#' @return The flat results object, or a structured error envelope
api_v1_run_model <- function(req, res, include = "") {
  api_v1_handle(res, "/v1/run-model", function() {
    # nolint start: undesirable_function_linter.
    source("maive_model.R")
    # nolint end: undesirable_function_linter.

    body <- api_v1_request_body(req)
    df <- api_v1_validate_maive_data(body$data)
    params <- api_v1_default_maive_parameters(body$parameters)

    results <- run_maive_model( # nolint: object_usage_linter.
      jsonlite::toJSON(df, dataframe = "rows", digits = NA),
      jsonlite::toJSON(params, auto_unbox = TRUE, digits = NA)
    )

    if (api_v1_include_plot(include)) {
      results
    } else {
      api_v1_strip_plot_fields(results, API_V1_MAIVE_PLOT_FIELDS)
    }
  })
}

#' Handle POST /v1/run-rtma
#'
#' @param req Plumber request object (plain nested JSON body)
#' @param res Plumber response object
#' @param include Query parameter; "plot" embeds the z-score plot fields
#' @return The flat results object, or a structured error envelope
api_v1_run_rtma <- function(req, res, include = "") {
  api_v1_handle(res, "/v1/run-rtma", function() {
    # nolint start: undesirable_function_linter.
    source("rtma_model.R")
    # nolint end: undesirable_function_linter.

    body <- api_v1_request_body(req)
    df <- api_v1_validate_rtma_data(body$data)
    params <- api_v1_default_rtma_parameters(body$parameters)

    results <- run_rtma_model( # nolint: object_usage_linter.
      jsonlite::toJSON(df, dataframe = "rows", digits = NA),
      jsonlite::toJSON(params, auto_unbox = TRUE, digits = NA)
    )

    if (api_v1_include_plot(include)) {
      results
    } else {
      api_v1_strip_plot_fields(results, API_V1_RTMA_PLOT_FIELDS)
    }
  })
}
