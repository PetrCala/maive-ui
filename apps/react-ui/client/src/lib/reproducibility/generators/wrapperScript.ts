/**
 * Generates the main wrapper R script for reproducibility
 *
 * This script orchestrates the entire analysis by:
 * 1. Setting up the R environment and installing packages
 * 2. Loading helper functions from GitHub-sourced R files
 * 3. Loading the user's data
 * 4. Configuring analysis parameters
 * 5. Running the MAIVE analysis
 * 6. Displaying and saving results
 */

import CONST from "@src/CONST";
import type { ModelParameters, ModelResults } from "@src/types/api";
import type { VersionInfo, WinsorizeInfo } from "@src/types/reproducibility";

/**
 * Generates winsorization details section for the R script
 */
function generateWinsorizeSection(
  winsorizeInfo: WinsorizeInfo | undefined,
): string {
  if (!winsorizeInfo || winsorizeInfo.percentage === 0) {
    return "# No winsorization was applied to the data.\n";
  }

  return `
# ============================================================
# WINSORIZATION DETAILS
# ============================================================
# NOTE: Data was winsorized at ${winsorizeInfo.percentage}% during the original analysis.
# The following observations were affected:
#   - Effect sizes (bs): ${winsorizeInfo.clippedEffects} values clipped
#   - Standard errors (sebs): ${winsorizeInfo.clippedSEs} values clipped
#
# Bounds applied:
#   - Effect sizes: [${winsorizeInfo.lowerBoundBS.toFixed(6)}, ${winsorizeInfo.upperBoundBS.toFixed(6)}]
#   - Standard errors: [${winsorizeInfo.lowerBoundSE.toFixed(6)}, ${winsorizeInfo.upperBoundSE.toFixed(6)}]
#
# The data.csv file contains the PRE-winsorized data.
# Winsorization is applied automatically by the run_maive_model() function
# based on the 'winsorize' parameter below.
`;
}

/**
 * Generates the parameters configuration section
 */
function generateParametersSection(parameters: ModelParameters): string {
  return `
# Analysis parameters (exactly as configured in the web application)
parameters <- list(
  modelType = "${parameters.modelType}",
  includeStudyDummies = ${parameters.includeStudyDummies ? "TRUE" : "FALSE"},
  includeStudyClustering = ${parameters.includeStudyClustering ? "TRUE" : "FALSE"},
  standardErrorTreatment = "${parameters.standardErrorTreatment}",
  computeAndersonRubin = ${parameters.computeAndersonRubin ? "TRUE" : "FALSE"},
  maiveMethod = "${parameters.maiveMethod}",
  weight = "${parameters.weight}",
  shouldUseInstrumenting = ${parameters.shouldUseInstrumenting ? "TRUE" : "FALSE"},
  useLogFirstStage = ${parameters.useLogFirstStage ? "TRUE" : "FALSE"},
  winsorize = ${parameters.winsorize}
)

cat("\\nAnalysis Configuration:\\n")
cat("  Model Type:", parameters$modelType, "\\n")
cat("  MAIVE Method:", parameters$maiveMethod, "\\n")
cat("  Weight:", parameters$weight, "\\n")
cat("  Instrumenting:", ifelse(parameters$shouldUseInstrumenting, "Yes", "No"), "\\n")
cat("  Study Dummies:", ifelse(parameters$includeStudyDummies, "Yes", "No"), "\\n")
cat("  Study Clustering:", ifelse(parameters$includeStudyClustering, "Yes", "No"), "\\n")
cat("  SE Treatment:", parameters$standardErrorTreatment, "\\n")
cat("  Anderson-Rubin:", ifelse(parameters$computeAndersonRubin, "Yes", "No"), "\\n")
cat("  Log First Stage:", ifelse(parameters$useLogFirstStage, "Yes", "No"), "\\n")
cat("  Winsorize:", parameters$winsorize, "%\\n")
`;
}

