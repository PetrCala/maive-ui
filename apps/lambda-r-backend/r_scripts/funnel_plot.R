# nolint start: undesirable_function_linter.

PLOT_RES <- 120 # Changes the resolution of the plot in pixels per inch; also changes the plot size

#' Get the dimensions of the plot
#'
#' @param dat Data frame passed to MAIVE::get_funnel_plot
#' @param result MAIVE result passed to MAIVE::get_funnel_plot
#' @param instrument 0/1, forwarded to MAIVE::get_funnel_plot
#' @param model_type Label forwarded to MAIVE::get_funnel_plot
#' @return A list of the dimensions of the plot
#' @export
get_plot_dims <- function(dat, result, instrument = NULL, model_type = "MAIVE", res = PLOT_RES) {
  MAIVE::get_funnel_plot(dat = dat, result = result, instrument = instrument, model_type = model_type)
  plot_dims <- par("din") # current device size in inches # nolint: undesirable_function_linter.
  width_px <- plot_dims[1] * res
  height_px <- plot_dims[2] * res
  list(width_px = width_px, height_px = height_px)
}

#' Render a funnel plot and return a base64 encoded PNG data URI
#'
#' @param dat Data frame passed to MAIVE::get_funnel_plot
#' @param result MAIVE result passed to MAIVE::get_funnel_plot
#' @param instrument 0/1, forwarded to MAIVE::get_funnel_plot
#' @param model_type Label forwarded to MAIVE::get_funnel_plot
#' @param res Resolution of the plot in pixels per inch (optional, default 96)
#' @return A list of the data URI, width, and height of the plot
#' @export
get_funnel_plot_data <- function(dat, result, instrument = NULL, model_type = "MAIVE", res = PLOT_RES) {
  width_px <- res * 7
  height_px <- res * 7

  tmp <- tempfile(fileext = ".png")
  ragg::agg_png(tmp, width = width_px, height = height_px, res = res) # was plot(...)
  MAIVE::get_funnel_plot(dat = dat, result = result, instrument = instrument, model_type = model_type)
  dev.off()

  raw_png <- readBin(tmp, "raw", n = file.info(tmp)$size)
  unlink(tmp)

  data_uri <- paste0(
    "data:image/png;base64,",
    base64enc::base64encode(raw_png)
  )
  list(
    data_uri = data_uri,
    width_px = width_px,
    height_px = height_px
  )
}


# nolint end: undesirable_function_linter.
