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
      "Adjusted SE",
      "MAIVE fit",
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
#' @param slope_coef [numeric] The slope coefficient of the funnel plot. If NULL, no slope coefficient is plotted.
#' @return A plot object
#' @export
get_funnel_plot <- function(effect, se, se_adjusted, intercept = NULL, intercept_se = NULL, slope_coef = NULL, is_quaratic_fit = FALSE) {
  funnel_opts <- get_funnel_plot_opts()

  x <- c(effect, effect)
  y <- c(se, se_adjusted)
  # pch changes the shape of the points
  plot_pch <- c(
    rep(funnel_opts$effect_pch[1], length(effect)), # base effect
    rep(funnel_opts$effect_pch[2], length(effect)) # adjusted effect
  )

  padding <- get_funnel_padding(effect)

  # Calculate simple mean for reference line
  simple_mean <- mean(effect)

  # Create a grid for contour plotting
  x_range <- c(padding$lower, padding$upper)
  y_range <- c(0, max(se))

  # Create grid for significance contours
  x_grid <- seq(x_range[1], x_range[2], length.out = 100)
  y_grid <- seq(y_range[1], y_range[2], length.out = 100)
  grid <- expand.grid(x = x_grid, y = y_grid)

  # Calculate t-statistics for significance contours (centered at x = 0)
  t_stats <- abs(grid$x) / grid$y
  t_stats[grid$y == 0] <- Inf # Handle division by zero

  # Create significance levels
  p_10 <- qt(0.95, df = Inf) # t-value for p < 0.10 (two-tailed)
  p_05 <- qt(0.975, df = Inf) # t-value for p < 0.05 (two-tailed)
  p_01 <- qt(0.995, df = Inf) # t-value for p < 0.01 (two-tailed)

  # Create significance regions
  sig_10 <- t_stats >= p_10 & t_stats < p_05
  sig_05 <- t_stats >= p_05 & t_stats < p_01
  sig_01 <- t_stats >= p_01

  # Create the base plot
  plot(x, y,
    xlim = x_range,
    ylim = y_range,
    xlab = funnel_opts$xlab,
    ylab = funnel_opts$ylab,
    pch = plot_pch,
    col = funnel_opts$col,
    cex = 1.2
  )

  # Add significance contours
  # p < 0.10 region
  contour_data_10 <- grid[sig_10, ]
  if (nrow(contour_data_10) > 0) {
    contour_data_10$z <- 1
    contour_data_10 <- contour_data_10[order(contour_data_10$x, contour_data_10$y), ]
    if (nrow(contour_data_10) > 0) {
      contour(x_grid, y_grid,
        matrix(ifelse(t_stats >= p_10 & t_stats < p_05, 1, 0), nrow = length(x_grid)),
        levels = 0.5, add = TRUE, col = "gray90", lwd = 1
      )
    }
  }

  # p < 0.05 region
  contour(x_grid, y_grid,
    matrix(ifelse(t_stats >= p_05 & t_stats < p_01, 1, 0), nrow = length(x_grid)),
    levels = 0.5, add = TRUE, col = "gray70", lwd = 1
  )

  # p < 0.01 region
  contour(x_grid, y_grid,
    matrix(ifelse(t_stats >= p_01, 1, 0), nrow = length(x_grid)),
    levels = 0.5, add = TRUE, col = "gray50", lwd = 1
  )

  # Add vertical line for simple mean (dash-dot style)
  abline(v = simple_mean, lty = 4, lwd = 2, col = "red")

  # Add simple mean label at the top
  text(simple_mean, max(se) * 0.95,
    paste0("Simple mean = ", round(simple_mean, 2)),
    pos = 3, cex = 0.9, col = "red"
  )

  ## Choose the exponent
  p <- if (is_quaratic_fit) 2 else 1 # 2 for PEESE‑style (SE²), 1 for PET/Egger

  ## Add fitted curve
  a <- intercept
  b <- slope_coef # was intercept_se, incorrectly
  se.grid <- seq(0, max(se), length = 200)
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

  # Add MAIVE estimate label at the top (SE = 0)
  if (!is.null(intercept) && !is.null(intercept_se)) {
    text(intercept, 0,
      paste0("MAIVE = ", round(intercept, 2), " (SE = ", round(intercept_se, 2), ")"),
      pos = 3, cex = 0.9, col = "black"
    )
  }

  # Round y-axis tick labels
  y_ticks <- axTicks(2)
  y_labels <- round(y_ticks)
  axis(2, at = y_ticks, labels = y_labels)

  legend(
    funnel_opts$legend_position, # position
    legend = c(funnel_opts$legend_texts[1:2], "Simple mean", "MAIVE fit", "95% CI bounds", "p < 0.10", "p < 0.05", "p < 0.01"),
    pch = c(funnel_opts$effect_pch, NA, NA, NA, NA, NA, NA),
    col = c(rep(funnel_opts$text_color, 2), "red", "black", "black", "gray90", "gray70", "gray50"),
    pt.bg = c(funnel_opts$effect_shades, NA, NA, NA, NA, NA, NA),
    pt.cex = c(rep(funnel_opts$pt_cex, 2), NA, NA, NA, NA, NA, NA),
    lty = c(rep(NA, 2), 4, 1, 2, 1, 1, 1), # dash-dot for simple mean, solid for MAIVE, dashed for CI, solid for contours
    lwd = c(rep(NA, 2), 2, 2, 1, 1, 1, 1), # line width
    bg = funnel_opts$legend_bg,
    bty = funnel_opts$legend_bty, # box type
    inset = funnel_opts$legend_inset
  )

  return(invisible(NULL))
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
