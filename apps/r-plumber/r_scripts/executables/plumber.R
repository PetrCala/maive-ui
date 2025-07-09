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
  library("varhandle")
  library("pracma")
  library("sandwich")
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

  expected_parameters <- c("modelType", "includeStudyDummies", "standardErrorTreatment", "computeAndersonRubin")
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

  # Run the model
  maive_res <- MAIVE::maive(
    dat = df,
    # TODO: Add parameters from the UI
    method = 1, # PET=0, PEESE=1, PET-PEESE=2, EK=3
    weight = 0, # no weights=0, inverse-variance weights=1, adjusted weights=2
    instrument = 0, # no=0, yes=1
    studylevel = 0, # none=0, study fixed effects=1, cluster-robust standard errors=2
    AR = should_use_ar # 0 = no AR, 1 = AR
  )

  funnel_plot <- get_funnel_plot(
    effect = df$bs,
    se = df$sebs
  )

  # This is the package response structure
  # maive_res <- list("beta" = round(beta, 3), "SE" = round(betase, 3), "F-test" = F_hac, "beta_standard" = round(beta0, 3), "SE_standard" = round(beta0se, 3), "Hausman" = round(Hausman, 3), "Chi2" = round(Chi2, 3), "SE_instrumented" = sebs2fit1^(1 / 2), "AR_CI" = b0_CI_AR)

  # TODO: Add the rest of the results
  results <- list(
    effectEstimate = maive_res$beta,
    standardError = maive_res$SE,
    isSignificant = maive_res[["F-test"]] > 1.96, # Double check this
    andersonRubinCI = maive_res$AR_CI, # c(int, int) or "NA"
    publicationBias = list(
      estimate = maive_res$beta_standard,
      standardError = maive_res$SE_standard,
      isSignificant = FALSE
    ),
    firstStageFTest = maive_res[["F-test"]],
    hausmanTest = list(
      statistic = maive_res$Hausman,
      rejectsNull = FALSE
    ),
    funnelPlot = funnel_plot
  )
  list(data = results)
}