/**
 * Generates the results display section
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function generateResultsDisplaySection(_results: ModelResults): string {
  // Note: arCI and eggerBootCI could be used for validation in the future
  // const arCI =
  //   results.andersonRubinCI !== "NA"
  //     ? `c(${results.andersonRubinCI[0].toFixed(6)}, ${results.andersonRubinCI[1].toFixed(6)})`
  //     : '"NA"';
  //
  // const eggerBootCI =
  //   results.publicationBias.eggerBootCI !== "NA"
  //     ? `c(${results.publicationBias.eggerBootCI[0].toFixed(6)}, ${results.publicationBias.eggerBootCI[1].toFixed(6)})`
  //     : '"NA"';

  return `
# ============================================================
# 6. DISPLAY RESULTS
# ============================================================

cat("\\n========================================\\n")
cat("MAIVE ANALYSIS RESULTS\\n")
cat("========================================\\n\\n")

cat("=== EFFECT ESTIMATE ===\\n")
cat("Estimate:         ", sprintf("%.6f", results$effectEstimate), "\\n")
cat("Standard Error:   ", sprintf("%.6f", results$standardError), "\\n")
cat("Significant:      ", results$isSignificant, "\\n")
if (!identical(results$andersonRubinCI, "NA") && !is.null(results$andersonRubinCI)) {
  cat("Anderson-Rubin CI:", sprintf("[%.6f, %.6f]", results$andersonRubinCI[1], results$andersonRubinCI[2]), "\\n")
}

cat("\\n=== PUBLICATION BIAS ===\\n")
cat("Egger Coefficient:", sprintf("%.6f", results$publicationBias$eggerCoef), "\\n")
cat("Egger SE:         ", sprintf("%.6f", results$publicationBias$eggerSE), "\\n")
cat("P-value:          ", sprintf("%.6f", results$publicationBias$pValue), "\\n")
cat("Significant:      ", results$publicationBias$isSignificant, "\\n")
if (!identical(results$publicationBias$eggerBootCI, "NA") && !is.null(results$publicationBias$eggerBootCI)) {
  cat("Bootstrap CI:     ", sprintf("[%.6f, %.6f]", results$publicationBias$eggerBootCI[1], results$publicationBias$eggerBootCI[2]), "\\n")
}

cat("\\n=== MODEL DIAGNOSTICS ===\\n")
if (!identical(results$firstStageFTest, "NA") && !is.null(results$firstStageFTest)) {
  cat("First-Stage F-test:", sprintf("%.6f", results$firstStageFTest), "\\n")
}
cat("Hausman Statistic: ", sprintf("%.6f", results$hausmanTest$statistic), "\\n")
cat("Chi-Squared CV:    ", sprintf("%.6f", results$hausmanTest$criticalValue), "\\n")
cat("Rejects Null:      ", results$hausmanTest$rejectsNull, "\\n")

# Compare with expected results
cat("\\n=== VERIFICATION ===\\n")
cat("Comparing with expected results from web application...\\n")

expected <- jsonlite::fromJSON("expected_results.json")
tolerance <- 1e-8

effect_match <- abs(results$effectEstimate - expected$effectEstimate) < tolerance
se_match <- abs(results$standardError - expected$standardError) < tolerance
egger_match <- abs(results$publicationBias$eggerCoef - expected$publicationBias$eggerCoef) < tolerance

cat("Effect Estimate Match:  ", ifelse(effect_match, "✓ PASS", "✗ FAIL"), "\\n")
cat("Standard Error Match:   ", ifelse(se_match, "✓ PASS", "✗ FAIL"), "\\n")
cat("Egger Coefficient Match:", ifelse(egger_match, "✓ PASS", "✗ FAIL"), "\\n")

if (effect_match && se_match && egger_match) {
  cat("\\n✓ All key results match! Reproducibility confirmed.\\n")
} else {
  cat("\\n⚠ Some results differ. This may be due to:\\n")
  cat("  - Different R version\\n")
  cat("  - Different MAIVE package version\\n")
  cat("  - Different random seed (for bootstrap methods)\\n")
  cat("  - Floating-point arithmetic differences\\n")
}
`;
}

/**
 * Generates the complete wrapper R script
 */
