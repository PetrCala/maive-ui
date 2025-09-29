# nolint start: undesirable_function_linter.

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
  left_padding <- 0.05
  right_padding <- 0.25

  effect_all <- effect
  min_effect <- suppressWarnings(min(effect_all, na.rm = TRUE))
  max_effect <- suppressWarnings(max(effect_all, na.rm = TRUE))

  if (!is.finite(min_effect) || !is.finite(max_effect)) {
    return(list(lower = -1, upper = 1))
  }

  effect_range <- max_effect - min_effect
  if (!is.finite(effect_range) || effect_range <= 0) {
    effect_range <- max(abs(effect_all), na.rm = TRUE)
    if (!is.finite(effect_range) || effect_range == 0) {
      effect_range <- 1
    }
  }

  xlim_pad_left <- left_padding * effect_range
  xlim_pad_right <- right_padding * effect_range
  list(
    lower = min_effect - xlim_pad_left,
    upper = max_effect + xlim_pad_right
  )
}

format_axis_labels <- function(ticks, digits = 3) {
  finite_ticks <- ticks[is.finite(ticks)]
  if (length(finite_ticks) == 0) {
    return(character(0))
  }

  if (all(abs(finite_ticks - round(finite_ticks)) < .Machine$double.eps^0.5)) {
    return(sprintf("%d", as.integer(round(ticks))))
  }

  unique_ticks <- sort(unique(finite_ticks))
  decimals <- digits
  if (length(unique_ticks) > 1) {
    diffs <- diff(unique_ticks)
    diffs <- diffs[diffs > 0]
    if (length(diffs) > 0) {
      min_diff <- min(diffs)
      if (is.finite(min_diff) && min_diff > 0) {
        decimals <- max(0, min(digits, ceiling(-log10(min_diff))))
      }
    }
  }

  formatC(ticks, format = "f", digits = decimals)
}

