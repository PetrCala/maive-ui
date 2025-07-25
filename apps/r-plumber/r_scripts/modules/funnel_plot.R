PLOT_RES <- 120 # Changes the resolution of the plot in pixels per inch; also changes the plot size

#' Get the default options for the funnel plot
#'
#' @return A list of options
#' @export
get_funnel_plot_opts <- function() {
  list(
    # Plot options
    xlab = "Effect Size",
    ylab = "Standard Error",
    yaxis = "sei", # seinv for precision
    digits = 3L,
    col = "black",
    # Legend options
    effect_shades = c("white", "black"),
    effect_pch = c(21, 19), # 21 is hollow circle, 19 is filled circle
    ci_shades = c("white", "gray55", "gray75"),
    ci_pch = c(22, 22, 22),
    ci_levels = c(90, 95, 99),
    legend_texts = c(
      "Base effect",
      "Adjusted effect",
      "90% CI Region",
      "95% CI Region",
      "99% CI Region"
    ),
    pt_cex = 2,
    legend_inset = 0.01,
    text_color = "black",
    legend_bg = "white",
    legend_position = "bottomright",
    legend_bty = "o"
  )
}


#' Dynamically set xlim so that the lower bound is a bit below the minimum effect,
#' and the upper bound is shifted to the right to avoid legend overlap.
#' @returns A list with the two padding values
get_funnel_padding <- function(effect) {
  # Set padding at either side - between 0 and 1, percentage of the effect range
  left_padding <- 0
  right_padding <- 0.25

  effect_all <- c(effect, effect) # both base and adjusted
  min_effect <- min(effect_all, na.rm = TRUE)
  max_effect <- max(effect_all, na.rm = TRUE)
  effect_range <- max_effect - min_effect
  xlim_pad_left <- left_padding * effect_range
  xlim_pad_right <- right_padding * effect_range
  list(
    lower = min_effect - xlim_pad_left,
    upper = max_effect + xlim_pad_right
  )
}


#' Get a funnel plot using metafor
#'
#' @param effect [numeric] The effect size
#' @param se [numeric] The standard error
#' @param se_adjusted [numeric] The adjusted standard error
#' @param intercept [numeric] The intercept of the funnel plot. If NULL, no intercept is plotted.
#' @return A plot object
#' @export
get_funnel_plot <- function(effect, se, se_adjusted, intercept = NULL) {
  funnel_opts <- get_funnel_plot_opts()

  x <- c(effect, effect)
  y <- c(se, se_adjusted)
  # pch changes the shape of the points
  plot_pch <- c(
    rep(funnel_opts$effect_pch[1], length(effect)), # base effect
    rep(funnel_opts$effect_pch[2], length(effect)) # adjusted effect
  )

  # vline_color <- "red"
  # if (!is.null(intercept)) p <- p + ggplot2::geom_vline(ggplot2::aes(xintercept = intercept), color = vline_color, linewidth = 0.5)

  padding <- get_funnel_padding(effect)

  # Create the funnel plot
  p <- metafor::funnel(
    x = x,
    sei = y,
    level = funnel_opts$ci_levels,
    shade = funnel_opts$ci_shades,
    digits = funnel_opts$digits,
    pch = plot_pch,
    col = funnel_opts$col,
    yaxis = funnel_opts$yaxis,
    xlab = funnel_opts$xlab,
    ylab = funnel_opts$ylab,
    xlim = c(padding$lower, padding$upper), # shift plot to the left to avoid legend overlap
    # atransf = exp, # x axis labels to exponential
    # refline2 = 0.142, # To add a second reference line
    refline = mean(effect),
    legend = FALSE
  )

  legend(
    funnel_opts$legend_position, # position
    legend = funnel_opts$legend_texts,
    pch = c(funnel_opts$effect_pch, funnel_opts$ci_pch),
    col = funnel_opts$text_color,
    pt.bg = c(funnel_opts$effect_shades, funnel_opts$ci_shades),
    pt.cex = funnel_opts$pt_cex, # make the legend symbols bigger
    bg = funnel_opts$legend_bg,
    bty = funnel_opts$legend_bty, # box type
    inset = funnel_opts$legend_inset
  )

  return(p)
}

#' Get the dimensions of the plot
#'
#' @param ... Arguments to pass to get_funnel_plot
#' @return A list of the dimensions of the plot
#' @export
get_plot_dims <- function(..., res = PLOT_RES) {
  get_funnel_plot(...)
  plot_dims <- par("din") # current device size in inches # nolint: undesirable_function_linter.
  width_px <- plot_dims[1] * res
  height_px <- plot_dims[2] * res
  list(width_px = width_px, height_px = height_px)
}

#' Get a funnel plot using metafor and return a base64 encoded string
#'
#' @param ... Arguments to pass to get_funnel_plot
#' @param res Resolution of the plot in pixels per inch (optional, default 96)
#' @return A list of the data URI, width, and height of the plot
#' @export
get_funnel_plot_data <- function(..., res = PLOT_RES) {
  width_px <- res * 7
  height_px <- res * 7

  tmp <- tempfile(fileext = ".png")
  png(tmp, width = width_px, height = height_px, res = res)
  get_funnel_plot(...) # This will plot directly to the PNG device
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
