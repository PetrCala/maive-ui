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
    legend_position = "topright",
    legend_bty = "o"
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

#' Get a funnel plot using metafor and return a base64 encoded string
#'
#' @param ... Arguments to pass to get_funnel_plot
#' @return A base64 encoded string of the funnel plot
#' @export
get_funnel_plot_uri <- function(...) {
  tmp <- tempfile(fileext = ".png")
  png(tmp, width = 800, height = 600, res = 96)
  get_funnel_plot(...)
  dev.off()

  raw_png <- readBin(tmp, "raw", n = file.info(tmp)$size)
  unlink(tmp)

  data_uri <- paste0(
    "data:image/png;base64,",
    base64enc::base64encode(raw_png)
  )
  data_uri
}
