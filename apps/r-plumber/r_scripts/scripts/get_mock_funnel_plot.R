#' Get a mock funnel plot
#'
#' @return A base64 encoded string of the funnel plot
#' @export
get_mock_funnel_plot <- function() {
  name <- format(Sys.time(), "%Y-%m-%d")

  n <- 100
  effect <- rep(0.1, n)
  se <- rep(0.05, n)
  precision <- 1 / se^2

  p <- ggplot2::ggplot(
    data.frame(effect, precision),
    ggplot2::aes(x = effect, y = precision)
  ) +
    ggplot2::geom_line() +
    ggplot2::ggtitle("Placeholder Graph") +
    ggplot2::xlab("Effect") +
    ggplot2::ylab("Precision")

  tmp <- tempfile(fileext = ".png")
  png(tmp, width = 800, height = 600, res = 96)
  print(p)
  dev.off()

  raw_png <- readBin(tmp, "raw", n = file.info(tmp)$size)
  unlink(tmp)

  data_uri <- paste0(
    "data:image/png;base64,",
    base64enc::base64encode(raw_png)
  )
  return(data_uri)
}

get_mock_funnel_plot()