export function generateWrapperScript(
  versionInfo: VersionInfo,
  parameters: ModelParameters,
  results: ModelResults,
  numRows: number,
  winsorizeInfo?: WinsorizeInfo,
): string {
  const timestamp = new Date().toISOString();

  return `#!/usr/bin/env Rscript
#
# ============================================================
# MAIVE Analysis Reproducibility Script
# ============================================================
#
# Generated by:    MAIVE UI v${versionInfo.uiVersion}
# Analysis Date:   ${timestamp}
# MAIVE Package:   ${versionInfo.maiveTag}
# Git Commit:      ${versionInfo.gitCommitHash}
# R Version:       ${versionInfo.rVersion}
#
# This script reproduces the exact analysis performed in the
# MAIVE web application (${CONST.LINKS.MAIVE.WEBSITE}).
#
# For more information about MAIVE, see:
# - Paper: ${CONST.LINKS.MAIVE.PAPER}
# - GitHub: ${CONST.LINKS.APP_GITHUB.HOMEPAGE}
# - Package: ${CONST.LINKS.MAIVE.GITHUB}
#
# ============================================================

cat("\\n")
cat("============================================================\\n")
cat("MAIVE Analysis Reproducibility Script\\n")
cat("============================================================\\n")
cat("UI Version:    ${versionInfo.uiVersion}\\n")
cat("MAIVE Package: ${versionInfo.maiveTag}\\n")
cat("R Version:     ${versionInfo.rVersion}\\n")
cat("Git Commit:    ${versionInfo.gitCommitHash}\\n")
cat("============================================================\\n\\n")

# ============================================================
# 1. ENVIRONMENT SETUP
# ============================================================

cat("Setting up R environment...\\n")

# Required R packages
required_packages <- c(
  "jsonlite",      # JSON parsing
  "base64enc",     # Base64 encoding/decoding
  "metafor",       # Meta-analysis functions
  "ragg",          # Graphics device for high-quality plots
  "systemfonts",   # Font support
  "textshaping"    # Text rendering
)

# Install missing packages
missing_packages <- required_packages[!(required_packages %in% installed.packages()[,"Package"])]
if (length(missing_packages) > 0) {
  cat("Installing missing packages:", paste(missing_packages, collapse = ", "), "\\n")
  install.packages(missing_packages, repos = "https://cloud.r-project.org/")
}

# Load packages
for (pkg in required_packages) {
  suppressPackageStartupMessages(library(pkg, character.only = TRUE))
}

# Install MAIVE package from GitHub
cat("\\nInstalling MAIVE package (version ${versionInfo.maiveTag})...\\n")
if (!requireNamespace("remotes", quietly = TRUE)) {
  install.packages("remotes", repos = "https://cloud.r-project.org/")
}

# Install specific version of MAIVE
remotes::install_github("${CONST.GITHUB.OWNER}/${CONST.GITHUB.REPO_PACKAGE}@${versionInfo.maiveTag}", quiet = TRUE, upgrade = "never")
library(MAIVE)

cat("✓ Environment setup complete\\n")

# ============================================================
# 2. LOAD HELPER FUNCTIONS
# ============================================================

cat("\\nLoading helper functions from R source files...\\n")

# Source the MAIVE model implementation (fetched from GitHub)
if (!file.exists("maive_model.R")) {
  stop("ERROR: maive_model.R not found. Ensure all files from the ZIP are in the working directory.")
}
source("maive_model.R")
cat("✓ Loaded maive_model.R\\n")

# Source the funnel plot generation code
if (!file.exists("funnel_plot.R")) {
  stop("ERROR: funnel_plot.R not found. Ensure all files from the ZIP are in the working directory.")
}
source("funnel_plot.R")
cat("✓ Loaded funnel_plot.R\\n")

# ============================================================
# 3. LOAD DATA
# ============================================================

cat("\\nLoading data from data.csv...\\n")

if (!file.exists("data.csv")) {
  stop("ERROR: data.csv not found. Ensure all files from the ZIP are in the working directory.")
}

data <- read.csv("data.csv", stringsAsFactors = FALSE)
cat("✓ Loaded", nrow(data), "observations with", ncol(data), "columns\\n")

# Verify data structure
expected_rows <- ${numRows}
if (nrow(data) != expected_rows) {
  warning("Expected ", expected_rows, " rows but loaded ", nrow(data), " rows")
}

${generateWinsorizeSection(winsorizeInfo)}
# ============================================================
# 4. CONFIGURE PARAMETERS
# ============================================================

cat("\\nConfiguring analysis parameters...\\n")
${generateParametersSection(parameters)}

# ============================================================
# 5. RUN ANALYSIS
# ============================================================

cat("\\n========================================\\n")
cat("Running MAIVE analysis...\\n")
cat("========================================\\n\\n")

# Run the analysis using the same function as the web backend
# Note: run_maive_model expects JSON strings (designed for Lambda/Plumber backend)
results <- run_maive_model(
  jsonlite::toJSON(data, dataframe = "rows"),
  jsonlite::toJSON(parameters, auto_unbox = TRUE)
)

cat("✓ Analysis complete\\n")
${generateResultsDisplaySection(results)}

cat("\\n=== FUNNEL PLOT ===\\n")
if (results$funnelPlot != "") {
  # Decode base64 image
  img_data <- sub("^data:image/png;base64,", "", results$funnelPlot)
  png_binary <- base64enc::base64decode(img_data)

  # Save as PNG file
  funnel_plot_path <- "funnel_plot.png"
  writeBin(png_binary, funnel_plot_path)
  cat("✓ Funnel plot saved as:", funnel_plot_path, "\\n")
  cat("  Dimensions:", results$funnelPlotWidth, "x", results$funnelPlotHeight, "pixels\\n")
} else {
  cat("⚠ No funnel plot data available\\n")
}

# ============================================================
# 7. SAVE FULL RESULTS
# ============================================================

cat("\\n=== SAVING RESULTS ===\\n")

# Save as R object
rds_path <- "maive_results.rds"
saveRDS(results, rds_path)
cat("✓ R object saved as:", rds_path, "\\n")

# Save as JSON
json_path <- "maive_results.json"
write(jsonlite::toJSON(results, auto_unbox = TRUE, pretty = TRUE), json_path)
cat("✓ JSON saved as:", json_path, "\\n")

# ============================================================
# 8. SUMMARY
# ============================================================

cat("\\n========================================\\n")
cat("ANALYSIS COMPLETE\\n")
cat("========================================\\n\\n")

cat("Generated files:\\n")
cat("  ✓ funnel_plot.png      - Funnel plot visualization\\n")
cat("  ✓ maive_results.rds    - R object (load with readRDS())\\n")
cat("  ✓ maive_results.json   - JSON format (for other tools)\\n")

cat("\\nTo load results in another R session:\\n")
cat("  results <- readRDS('maive_results.rds')\\n")

cat("\\nFor support and questions:\\n")
cat("  GitHub: ${CONST.LINKS.APP_GITHUB.ISSUES}\\n")
cat("  Docs:   ${CONST.LINKS.MAIVE.WEBSITE}\\n")

cat("\\n")
`;
}
