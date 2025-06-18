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

#* Run the model
#* @post /run-model
function(file_data, parameters) {
  library("ggplot2")

  test_data <- data.frame(x = seq(-10, 10, length.out = 100), y = dnorm(seq(-10, 10, length.out = 100)))

  ggplot(test_data, aes(x = x, y = y)) +
    geom_line() +
    ggtitle("Placeholder Graph") +
    xlab("X-axis") +
    ylab("Density")

  # Parse the parameters
  params <- jsonlite::fromJSON(parameters)

  # TODO: Implement actual model logic here
  # This is a placeholder response structure
  result <- list(
    effectEstimate = 0.5234,
    standardError = 0.1234,
    isSignificant = TRUE,
    andersonRubinCI = c(0.2345, 0.8123),
    publicationBias = list(
      estimate = 0.1234,
      standardError = 0.0567,
      isSignificant = FALSE
    ),
    firstStageFTest = 15.6789,
    hausmanTest = list(
      statistic = 2.3456,
      rejectsNull = FALSE
    ),
    funnelPlot = get_mock_funnel_plot()
  )

  result
}
