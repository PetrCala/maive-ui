# nolint start: indentation_linter, undesirable_function_linter, unused_declared_object.

linters <- c(
  lintr::linters_with_defaults(
    # https://lintr.r-lib.org/reference/index.html#individual-linters
    #
    # All default box linters
    defaults = lintr::linters_with_defaults(),
    # Set indentation to 8 spaces
    indentation_linter = lintr::indentation_linter(2),
    # Check that all commas are followed by spaces, but do not have spaces before them.
    commas_linter = lintr::commas_linter(allow_trailing = FALSE),
    # Check that all comments are preceded by a space
    object_name_linter = lintr::object_name_linter(
      styles = c("snake_case", "SNAKE_CASE", "dotted.case")
    ),
    object_length_linter = lintr::object_length_linter(length = 40),
    # Disable the default lintr object usage - replace with box imports
    # object_usage_linter = NULL,
    # All lines should be less than 120 characters
    line_length_linter = lintr::line_length_linter(NULL), # 120, 160,...
    # Disable commented code linter
    commented_code_linter = NULL,
    # Disable cyclocompexity linter
    cyclocomp_linter = NULL,
    # Turn off linting for several functions otherwise flagged as undesirable
    undesirable_function_linter = lintr::undesirable_function_linter(
      fun = lintr::modify_defaults(
        "defaults" = lintr::default_undesirable_functions,
        "options" = NULL, # Remove down the line
        "ifelse" = "use 'res <- if (x) expr1 else expr2'",
        # Console print methods
        "print" = "use cli::cli_inform()",
        "cat" = "use cli::cli_inform()",
        # Base messaging
        "message" = "use cli::cli_inform()",
        "warning" = "use cli::cli_warn()",
        "stop" = "use cli::cli_abort()",
        # rlang messaging
        "inform" = "use cli::cli_inform()",
        "warn" = "use cli::cli_warn()",
        "abort" = "use cli::cli_abort()"
      )
    ),
    # Check for missing packages and symbols in namespace calls
    namespace_linter = lintr::namespace_linter()
  )
)

exclusions <- list(
  "local/",
  "scripts",
  "tests/"
)

gc() # Clean up memory

# nolint end.
