source("modules/funnel_plot.R")

#' Get a mock funnel plot
#'
#' @return A base64 encoded string of the funnel plot
#' @export
get_mock_funnel_plot <- function(x, y) {
  n <- 100
  effect <- rep(0.1, n)
  se <- rep(0.05, n)

  plot_uri <- get_funnel_plot(effect = effect, se = se)
  plot_uri
}
