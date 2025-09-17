#!/usr/bin/env Rscript
# Enhanced test script for the updated funnel plot using beauty dataset with actual MAIVE results
# This script loads the beauty.xls dataset, runs MAIVE analysis, and generates a funnel plot

# Load required libraries
library(readxl)
library(metafor)
library(clubSandwich)
library(varhandle)
library(pracma)
library(sandwich)

# Source the funnel plot functions
source("apps/lambda-r-backend/r_scripts/funnel_plot.R")

# Source the MAIVE functions (if available)
if (file.exists("R/maivefunction.r")) {
  source("R/maivefunction.r")
  source("R/boot.r")
  source("R/ar.r")
  maive_available <- TRUE
} else {
  cat("MAIVE functions not found, using mock results\n")
  maive_available <- FALSE
}

# Load the beauty dataset
cat("Loading beauty.xls dataset...\n")
beauty <- read_excel("lib/beauty.xls")

# Display dataset structure
cat("Dataset dimensions:", dim(beauty), "\n")
cat("Column names:", colnames(beauty), "\n")

# Rename columns to match expected format
if (ncol(beauty) >= 3) {
  colnames(beauty)[1:3] <- c("bs", "sebs", "Ns")
  if (ncol(beauty) >= 4) {
    colnames(beauty)[4] <- "study_id"
  }
}

cat("\nDataset summary:\n")
print(summary(beauty))

# Extract the data for funnel plot
effect <- beauty$bs
se <- beauty$sebs

# Calculate simple statistics
simple_mean <- mean(effect)
cat("\nSimple mean of effect estimates:", round(simple_mean, 3), "\n")

# Run MAIVE analysis if available
if (maive_available) {
  cat("\nRunning MAIVE analysis...\n")

  # Run MAIVE with PET-PEESE method (default)
  maive_res <- maive(
    dat = beauty,
    method = 3, # PET-PEESE
    weight = 0, # no weights
    instrument = 1, # with instrumentation
    studylevel = 2, # cluster
    SE = 3, # wild bootstrap
    AR = 1 # with AR
  )

  # Extract MAIVE results
  intercept <- maive_res$beta
  intercept_se <- maive_res$SE
  slope_coef <- maive_res$slope_coef
  se_adjusted <- maive_res$SE_instrumented
  is_quadratic_fit <- TRUE # PEESE uses quadratic fit

  cat("\nMAIVE Results:\n")
  cat("MAIVE estimate (beta):", round(intercept, 3), "\n")
  cat("MAIVE standard error:", round(intercept_se, 3), "\n")
  cat("Slope coefficient:", round(slope_coef, 3), "\n")
  cat("Publication bias p-value:", round(maive_res$`pub bias p-value`, 3), "\n")
  cat("F-test statistic:", round(maive_res$`F-test`, 3), "\n")
} else {
  # Use mock results for demonstration
  cat("\nUsing mock MAIVE parameters for demonstration...\n")
  intercept <- 2.5 # Mock MAIVE estimate
  intercept_se <- 0.3 # Mock MAIVE standard error
  slope_coef <- 0.1 # Mock slope coefficient
  se_adjusted <- se * 1.2 # Mock adjusted SE
  is_quadratic_fit <- TRUE # Quadratic fit (PEESE-style)

  cat("Mock MAIVE estimate (intercept):", intercept, "\n")
  cat("Mock MAIVE standard error:", intercept_se, "\n")
  cat("Mock slope coefficient:", slope_coef, "\n")
  cat("Mock adjusted SE multiplier: 1.2\n")
}

# Generate the funnel plot
cat("\nGenerating funnel plot...\n")

# Create a PNG file for the plot
png("beauty_funnel_plot_with_maive.png", width = 1000, height = 800, res = 120)

# Call the updated funnel plot function
get_funnel_plot(
  effect = effect,
  se = se,
  se_adjusted = se_adjusted,
  intercept = intercept,
  intercept_se = intercept_se,
  slope_coef = slope_coef,
  is_quaratic_fit = is_quadratic_fit
)

