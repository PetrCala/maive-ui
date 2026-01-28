# Helpers for storing and resolving autonomy preferences.

if (!exists("AUTONOMY_DEFAULT_LEVEL", inherits = TRUE)) {
  AUTONOMY_DEFAULT_LEVEL <- 5L
}

resolve_autonomy_level <- function(level = NULL) {
  resolved <- level
  if (is.null(resolved)) {
    resolved <- getOption("artma.autonomy.level")
  }

  resolved <- suppressWarnings(as.integer(resolved))
  if (length(resolved) != 1 || is.na(resolved)) {
    resolved <- AUTONOMY_DEFAULT_LEVEL
  }

  max(1L, min(5L, resolved))
}

get_autonomy_level <- function(level = NULL) {
  resolve_autonomy_level(level)
}

get_autonomy_description <- function(level = NULL) {
  resolved <- resolve_autonomy_level(level)
  if (exists("get_autonomy_description_for_level", inherits = TRUE)) {
    return(get_autonomy_description_for_level(resolved))
  }

  sprintf("Level %d: Full autonomy for all supported actions.", resolved)
}

is_fully_autonomous <- function(level = NULL) {
  resolve_autonomy_level(level) >= 5L
}

autonomy.get <- function(level = NULL) {
  resolve_autonomy_level(level)
}

autonomy.set <- function(level) {
  level <- resolve_autonomy_level(level)
  options(artma.autonomy.level = level)
  invisible(level)
}
