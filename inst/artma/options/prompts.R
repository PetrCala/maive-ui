# Autonomy level descriptions used for interactive prompts.

AUTONOMY_DEFAULT_LEVEL <- 5L

AUTONOMY_LEVEL_DESCRIPTIONS <- c(
  `1` = "Level 1: Manual execution only.",
  `2` = "Level 2: Suggests actions with confirmation.",
  `3` = "Level 3: Executes safe actions with confirmation for risky steps.",
  `4` = "Level 4: Executes with minimal confirmations.",
  `5` = "Level 5: Full autonomy for all supported actions."
)

get_autonomy_description_for_level <- function(level) {
  level <- suppressWarnings(as.integer(level))
  if (length(level) != 1 || is.na(level)) {
    level <- AUTONOMY_DEFAULT_LEVEL
  }

  level <- max(1L, min(5L, level))
  description <- AUTONOMY_LEVEL_DESCRIPTIONS[as.character(level)]

  if (length(description) == 0 || is.na(description)) {
    return("Level 5: Full autonomy for all supported actions.")
  }

  description
}