# Close the PNG device
dev.off()

cat("Funnel plot saved as 'beauty_funnel_plot_with_maive.png'\n")

# Also generate the base64 encoded version for web display
cat("\nGenerating base64 encoded funnel plot...\n")
funnel_data <- get_funnel_plot_data(
  effect = effect,
  se = se,
  se_adjusted = se_adjusted,
  intercept = intercept,
  intercept_se = intercept_se,
  slope_coef = slope_coef,
  is_quaratic_fit = is_quadratic_fit
)

cat("Base64 data URI length:", nchar(funnel_data$data_uri), "characters\n")
cat("Plot dimensions:", funnel_data$width_px, "x", funnel_data$height_px, "pixels\n")

# Display comprehensive statistics about the data
cat("\n=== Dataset Statistics ===\n")
cat("Number of studies:", length(effect), "\n")
cat("Effect size range:", round(range(effect), 3), "\n")
cat("Standard error range:", round(range(se), 3), "\n")
cat("Mean effect size:", round(mean(effect), 3), "\n")
cat("Median effect size:", round(median(effect), 3), "\n")
cat("Mean standard error:", round(mean(se), 3), "\n")
cat("Standard deviation of effect sizes:", round(sd(effect), 3), "\n")

# Calculate significance statistics
t_stats <- abs(effect) / se
significant_10 <- sum(t_stats > qt(0.95, df = Inf))
significant_05 <- sum(t_stats > qt(0.975, df = Inf))
significant_01 <- sum(t_stats > qt(0.995, df = Inf))

cat("\n=== Significance Analysis ===\n")
cat(
  "Studies with p < 0.10:", significant_10, "out of", length(effect),
  "(", round(100 * significant_10 / length(effect), 1), "%)\n"
)
cat(
  "Studies with p < 0.05:", significant_05, "out of", length(effect),
  "(", round(100 * significant_05 / length(effect), 1), "%)\n"
)
cat(
  "Studies with p < 0.01:", significant_01, "out of", length(effect),
  "(", round(100 * significant_01 / length(effect), 1), "%)\n"
)

# Calculate effect size distribution
positive_effects <- sum(effect > 0)
negative_effects <- sum(effect < 0)
zero_effects <- sum(effect == 0)

cat("\n=== Effect Size Distribution ===\n")
cat("Positive effects:", positive_effects, "(", round(100 * positive_effects / length(effect), 1), "%)\n")
cat("Negative effects:", negative_effects, "(", round(100 * negative_effects / length(effect), 1), "%)\n")
cat("Zero effects:", zero_effects, "(", round(100 * zero_effects / length(effect), 1), "%)\n")

# Calculate precision (inverse of SE)
precision <- 1 / se
cat("\n=== Precision Analysis ===\n")
cat("Mean precision (1/SE):", round(mean(precision), 3), "\n")
cat("Median precision:", round(median(precision), 3), "\n")
cat("Precision range:", round(range(precision), 3), "\n")

cat("\n=== Funnel Plot Features ===\n")
cat("✓ Statistical significance contours centered at x = 0\n")
cat("✓ P-value bands: p < 0.10, p < 0.05, p < 0.01\n")
cat("✓ Simple mean vertical line (dash-dot style) with label\n")
cat("✓ MAIVE fit curve with label at top\n")
cat("✓ Rounded y-axis tick labels\n")
cat("✓ Enhanced legend with all elements\n")
cat("✓ Both base effect and adjusted SE points displayed\n")

if (maive_available) {
  cat("\n✓ Real MAIVE results used for analysis\n")
} else {
  cat("\n⚠ Mock MAIVE results used (install MAIVE package for real results)\n")
}

cat("\nScript completed successfully!\n")
cat("Check 'beauty_funnel_plot_with_maive.png' for the generated plot.\n")
cat("The plot shows the beauty premium dataset with enhanced funnel plot features.\n")
