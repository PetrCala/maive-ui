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
    maive_shades = c("black", "black"),
    maive_pch = c(NA, NA), # NA for lines, will be overridden in legend
    ci_levels = c(90, 95, 99),
    ci_shades = c("white", "gray55", "gray75"),
    legend_texts = c(
      "Base effect",
      "Adjusted effect",
      "MAIVE estimate",
      "95% CI bounds"
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
#' @param intercept_se [numeric] The standard error of the intercept. Must be provided only if intercept is provided.
#' @param is_quaratic_fit [logical] Whether the fit is quadratic. If TRUE, the fit is quadratic. If FALSE, the fit is linear.
#' @return A plot object
#' @export
get_funnel_plot <- function(effect, se, se_adjusted, intercept = NULL, intercept_se = NULL, is_quaratic_fit = FALSE) {
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

  ## Choose the exponent
  p <- if (is_quaratic_fit) 2 else 1 # 2 for PEESE‑style (SE²), 1 for PET/Egger

  ## Add fitted curve
  a <- intercept
  b <- intercept_se
  se.grid <- seq(min(se), max(se), length = 200)
  x.pred <- a + b * se.grid^p

  lines(x.pred, se.grid, lwd = 2, col = "black") # fitted

  ## 95% confidence band (delta method)
  ## needs vcov = var‑cov matrix of (a,b)
  vcov <- matrix(c(intercept_se^2, 0, 0, intercept_se^2), nrow = 2)
  se.fit <- sqrt(
    vcov[1, 1] + # var(a)
      2 * se.grid^p * vcov[1, 2] + # 2*SE^p*cov(a,b)
      (se.grid^p)^2 * vcov[2, 2] # SE^(2p)*var(b)
  )

  ci.lo <- x.pred - 1.96 * se.fit
  ci.hi <- x.pred + 1.96 * se.fit

  lines(ci.lo, se.grid, lty = 2, col = "black")
  lines(ci.hi, se.grid, lty = 2, col = "black")

  legend(
    funnel_opts$legend_position, # position
    legend = funnel_opts$legend_texts,
    pch = c(funnel_opts$effect_pch, funnel_opts$maive_pch),
    col = c(rep(funnel_opts$text_color, 2), "black", "black"),
    pt.bg = c(funnel_opts$effect_shades, funnel_opts$maive_pch),
    pt.cex = funnel_opts$pt_cex, # make the legend symbols bigger
    lty = c(rep(NA, 2), 1, 2), # solid line for MAIVE estimate, dashed for CI bounds
    lwd = c(rep(NA, 2), 2, 1), # line width for MAIVE estimate and CI bounds
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
  plot_dims <- par("din") # current device size in inches
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
  ragg::agg_png(tmp, width = width_px, height = height_px, res = res) # was plot(...)
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
