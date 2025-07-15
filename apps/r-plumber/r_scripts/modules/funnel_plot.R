#' Round a number until one of two scenarios
#'  1. The number is a float - the last decimal point is non-zero, or there are no decimal points
#'  2. The number is an integer - do not round, the number is returned as an integer
#'
#'  @param num [float] The number to round
#'  @return [float] The rounded number
round_to_non_zero <- function(num) {
  str_num <- formatC(num, format = "f", digits = 15) # Convert to string with sufficient decimals
  dec_part <- unlist(strsplit(str_num, split = "\\."))[[2]]
  if (grepl("^0+$", dec_part)) {
    # The decimal part is made up of only zeros (the number is an integer)
    round_to <- 0
  } else {
    round_to <- max(which(strsplit(dec_part, "")[[1]] != "0")) # Round to last non-zero nubmer
  }
  round(num, round_to)
}
#' Generate ticks for a funnel plot
#'
#' This function takes a vector of three numbers as input, which represent the lower bound,
#' upper bound, and mean value. It generates a sorted vector of tick values between the lower
#' and upper bounds, where ticks are spaced at intervals of 10, excluding ticks that are closer
#' than 2 to either bound. The input mean value is also included in the output vector. Additionally,
#' the function generates a vector of colors ("black" or "red") with the same length as the output
#' vector, where the "red" color corresponds to the position of the mean value.
#'
#' @param input_vec [numeric(3)] A numeric vector of length 3, containing the lower bound, upper bound, and mean value.
#' @param add_zero [logical] If TRUE, always add 0 to the ticks
#' @param theme [character] Theme to use for the ticks
#' @return A list with two elements: "output_vec", a sorted numeric vector containing the generated tick values and the mean value,
#'         and "x_axis_tick_text", a character vector of the same length as "output_vec",
#'         with "red" indicating the position of the mean value and "black" for all other positions.
generate_funnel_ticks <- function(input_vec, add_zero = TRUE, theme = "blue") {
  lower_bound <- input_vec[1]
  upper_bound <- input_vec[2]
  intercept_value <- if (length(input_vec) == 3) input_vec[3] else NULL

  ticks <- c(lower_bound, upper_bound) # Base ticks
  if (add_zero && !(0 %in% ticks) && (0 > lower_bound) && (0 < upper_bound)) {
    ticks <- sort(c(ticks, 0))
  }
  current_tick <- ceiling(lower_bound / 10) * 10 # Closest number divisible by 10 higher than lower bound

  while (current_tick < upper_bound) {
    if ((abs(current_tick - lower_bound) >= 2) && (abs(current_tick - upper_bound) >= 2) && !(current_tick %in% ticks)) {
      ticks <- c(ticks, round(current_tick, 2))
    }
    current_tick <- current_tick + 10
  }

  # Add the mean value and sort the vector
  funnel_ticks <- if (!is.null(intercept_value)) c(ticks, intercept_value) else ticks
  funnel_ticks <- sort(funnel_ticks)

  # Create the color vector
  x_axis_tick_text <- rep("black", length(funnel_ticks))
  if (!is.null(intercept_value)) {
    intercept_index <- which(funnel_ticks == intercept_value)
    x_axis_tick_text[intercept_index] <- if (theme %in% c("blue", "green")) "red" else "blue"
  }

  # Round all ticks to 2 decimal points, and remove trailing zeros
  funnel_ticks <- round(funnel_ticks, 2)
  funnel_ticks <- vapply(funnel_ticks, round_to_non_zero, FUN.VALUE = 1)

  # Format tick labels with color using HTML for ggtext::element_markdown
  funnel_tick_labels <- vapply(
    seq_along(funnel_ticks),
    function(i) {
      sprintf("<span style='color:%s'>%s</span>", x_axis_tick_text[i], funnel_ticks[i])
    },
    FUN.VALUE = character(1)
  )

  return(list(
    "funnel_ticks" = funnel_ticks,
    "x_axis_tick_text" = x_axis_tick_text,
    "funnel_tick_labels" = funnel_tick_labels
  ))
}
get_theme <- function(theme, x_axis_tick_text = "black") {
  # Validate the theme
  # Get specific colors
  theme_color <- switch(theme,
    blue = "#DCEEF3",
    yellow = "#FFFFD1",
    green = "#D1FFD1",
    red = "#FFD1D1",
    purple = "#E6D1FF",
    cli::cli_abort("Invalid theme type.")
  )
  # Construct and return the theme
  ggplot2::theme(
    axis.line = ggplot2::element_line(color = "black", linewidth = 0.5, linetype = "solid"),
    axis.text.x = ggtext::element_markdown(color = x_axis_tick_text, size = 16),
    axis.text.y = ggtext::element_markdown(color = "black", size = 16),
    axis.title.x = ggplot2::element_text(size = 18),
    axis.title.y = ggplot2::element_text(size = 18),
    legend.text = ggplot2::element_text(size = 14),
    panel.background = ggplot2::element_rect(fill = "white"),
    panel.grid.major.x = ggplot2::element_line(color = theme_color),
    plot.background = ggplot2::element_rect(fill = theme_color)
  )
}

