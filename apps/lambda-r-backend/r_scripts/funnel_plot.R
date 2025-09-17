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

#' Get a funnel plot using base graphics
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

  n_points <- length(effect)
  x_values <- c(effect, effect)
  y_values <- c(se, se_adjusted)

  plot_pch <- c(
    rep(funnel_opts$effect_pch[1], n_points),
    rep(funnel_opts$effect_pch[2], n_points)
  )

  point_bg <- c(
    rep(funnel_opts$effect_shades[1], n_points),
    rep(funnel_opts$effect_shades[2], n_points)
  )

  finite_points <- is.finite(x_values) & is.finite(y_values)
  x_values <- x_values[finite_points]
  y_values <- y_values[finite_points]
  plot_pch <- plot_pch[finite_points]
  point_bg <- point_bg[finite_points]

  simple_mean <- mean(effect, na.rm = TRUE)

  padding <- get_funnel_padding(effect)

  se_all <- y_values
  max_se <- max(se_all, na.rm = TRUE)
  if (!is.finite(max_se) || max_se <= 0) {
    max_se <- 1
  }

  se_pad <- max_se * 0.1
  ylim <- c(max_se + se_pad, 0)

  ci_levels <- funnel_opts$ci_levels
  alpha_levels <- 1 - (ci_levels / 100)
  alpha_levels <- alpha_levels[is.finite(alpha_levels) & alpha_levels > 0]
  max_z <- if (length(alpha_levels) > 0) max(qnorm(1 - alpha_levels / 2)) else qnorm(0.975)
  ci_extent <- max_z * (max_se + se_pad)

  xlim <- c(padding$lower, padding$upper)
  xlim[1] <- min(xlim[1], -ci_extent)
  xlim[2] <- max(xlim[2], ci_extent)

  old_par <- par(no.readonly = TRUE)
  on.exit(par(old_par))

  plot(
    NA, NA,
    xlim = xlim,
    ylim = ylim,
    xlab = funnel_opts$xlab,
    ylab = funnel_opts$ylab,
    type = "n",
    axes = FALSE,
    xaxs = "i",
    yaxs = "i"
  )

  se_grid <- seq(from = ylim[1], to = ylim[2], length.out = 400)

  shade_cols <- rep(funnel_opts$ci_shades, length.out = length(ci_levels))
  contour_cols <- rep(c("gray90", "gray70", "gray50"), length.out = length(ci_levels))
  names(shade_cols) <- ci_levels
  names(contour_cols) <- ci_levels

  if (length(ci_levels) > 0) {
    alpha_full <- 1 - (ci_levels / 100)
    draw_order <- order(alpha_full)
    for (idx in draw_order) {
      level_value <- ci_levels[idx]
      alpha <- alpha_full[idx]
      if (!is.finite(alpha) || alpha <= 0) {
        next
      }
      z_val <- qnorm(1 - alpha / 2)
      left <- -z_val * se_grid
      right <- z_val * se_grid
      polygon(
        x = c(left, rev(right)),
        y = c(se_grid, rev(se_grid)),
        border = NA,
        col = shade_cols[as.character(level_value)]
      )
      lines(left, se_grid, col = contour_cols[as.character(level_value)], lwd = 1)
      lines(right, se_grid, col = contour_cols[as.character(level_value)], lwd = 1)
    }
  }

  if (length(ci_levels) > 0) {
    abline(v = 0, lty = 3, col = "black")
  }

  y_ticks <- pretty(c(0, max_se), n = 5)
  y_ticks <- unique(y_ticks[y_ticks >= 0 & y_ticks <= (max_se + se_pad)])
  if (length(y_ticks) > 0) {
    grid_col <- adjustcolor("gray70", alpha.f = 0.4)
    abline(h = y_ticks, col = grid_col, lwd = 0.5)
  }

  abline(v = simple_mean, lty = 4, lwd = 2, col = "black")

  if (!is.null(intercept) && !is.null(intercept_se) && !is.null(slope_coef)) {
    p_exp <- if (is_quaratic_fit) 2 else 1
    se_curve_grid <- seq(0, max_se + se_pad, length.out = 200)
    x_pred <- intercept + slope_coef * se_curve_grid^p_exp
    lines(x_pred, se_curve_grid, lwd = 2, col = "black")

    vcov <- matrix(c(intercept_se^2, 0, 0, intercept_se^2), nrow = 2)
    se_fit <- sqrt(
      vcov[1, 1] +
        2 * se_curve_grid^p_exp * vcov[1, 2] +
        (se_curve_grid^p_exp)^2 * vcov[2, 2]
    )

    ci_lo <- x_pred - 1.96 * se_fit
    ci_hi <- x_pred + 1.96 * se_fit

    lines(ci_lo, se_curve_grid, lty = 2, col = "black")
    lines(ci_hi, se_curve_grid, lty = 2, col = "black")
  }

  if (length(x_values) > 0) {
    points(
      x = x_values,
      y = y_values,
      pch = plot_pch,
      col = funnel_opts$col,
      bg = point_bg,
      cex = funnel_opts$pt_cex
    )
  }

  x_ticks <- pretty(xlim, n = 6)
  axis(1,
    at = x_ticks,
    labels = formatC(x_ticks, format = "f", digits = funnel_opts$digits)
  )

  if (length(y_ticks) > 0) {
    axis(2,
      at = y_ticks,
      labels = round(y_ticks),
      las = 1
    )
  }

  box()

  par_usr <- par("usr")
  y_span <- abs(par_usr[4] - par_usr[3])
  top_offset <- y_span * 0.04
  label_y_simple <- par_usr[4] - top_offset
  label_y_maive <- label_y_simple

  par_xpd_old <- par("xpd")
  on.exit(par(xpd = par_xpd_old), add = TRUE)
  par(xpd = NA)

  text(
    simple_mean,
    label_y_simple,
    labels = paste0("Simple mean = ", round(simple_mean, 2)),
    cex = 0.9,
    adj = c(0.5, 0)
  )

  if (!is.null(intercept) && !is.null(intercept_se)) {
    x_range <- diff(range(xlim))
    if (!is.finite(x_range) || x_range == 0) {
      x_range <- 1
    }
    distance <- abs(simple_mean - intercept)
    if (is.finite(distance) && distance < 0.2 * x_range) {
      label_y_maive <- label_y_simple - y_span * 0.05
    }

    text(
      intercept,
      label_y_maive,
      labels = paste0("MAIVE = ", round(intercept, 2), " (SE = ", round(intercept_se, 2), ")"),
      cex = 0.9,
      adj = c(0.5, 0)
    )
  }

  par(xpd = par_xpd_old)

  p_value_labels <- character(0)
  contour_cols_ordered <- character(0)
  if (length(ci_levels) > 0) {
    p_values <- 1 - (ci_levels / 100)
    p_value_labels <- sprintf("p < %.2f", p_values)
    contour_cols_ordered <- contour_cols[as.character(ci_levels)]
  }

  legend_labels <- c(
    funnel_opts$legend_texts[1:2],
    "Simple mean",
    "MAIVE fit",
    "95% CI bounds",
    p_value_labels
  )

  legend_pch <- c(
    funnel_opts$effect_pch,
    rep(NA, 3 + length(p_value_labels))
  )

  legend_col <- c(
    rep(funnel_opts$text_color, 2),
    "black",
    "black",
    "black",
    contour_cols_ordered
  )

  legend_pt_bg <- c(
    funnel_opts$effect_shades,
    rep(NA, 3 + length(p_value_labels))
  )

  legend_pt_cex <- c(
    rep(funnel_opts$pt_cex, 2),
    rep(NA, 3 + length(p_value_labels))
  )

  legend_lty <- c(
    rep(NA, 2),
    4,
    1,
    2,
    rep(1, length(p_value_labels))
  )

  legend_lwd <- c(
    rep(NA, 2),
    2,
    2,
    1,
    rep(1, length(p_value_labels))
  )

  legend(
    funnel_opts$legend_position,
    legend = legend_labels,
    pch = legend_pch,
    col = legend_col,
    pt.bg = legend_pt_bg,
    pt.cex = legend_pt_cex,
    lty = legend_lty,
    lwd = legend_lwd,
    bg = funnel_opts$legend_bg,
    bty = funnel_opts$legend_bty,
    inset = funnel_opts$legend_inset
  )

  invisible(NULL)
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
