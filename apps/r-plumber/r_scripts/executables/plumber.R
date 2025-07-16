# plumber.R

#* Echo back the input
#* @usage curl --data "a=4&b=3" "http://localhost:8787/sum"
#* @param msg The message to echo
#* @get /echo
function(msg = "") {
  list(msg = paste0("The message is: '", msg, "'"))
}

#* Health check
#* @get /ping
function() {
  list(status = "ok", time = format(Sys.time(), tz = "UTC"))
}
#* Run the model
#* @param file_data The file data to run the model on, passed as a JSON string
#* @param parameters The parameters to run the model on
#* @post /run-model
function(file_data, parameters) {
  # nolint start: undesirable_function_linter.
  # MAIVE dependencies
  maive_deps <- c("clubSandwich", "varhandle", "pracma", "sandwich", "metafor")
  lapply(maive_deps, library, character.only = TRUE)
  source("../modules/funnel_plot.R", local = TRUE)
  # nolint end: undesirable_function_linter.

  df <- jsonlite::fromJSON(file_data)
  params <- jsonlite::fromJSON(parameters)

  colnames(df) <- tolower(colnames(df))
  df[] <- lapply(df, as.numeric)

  new_colnames <- c("bs", "sebs", "Ns")
  if (length(colnames(df)) == 4) {
    new_colnames <- c(new_colnames, "study_id") # Optional column
  }
  if (length(colnames(df)) != length(new_colnames)) {
    return(list(
      error = TRUE,
      message = "The file must have between 3 and 4 columns (bs, sebs, Ns, and optionally study_id)."
    ))
  }

  name_map <- c(
    "effect" = "bs",
    "se" = "sebs",
    "n_obs" = "Ns",
    "study_id" = "study_id"
  )
  final_order <- c("bs", "sebs", "Ns", "study_id")

  # Rename using the mapping (keep only matching columns)
  old_names <- names(df)
  matched_old_names <- intersect(old_names, names(name_map))
  names(df)[match(matched_old_names, names(df))] <- name_map[matched_old_names]

  # Keep only columns in desired order that actually exist
  existing_order <- intersect(final_order, names(df))
  df <- df[, existing_order, drop = FALSE]

  df <- df[rowSums(is.na(df)) != ncol(df), ] # Drop rows with all NAs

  expected_parameters <- c(
    "modelType",
    "includeStudyDummies",
    "standardErrorTreatment",
    "computeAndersonRubin",
    "maiveMethod"
  )
  if (!all(names(params) %in% expected_parameters) || !all(expected_parameters %in% names(params))) {
    return(list(
      error = TRUE,
      message = paste0("The parameters must include the following: ", paste(expected_parameters, collapse = ", "))
    ))
  }

  model_type <- params$modelType # MAIVE or WAIVE
  should_include_study_dummies <- if (isTRUE(params$includeStudyDummies)) 1 else 0
  standard_error_treatment <- params$standardErrorTreatment # not_clustered, clustered, clustered_cr2, bootstrap
  should_use_ar <- if (isTRUE(params$computeAndersonRubin)) 1 else 0
  maive_method <- switch(params$maiveMethod,
    "PET" = 1,
    "PEESE" = 2,
    "PET-PEESE" = 3,
    "EK" = 4
  )

  # Run the model
  maive_res <- MAIVE::maive(
    dat = df,
    method = maive_method,
    weight = 0, # no weights=0 (default), inverse-variance weights=1, adjusted weights=2
    instrument = 1, # no=0, yes=1 (default)
    studylevel = should_include_study_dummies, # 0 none, 1 fixed effects, 2 cluster (default)
    SE = 0, # 0 CR0 (Huber-White), 1 CR1 (std. emp. correction), 2 CR2 (bias-reduced est.), 3 wild bootstrap (default)
    AR = should_use_ar # 0 = no AR, 1 = AR (default)
  )

  funnel_plot <- get_funnel_plot(
    effect = df$bs,
    se = maive_res$SE_instrumented,
    intercept = maive_res$beta # ASK: double check which coef to use
  )

  est <- maive_res$beta
  se <- maive_res$SE
  est_is_significant <- if (se > 0) est / se >= 1.96 else TRUE

  pub_bias_p_value <- maive_res[["pub bias p-value"]]
  pb_is_significant <- if (pub_bias_p_value < 0.05) TRUE else FALSE

  results <- list(
    effectEstimate = est,
    standardError = se,
    isSignificant = est_is_significant,
    andersonRubinCI = maive_res$AR_CI, # c(int, int) or "NA"
    publicationBias = list(
      pValue = pub_bias_p_value,
      isSignificant = pb_is_significant
    ),
    firstStageFTest = maive_res[["F-test"]],
    hausmanTest = list(
      statistic = maive_res$Hausman,
      criticalValue = maive_res$Chi2,
      rejectsNull = maive_res$Hausman >= maive_res$Chi2
    ),
    seInstrumented = maive_res$SE_instrumented,
    funnelPlot = funnel_plot
  )
  list(data = results)
}
