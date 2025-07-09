# plumber.R

#* Echo back the input
#* @usage curl --data "a=4&b=3" "http://localhost:8787/sum"
#* @param msg The message to echo
#* @get /echo
function(msg = "") {
  list(msg = paste0("The message is: '", msg, "'"))
}

#* Plot a histogram
#* @serializer png
#* @get /plot
function() {
  rand <- rnorm(100)
  hist(rand)
}

#* Health check
#* @get /ping
function() {
  list(status = "ok", time = format(Sys.time(), tz = "UTC"))
}

#* Return the sum of two numbers
#* @usage curl "http://localhost:8787/echo?msg=hello"
#* @param a The first number to add
#* @param b The second number to add
#* @post /sum
function(a, b) {
  as.numeric(a) + as.numeric(b)
}


#' data dat can be imported from an excel file via: dat <- read_excel("inputdata.xlsx") and consists of:
#' \itemize{
#'   \item estimates: bs
#'   \item standard errors: sebs
#'   \item number of observations: Ns
#'   \item optional: study_id
#' }

#* Run the model
#* @post /run-model
function(file_data, parameters) {
  library("ggplot2")
  library("MAIVE")

  # Parse the parameters
  params <- jsonlite::fromJSON(parameters)

  ### TEST DATA ###
  use_test_data <- TRUE
  if (use_test_data) {
    file_data <- data.frame(
      effect = rnorm(100),
      se = rnorm(100),
      n_obs = rnorm(100)
    )
    parameters <- list(
      method = "XXX",
      weight = "XXX",
      instrument = "XXX",
    )
  }

  # Prepare the data for MAIVE
  file_data <- tolower(file_data)
  file_data[] <- lapply(file_data, as.numeric)

  new_colnames <- c("bs", "sebs", "Ns")
  if (length(colnames(file_data)) == 4) {
    new_colnames <- c(new_colnames, "study_id") # Optional column
  }
  if (length(colnames(file_data)) != length(new_colnames)) {
    return(list(
      error = TRUE,
      message = "The file must have between 3 and 4 columns (bs, sebs, Ns, and optionally study_id)."
    ))
  }
  colnames(file_data) <- new_colnames

  # Run the model
  maive_res <- maive(
    dat = file_data,
    # TODO: Add parameters from the UI
    method = 0, # PET=0, PEESE=1, PET-PEESE=2, EK=3
    weight = 0, # no weights=0, inverse-variance weights=1, adjusted weights=2
    instrument = 0, # no=0, yes=1
    studylevel = 0, # none=0, study fixed effects=1, cluster-robust standard errors=2
    AR = 0 # 0 = no AR, 1 = AR
  )

  ggplot(test_data, aes(x = x, y = y)) +
    geom_line() +
    ggtitle("Placeholder Graph") +
    xlab("X-axis") +
    ylab("Density")

  # This is the package response structure
  maive_res <- list("beta" = round(beta, 3), "SE" = round(betase, 3), "F-test" = F_hac, "beta_standard" = round(beta0, 3), "SE_standard" = round(beta0se, 3), "Hausman" = round(Hausman, 3), "Chi2" = round(Chi2, 3), "SE_instrumented" = sebs2fit1^(1 / 2), "AR_CI" = b0_CI_AR)

  # TODO: Implement actual model logic here
  # This is a placeholder response structure
  result <- list(
    effectEstimate = maive_res$beta,
    standardError = maive_res$SE,
    isSignificant = maive_res$F_test > 1.96, # Double check this
    andersonRubinCI = maive_res$AR_CI, # c(int, int) or "NA"
    publicationBias = list(
      estimate = 0.1234,
      standardError = 0.0567,
      isSignificant = FALSE
    ),
    firstStageFTest = 15.6789,
    hausmanTest = list(
      statistic = maive_res$Hausman,
      rejectsNull = FALSE
    ),
    funnelPlot = get_mock_funnel_plot()
  )

  result
}