#' Get a funnel plot using base graphics
#'
#' @param effect [numeric] The effect size
#' @param se [numeric] The standard error
#' @param se_adjusted [numeric] The adjusted standard error (optional)
#' @param intercept [numeric] The intercept of the funnel plot. If NULL, no intercept is plotted.
#' @param intercept_se [numeric] The standard error of the intercept. Must be provided only if intercept is provided.
#' @param slope_coef [numeric|list] Legacy slope coefficient of the funnel plot. If NULL, slope construction
#'        relies on the structured `slope` argument. Numerical values are treated as linear (or quadratic when
#'        `is_quadratic_fit` is TRUE).
#' @param is_quadratic_fit [logical|list] Legacy flag (or metadata list) describing whether the fit is quadratic.
#' @param slope [list] Structured slope metadata containing `type`, `coefficient`, optional `detail`, and
#'        an optional `quadratic` flag. This mirrors the MAIVE package output introduced in commit
#'        f6c76aa0643910f2ee2f13d8fc49a2d398c08f3d.
#' @param instrument [numeric] Indicator for whether instrumenting is enabled (1) or disabled (0).
#' @return A plot object
#' @export
get_funnel_plot <- function(
    effect,
    se,
    se_adjusted = NULL,
    intercept = NULL,
    intercept_se = NULL,
    slope_coef = NULL,
    is_quadratic_fit = NULL,
    instrument = 1,
    slope = NULL) {
  funnel_opts <- get_funnel_plot_opts()

  first_non_null <- function(...) {
    vals <- list(...)
    for (val in vals) {
      if (!is.null(val)) {
        return(val)
      }
    }
    NULL
  }

  normalize_slope <- function(primary, fallback_coef, fallback_summary) {
    metadata <- list(
      type = NULL,
      quadratic = FALSE,
      coefficient = fallback_coef,
      detail = NULL
    )

    if (is.list(primary)) {
      metadata$type <- first_non_null(primary$type, primary$slope_type)
      if (!is.null(primary$quadratic)) {
        metadata$quadratic <- isTRUE(primary$quadratic)
      }
      if (!is.null(primary$coefficient)) {
        metadata$coefficient <- primary$coefficient
      }
      metadata$detail <- first_non_null(primary$detail, primary$slope_detail)
    } else if (is.logical(primary) && length(primary) == 1) {
      metadata$quadratic <- isTRUE(primary)
    }

    if (is.list(fallback_summary)) {
      if (!is.null(fallback_summary$quadratic)) {
        metadata$quadratic <- isTRUE(fallback_summary$quadratic)
      }
      if (is.null(metadata$type)) {
        metadata$type <- first_non_null(fallback_summary$slope_type, fallback_summary$type)
      }
      if (is.null(metadata$detail)) {
        metadata$detail <- first_non_null(fallback_summary$slope_detail, fallback_summary$detail)
      }
      if (is.null(metadata$coefficient) && !is.null(fallback_summary$coefficient)) {
        metadata$coefficient <- fallback_summary$coefficient
      }
    } else if (is.logical(fallback_summary) && length(fallback_summary) == 1) {
      metadata$quadratic <- isTRUE(fallback_summary)
    }

    if (is.null(metadata$type)) {
      metadata$type <- if (isTRUE(metadata$quadratic)) "quadratic" else "linear"
    }

    metadata$quadratic <- isTRUE(metadata$quadratic)
    metadata
  }

  slope_meta <- normalize_slope(primary = slope, fallback_coef = slope_coef, fallback_summary = is_quadratic_fit)

  n_points <- length(effect)
  use_adjusted <-
    instrument != 0 && !is.null(se_adjusted) && length(se_adjusted) == n_points && any(is.finite(se_adjusted))

  x_values <- effect
  y_values <- se

  plot_pch <- rep(funnel_opts$effect_pch[1], n_points)
  point_bg <- rep(funnel_opts$effect_shades[1], n_points)

  if (use_adjusted) {
    x_values <- c(x_values, effect)
    y_values <- c(y_values, se_adjusted)
    plot_pch <- c(plot_pch, rep(funnel_opts$effect_pch[2], n_points))
    point_bg <- c(point_bg, rep(funnel_opts$effect_shades[2], n_points))
  }

  finite_points <- is.finite(x_values) & is.finite(y_values)
  x_values <- x_values[finite_points]
  y_values <- y_values[finite_points]
  plot_pch <- plot_pch[finite_points]
  point_bg <- point_bg[finite_points]
  point_cex <- max(0.1, funnel_opts$pt_cex * 0.6)

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
  ci_alpha <- 1 - (ci_levels / 100)
  valid_idx <- which(is.finite(ci_alpha) & ci_alpha > 0)
  ci_data <- NULL
  if (length(valid_idx) > 0) {
    ci_data <- data.frame(
      level = ci_levels[valid_idx],
      alpha = ci_alpha[valid_idx],
      z = qnorm(1 - ci_alpha[valid_idx] / 2)
    )
  }
  max_z <- if (!is.null(ci_data) && nrow(ci_data) > 0) max(ci_data$z) else qnorm(0.975) # nolint: object_usage_linter.
  xlim <- c(padding$lower, padding$upper)
  if (!is.finite(xlim[1]) || !is.finite(xlim[2]) || xlim[1] == xlim[2]) {
    x_center <- ifelse(is.finite(simple_mean), simple_mean, 0)
    xlim <- c(x_center - 1, x_center + 1)
  }

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

  se_grid <- seq(0, max_se + se_pad, length.out = 400)

  shade_cols <- rep(funnel_opts$ci_shades, length.out = ifelse(is.null(ci_data), 0, nrow(ci_data)))
  contour_cols <- rep(c("gray90", "gray70", "gray50"), length.out = ifelse(is.null(ci_data), 0, nrow(ci_data)))
  outer_fill_col <- "gray90"
  outer_z <- NA_real_ # nolint: object_usage_linter.

  if (!is.null(ci_data) && nrow(ci_data) > 0) {
    names(shade_cols) <- ci_data$level
    names(contour_cols) <- ci_data$level

    outer_idx <- which.max(ci_data$z)
    outer_z <- ci_data$z[outer_idx]

    p010_idx <- if (length(contour_cols) > 0) match(90, ci_data$level) else NA_integer_
    if (!is.na(p010_idx)) {
      outer_fill_col <- contour_cols[as.character(ci_data$level[p010_idx])]
    } else if (length(contour_cols) > 0) {
      outer_fill_col <- contour_cols[outer_idx]
    }

    rect(xlim[1], ylim[2], xlim[2], ylim[1], col = outer_fill_col, border = NA)

    draw_order <- order(ci_data$z, decreasing = TRUE)
    for (idx in draw_order) {
      level_value <- ci_data$level[idx]
      z_val <- ci_data$z[idx]
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
  } else {
    rect(xlim[1], ylim[2], xlim[2], ylim[1], col = outer_fill_col, border = NA)
  }

  y_ticks <- pretty(c(0, max_se), n = 5)
  y_ticks <- unique(y_ticks[y_ticks >= 0 & y_ticks <= (max_se + se_pad)])
  if (length(y_ticks) > 0) {
    grid_col <- adjustcolor("gray70", alpha.f = 0.4)
    abline(h = y_ticks, col = grid_col, lwd = 0.5)
  }

  draw_vertical_segment <- function(x_pos, lty, lwd, col) {
    if (!is.finite(x_pos)) {
      return()
    }
    segments(x_pos, ylim[1], x_pos, ylim[2], lty = lty, lwd = lwd, col = col)
  }

  if (!is.null(ci_data) && nrow(ci_data) > 0) {
    draw_vertical_segment(0, lty = 3, lwd = 1, col = "black")
  } else {
    abline(v = 0, lty = 3, col = "black")
  }

  draw_vertical_segment(simple_mean, lty = 4, lwd = 2, col = "black")

  se_curve_grid <- seq(0, max_se + se_pad, length.out = 200)

  if (!is.null(intercept) && !is.null(intercept_se) && !is.null(slope_meta$coefficient)) {
    slope_type <- tolower(as.character(first_non_null(slope_meta$type, "linear")))

    draw_quadratic_or_linear <- function(power) {
      slope_value <- suppressWarnings(as.numeric(slope_meta$coefficient))
      if (length(slope_value) != 1 || !is.finite(slope_value)) {
        return()
      }
      se_term <- se_curve_grid^power
      x_pred <- intercept + slope_value * se_term
      lines(x_pred, se_curve_grid, lwd = 2, col = "black")

      vcov <- matrix(c(intercept_se^2, 0, 0, intercept_se^2), nrow = 2)
      se_fit <- sqrt(
        vcov[1, 1] +
          2 * se_term * vcov[1, 2] +
          se_term^2 * vcov[2, 2]
      )

      ci_lo <- x_pred - 1.96 * se_fit
      ci_hi <- x_pred + 1.96 * se_fit

      lines(ci_lo, se_curve_grid, lty = 2, col = "black")
      lines(ci_hi, se_curve_grid, lty = 2, col = "black")
    }

    draw_kinked <- function() {
      kink_effect <- NA_real_
      kink_location <- NA_real_

      if (is.list(slope_meta$coefficient)) {
        if (!is.null(slope_meta$coefficient$kink_effect)) {
          kink_effect <- as.numeric(slope_meta$coefficient$kink_effect)
        }
        if (!is.null(slope_meta$coefficient$kink_location)) {
          kink_location <- as.numeric(slope_meta$coefficient$kink_location)
        }
      }

      if (is.list(slope_meta$detail)) {
        if (is.na(kink_effect) && !is.null(slope_meta$detail$kink_effect)) {
          kink_effect <- as.numeric(slope_meta$detail$kink_effect)
        }
        if (is.na(kink_location) && !is.null(slope_meta$detail$kink_location)) {
          kink_location <- as.numeric(slope_meta$detail$kink_location)
        }
      }

      if (!is.finite(kink_effect) || !is.finite(kink_location)) {
        return()
      }

      se_term <- pmax(se_curve_grid - kink_location, 0)
      x_pred <- intercept + kink_effect * se_term

      lines(x_pred, se_curve_grid, lwd = 2, col = "black")

      ci_offset <- 1.96 * intercept_se
      lines(x_pred - ci_offset, se_curve_grid, lty = 2, col = "black")
      lines(x_pred + ci_offset, se_curve_grid, lty = 2, col = "black")

      draw_vertical_segment(kink_location, lty = 3, lwd = 1, col = adjustcolor("black", alpha.f = 0.5))
    }

    if (slope_type %in% c("quadratic") || (slope_meta$quadratic && slope_type == "linear")) {
      draw_quadratic_or_linear(power = 2)
    } else if (slope_type %in% c("linear")) {
      draw_quadratic_or_linear(power = 1)
    } else if (slope_type %in% c("kink", "kinked")) {
      draw_kinked()
    }
  }

  if (length(x_values) > 0) {
    points(
      x = x_values,
      y = y_values,
      pch = plot_pch,
      col = funnel_opts$col,
      bg = point_bg,
      cex = point_cex
    )
  }

  x_ticks <- pretty(xlim, n = 6)
  x_ticks_int <- sort(unique(round(x_ticks)))
  x_ticks_int <- x_ticks_int[x_ticks_int >= floor(xlim[1]) & x_ticks_int <= ceiling(xlim[2])]
  if (length(x_ticks_int) < 2) {
    x_ticks_int <- round(seq(from = xlim[1], to = xlim[2], length.out = 5))
    x_ticks_int <- sort(unique(x_ticks_int))
  }
  axis(1,
    at = x_ticks_int,
    labels = sprintf("%d", x_ticks_int)
  )

  if (length(y_ticks) > 0) {
    axis(2,
      at = y_ticks,
      labels = format_axis_labels(y_ticks, digits = funnel_opts$digits),
      las = 1
    )
  }

  box()

  clamp_value <- function(value, lower, upper) {
    if (is.na(value) || !is.finite(value)) {
      return(value)
    }
    if (!is.finite(lower) || !is.finite(upper)) {
      return(value)
    }
    if (lower > upper) {
      midpoint <- (lower + upper) / 2
      return(midpoint)
    }
    max(min(value, upper), lower)
  }

  convert_width_to_user <- function(width_in_inches) {
    pin <- par("pin")
    if (length(pin) < 2 || pin[1] <= 0) {
      return(0)
    }
    width_in_inches * x_span / pin[1]
  }

  convert_height_to_user <- function(height_in_inches) {
    pin <- par("pin")
    if (length(pin) < 2 || pin[2] <= 0) {
      return(0)
    }
    height_in_inches * y_span / pin[2]
  }

  par_usr <- par("usr")
  x_span <- abs(par_usr[2] - par_usr[1])
  if (!is.finite(x_span) || x_span == 0) {
    x_span <- 1
  }
  y_span <- abs(par_usr[4] - par_usr[3])
  if (!is.finite(y_span) || y_span == 0) {
    y_span <- 1
  }
  top_offset <- y_span * 0.04
  label_y_simple <- par_usr[4] - top_offset
  label_y_maive <- label_y_simple

  simple_label <- paste0("Simple mean = ", round(simple_mean, 2))
  simple_label_width <- convert_width_to_user(strwidth(simple_label, cex = 0.9))
  simple_label_height <- convert_height_to_user(strheight(simple_label, cex = 0.9))
  horizontal_padding <- max(x_span * 0.01, simple_label_width * 0.05)
  vertical_padding <- y_span * 0.01

  par_xpd_old <- par("xpd")
  on.exit(par(xpd = par_xpd_old), add = TRUE)
  par(xpd = NA)

  label_y_simple <- min(label_y_simple, par_usr[4] - simple_label_height - vertical_padding)
  label_x_simple <- clamp_value(
    simple_mean,
    xlim[1] + simple_label_width / 2 + horizontal_padding,
    xlim[2] - simple_label_width / 2 - horizontal_padding
  )

  if (is.finite(label_x_simple)) {
    text(
      label_x_simple,
      label_y_simple,
      labels = simple_label,
      cex = 0.9,
      adj = c(0.5, 0)
    )
  }

  if (!is.null(intercept) && !is.null(intercept_se) && is.finite(intercept)) {
    intercept_label <- if (instrument == 0) "Regression fit" else "MAIVE"
    intercept_label_text <- paste0(
      intercept_label,
      " = ",
      round(intercept, 2),
      " (SE = ",
      round(intercept_se, 2),
      ")"
    )

    intercept_label_width <- convert_width_to_user(strwidth(intercept_label_text, cex = 0.9))
    intercept_label_height <- convert_height_to_user(strheight(intercept_label_text, cex = 0.9))

    total_horizontal_padding <- max(horizontal_padding, intercept_label_width * 0.05)
    label_x_intercept <- clamp_value(
      intercept,
      xlim[1] + intercept_label_width / 2 + total_horizontal_padding,
      xlim[2] - intercept_label_width / 2 - total_horizontal_padding
    )

    label_y_maive <- min(label_y_maive, par_usr[4] - intercept_label_height - vertical_padding)

    simple_bounds <- c(
      label_x_simple - simple_label_width / 2,
      label_x_simple + simple_label_width / 2
    )
    intercept_bounds <- c(
      label_x_intercept - intercept_label_width / 2,
      label_x_intercept + intercept_label_width / 2
    )

    ranges_overlap <- !(
      is.na(simple_bounds[1]) ||
        is.na(simple_bounds[2]) ||
        is.na(intercept_bounds[1]) ||
        is.na(intercept_bounds[2]) ||
        intercept_bounds[1] > simple_bounds[2] ||
        intercept_bounds[2] < simple_bounds[1]
    )

    if (ranges_overlap) {
      desired_baseline <- label_y_simple - intercept_label_height - vertical_padding
      if (is.finite(desired_baseline)) {
        label_y_maive <- min(label_y_maive, desired_baseline)
      }
    }

    if (is.finite(label_x_simple) && is.finite(label_x_intercept)) {
      distance <- abs(label_x_simple - label_x_intercept)
      proximity_threshold <- max(simple_label_width, intercept_label_width) * 0.6
      if (distance < proximity_threshold) {
        desired_baseline <- label_y_simple - intercept_label_height - vertical_padding
        if (is.finite(desired_baseline)) {
          label_y_maive <- min(label_y_maive, desired_baseline)
        }
      }
    }

    min_baseline <- ylim[1] + vertical_padding
    if (is.finite(min_baseline)) {
      label_y_maive <- max(label_y_maive, min_baseline)
    }

    if (is.finite(label_x_intercept) && is.finite(label_y_maive)) {
      text(
        label_x_intercept,
        label_y_maive,
        labels = intercept_label_text,
        cex = 0.9,
        adj = c(0.5, 0)
      )
    }
  }

  par(xpd = par_xpd_old)

  # Use plotmath expressions so inequality symbols render even when Unicode glyphs are missing.
  p_value_labels <- expression()
  p_legend_fill <- character(0)
  if (!is.null(ci_data) && nrow(ci_data) > 0) {
    level_names <- as.character(ci_data$level)

    if ("90" %in% level_names) {
      p_value_labels <- c(p_value_labels, "p >= 0.10")
      p_legend_fill <- c(p_legend_fill, shade_cols["90"])
    }

    if ("95" %in% level_names) {
      p_value_labels <- c(p_value_labels, "0.10 > p >= 0.05")
      p_legend_fill <- c(p_legend_fill, shade_cols["95"])
    }

    if ("99" %in% level_names) {
      p_value_labels <- c(p_value_labels, "0.05 > p >= 0.01")
      p_legend_fill <- c(p_legend_fill, shade_cols["99"])
    }

    p_value_labels <- c(p_value_labels, "p < 0.01")
    p_legend_fill <- c(p_legend_fill, outer_fill_col)
  }

  fit_label <- if (instrument == 0) "Regression fit" else "MAIVE fit"

  legend_labels <- c(funnel_opts$legend_texts[1])
  legend_pch <- c(funnel_opts$effect_pch[1])
  legend_col <- c(funnel_opts$text_color)
  legend_pt_bg <- c(funnel_opts$effect_shades[1])
  legend_pt_cex <- c(point_cex)
  legend_lty <- c(NA)
  legend_lwd <- c(NA)

  if (use_adjusted) {
    legend_labels <- c(legend_labels, funnel_opts$legend_texts[2])
    legend_pch <- c(legend_pch, funnel_opts$effect_pch[2])
    legend_col <- c(legend_col, funnel_opts$text_color)
    legend_pt_bg <- c(legend_pt_bg, funnel_opts$effect_shades[2])
    legend_pt_cex <- c(legend_pt_cex, point_cex)
    legend_lty <- c(legend_lty, NA)
    legend_lwd <- c(legend_lwd, NA)
  }

  legend_labels <- c(legend_labels, "Simple mean")
  legend_pch <- c(legend_pch, NA)
  legend_col <- c(legend_col, "black")
  legend_pt_bg <- c(legend_pt_bg, NA)
  legend_pt_cex <- c(legend_pt_cex, NA)
  legend_lty <- c(legend_lty, 4)
  legend_lwd <- c(legend_lwd, 2)

  legend_labels <- c(legend_labels, fit_label)
  legend_pch <- c(legend_pch, NA)
  legend_col <- c(legend_col, "black")
  legend_pt_bg <- c(legend_pt_bg, NA)
  legend_pt_cex <- c(legend_pt_cex, NA)
  legend_lty <- c(legend_lty, 1)
  legend_lwd <- c(legend_lwd, 2)

  legend_labels <- c(legend_labels, funnel_opts$legend_texts[4])
  legend_pch <- c(legend_pch, NA)
  legend_col <- c(legend_col, "black")
  legend_pt_bg <- c(legend_pt_bg, NA)
  legend_pt_cex <- c(legend_pt_cex, NA)
  legend_lty <- c(legend_lty, 2)
  legend_lwd <- c(legend_lwd, 1)

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

  if (length(p_value_labels) > 0) {
    legend(
      "topright",
      legend = p_value_labels,
      fill = p_legend_fill,
      border = "gray40",
      bg = funnel_opts$legend_bg,
      bty = funnel_opts$legend_bty,
      inset = funnel_opts$legend_inset
      # title = "p-value"
    )
  }

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


# nolint end: undesirable_function_linter.
