# Data preprocessing helpers.

get_expected_variable_names <- function() {
  expected <- getOption("artma.expected_columns")
  if (is.null(expected)) {
    expected <- c("effect", "se")
  }

  unique(as.character(expected))
}

verify_variable_names <- function(df, expected_columns = NULL) {
  if (is.null(expected_columns)) {
    expected_columns <- get_expected_variable_names()
  }

  df_names <- names(df)
  missing_columns <- setdiff(expected_columns, df_names)
  unexpected_columns <- setdiff(df_names, expected_columns)

  if (length(missing_columns) > 0 || length(unexpected_columns) > 0) {
    header <- if (length(missing_columns) > 0) {
      "Missing columns."
    } else {
      "Column name mismatch."
    }

    details <- c(
      "All expected non-computed columns must exist, and no extra columns are allowed.",
      if (length(missing_columns) > 0) {
        paste0("Missing required columns: ", paste(missing_columns, collapse = ", "))
      },
      if (length(unexpected_columns) > 0) {
        paste0("Unexpected columns: ", paste(unexpected_columns, collapse = ", "))
      }
    )

    cli::cli_abort(c(header, i = details))
  }

  invisible(TRUE)
}