#' Get the color for the funnel plot
#'
#' @param theme [character] The theme to use
#' @return [character] The color for the funnel plot
get_colors <- function(theme) {
  switch(theme,
    blue = "#1261ff",
    yellow = "#D1B00D",
    green = "#00FF00",
    red = "#FF0000",
    purple = "#800080",
    cli::cli_abort(paste("Invalid theme type", theme))
  )
}

#' Get a mock funnel plot
#'
#' @param effect [numeric] The effect size
#' @param se [numeric] The standard error
#' @param intercept [numeric] The intercept of the funnel plot. If NULL, no intercept is plotted.
#' @return A base64 encoded string of the funnel plot
#' @export
get_funnel_plot <- function(effect, se, intercept = NULL) {
  precision <- 1 / se^2

  # Filter out the outliers
  # filter_effect <- getOutliers(input_data, effect_proximity = effect_proximity, maximum_precision = maximum_precision, verbose = verbose)

  theme <- "blue"
  add_zero <- TRUE
  precision_to_log <- FALSE


  # Get visual bounds and tick colors
  funnel_x_lbound <- min(effect)
  funnel_x_ubound <- max(effect)

  # Generate and extract the info
  base_funnel_ticks <- c(funnel_x_lbound, funnel_x_ubound) # c(lbound, ubound)
  if (!is.null(intercept)) base_funnel_ticks <- c(base_funnel_ticks, intercept)
  funnel_visual_info <- generate_funnel_ticks(base_funnel_ticks, add_zero = add_zero, theme = theme)
  funnel_ticks <- funnel_visual_info$funnel_ticks
  funnel_tick_text <- funnel_visual_info$x_axis_tick_text
  funnel_tick_labels <- funnel_visual_info$funnel_tick_labels

  # Get the theme to use
  current_theme <- get_theme(theme, x_axis_tick_text = funnel_tick_text)
  point_color <- get_colors(theme)
  vline_color <- if (theme %in% c("blue", "green")) "#D10D0D" else "#0d4ed1" # Make v-line contrast with the theme

  # Precision to log if necessary
  if (precision_to_log) {
    precision <- log(precision)
  }

  x_title <- "Effect"
  y_title <- "Precision"

  p <- ggplot2::ggplot(
    data.frame(effect, precision),
    ggplot2::aes(x = effect, y = precision) # nolint: object_usage_linter.
  ) +
    ggplot2::geom_point(color = point_color) +
    ggplot2::labs(title = NULL, x = x_title, y = y_title) +
    ggplot2::scale_x_continuous(breaks = funnel_ticks, labels = funnel_tick_labels) +
    current_theme

  if (!is.null(intercept)) p <- p + ggplot2::geom_vline(ggplot2::aes(xintercept = intercept), color = vline_color, linewidth = 0.5)

  tmp <- tempfile(fileext = ".png")
  png(tmp, width = 800, height = 600, res = 96)
  print(p) # nolint: undesirable_function_linter.
  dev.off()

  raw_png <- readBin(tmp, "raw", n = file.info(tmp)$size)
  unlink(tmp)

  data_uri <- paste0(
    "data:image/png;base64,",
    base64enc::base64encode(raw_png)
  )
  data_uri
}
