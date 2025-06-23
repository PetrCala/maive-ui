#' Get a mock funnel plot
#'
#' @return A base64 encoded string of the funnel plot
#' @export
get_funnel_plot <- function(effect, se) {
  # precision <- 1 / se^2

  ###########

  # # Filter out the outliers
  # filter_effect <- getOutliers(input_data, effect_proximity = effect_proximity, maximum_precision = maximum_precision, verbose = verbose)

  # # Create the data frame for the funnel plot
  # funnel_data <- input_data[filter_effect, c("study_id", "effect", "precision")] # Only Effect, Precision
  # funnel_data[] <- lapply(funnel_data, as.numeric) # To numeric

  # # Plot study medians instead
  # if (use_study_medians) {
  #   funnel_data <- funnel_data %>%
  #     group_by(study_id) %>%
  #     summarize(
  #       median_effect = median(effect),
  #       median_precision = precision[which.min(abs(effect - median_effect))]
  #     )
  #   colnames(funnel_data) <- c("study_id", "effect", "precision")
  # }

  # # Get visual bounds and tick colors
  # funnel_x_lbound <- min(funnel_data$effect)
  # funnel_x_ubound <- max(funnel_data$effect)
  # mean_x_tick <- mean(funnel_data$effect)
  # # Generate and extract the info
  # base_funnel_ticks <- c(funnel_x_lbound, funnel_x_ubound, mean_x_tick) # c(lbound, ubound, mean)
  # funnel_visual_info <- generateFunnelTicks(base_funnel_ticks, add_zero = add_zero, theme = theme)
  # funnel_ticks <- funnel_visual_info$funnel_ticks
  # funnel_tick_text <- funnel_visual_info$x_axis_tick_text
  # # Get the theme to use
  # current_theme <- getTheme(theme, x_axis_tick_text = funnel_tick_text)
  # point_color <- getColors(theme, "funnel_plot")
  # vline_color <- ifelse(theme %in% c("blue", "green"), "#D10D0D", "#0d4ed1") # Make v-line contrast with the theme

  # # Precision to log if necessary
  # if (precision_to_log) {
  #   funnel_data$precision <- log(funnel_data$precision)
  # }

  # ###########

  # theme_color <- switch(theme,
  #   blue = "#DCEEF3",
  #   yellow = "#FFFFD1",
  #   green = "#D1FFD1",
  #   red = "#FFD1D1",
  #   purple = "#E6D1FF",
  #   stop("Invalid theme type.")
  # )

  # theme(
  #   axis.line = element_line(color = "black", linewidth = 0.5, linetype = "solid"),
  #   axis.text.x = ggtext::element_markdown(color = x_axis_tick_text, size = 16),
  #   axis.text.y = ggtext::element_markdown(color = "black", size = 16),
  #   axis.title.x = element_text(size = 18),
  #   axis.title.y = element_text(size = 18),
  #   legend.text = element_text(size = 14),
  #   panel.background = element_rect(fill = "white"),
  #   panel.grid.major.x = element_line(color = theme_color),
  #   plot.background = element_rect(fill = theme_color)
  # )

  # x_title <- ifelse(use_study_medians, "study median values", "all observations")
  # p <- ggplot2::ggplot(
  #   data.frame(effect, precision),
  #   ggplot2::aes(x = effect, y = precision)
  # ) +
  #   ggplot2::geom_point(color = point_color) +
  #   ggplot2::geom_vline(aes(xintercept = base::mean(effect)), color = vline_color, linewidth = 0.5) +
  #   ggplot2::labs(title = NULL, x = "Effect", y = "Precision") +
  #   ggplot2::scale_x_continuous(breaks = funnel_ticks, labels = intOrDecimal) + # Display integers as integers, floats as floats
  #   current_theme

  # tmp <- tempfile(fileext = ".png")
  # png(tmp, width = 800, height = 600, res = 96)
  # print(p) # nolint: undesirable_function_linter.
  # dev.off()

  # raw_png <- readBin(tmp, "raw", n = file.info(tmp)$size)
  # unlink(tmp)

  # data_uri <- paste0(
  #   "data:image/png;base64,",
  #   base64enc::base64encode(raw_png)
  # )
  # data_uri
  NULL
}
