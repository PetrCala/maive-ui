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
import type {
  ModelParameters,
  ModelResults,
  RTMAResults,
} from "@src/types/api";
import type { VersionInfo, WinsorizeInfo } from "@src/types/reproducibility";
import { describeGitRef } from "./readme";

/**
 * Seed written into an RTMA script when the run itself carries none.
 *
 * Mirrors RTMA_DEFAULT_SEED in apps/lambda-r-backend/r_scripts/rtma_model.R.
 * Only reached for runs stored before the backend pinned a seed (#479); those
 * numbers cannot be reproduced by any seed, so the script says so rather than
 * pretending this one recreates them.
 */
const RTMA_FALLBACK_SEED = 2025;

/**
 * Model types the generator can write a runnable script for.
 *
 * RDT has no export path in v1 (#559): run_maive_model() only knows the
 * MAIVE family, rdt_model.R is not bundled, and the download button is hidden
 * for RDT runs. Without this list the generator would happily emit a MAIVE
 * script with modelType = "RDT" for whoever turns that button on (#576).
 */
const SCRIPT_MODEL_TYPES: readonly string[] = [
  CONST.MODEL_TYPES.MAIVE,
  CONST.MODEL_TYPES.WAIVE,
  CONST.MODEL_TYPES.WLS,
  CONST.MODEL_TYPES.RTMA,
];

/**
 * Parameters each script interpolates into R source. A missing one used to be
 * written out as the literal string `undefined` (`weight = "undefined"`), which
 * R only rejects once the user runs the script (#576).
 */
const RTMA_SCRIPT_PARAMETERS: ReadonlyArray<keyof ModelParameters> = [
  "favorPositive",
  "winsorize",
];

const MAIVE_SCRIPT_PARAMETERS: ReadonlyArray<keyof ModelParameters> = [
  "includeStudyDummies",
  "includeStudyClustering",
  "standardErrorTreatment",
  "computeAndersonRubin",
  "maiveMethod",
  "weight",
  "shouldUseInstrumenting",
  "useLogFirstStage",
  "winsorize",
];

/**
 * Refuses to generate a script that could not run: an unsupported model type,
 * or a parameter the script would have to interpolate but does not have.
 *
 * @throws Error naming the model type or the missing parameters
 */
export function assertScriptParameters(parameters: ModelParameters): void {
  const modelType: unknown = parameters?.modelType;
  if (
    typeof modelType !== "string" ||
    !SCRIPT_MODEL_TYPES.includes(modelType)
  ) {
    throw new Error(
      `Cannot generate a reproducibility script for model type "${String(modelType)}". ` +
        `Supported model types: ${SCRIPT_MODEL_TYPES.join(", ")}.`,
    );
  }

  const required =
    modelType === CONST.MODEL_TYPES.RTMA
      ? RTMA_SCRIPT_PARAMETERS
      : MAIVE_SCRIPT_PARAMETERS;
  const missing = required.filter((key) => {
    const value: unknown = parameters[key];
    return value === undefined || value === null;
  });

  if (missing.length > 0) {
    throw new Error(
      `Cannot generate a reproducibility script for a ${modelType} run: ` +
        `${missing.length === 1 ? "parameter" : "parameters"} ${missing
          .map((key) => `"${key}"`)
          .join(", ")} missing. The generated script would not run.`,
    );
  }
}

/**
 * Reads the seed the RTMA sampler actually ran under, if the run recorded one.
 *
 * RTMA results travel through the export path typed as ModelResults (the two
 * shapes share the same slot), so the seed has to be read off the RTMA view.
 */
export function getRtmaSeed(results: ModelResults): number | null {
  const seed = (results as unknown as RTMAResults).seed;
  return typeof seed === "number" && Number.isFinite(seed) ? seed : null;
}

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
 *
 * @param rtmaSeed - Seed to pin the RTMA sampler to (RTMA runs only)
 */
function generateParametersSection(
  parameters: ModelParameters,
  rtmaSeed?: number,
): string {
  if (parameters.modelType === "RTMA") {
    return `
# RTMA analysis parameters (exactly as configured in the web application)
parameters <- list(
  modelType = "RTMA",
  favorPositive = ${parameters.favorPositive ? "TRUE" : "FALSE"},
  alphaSelect = 0.05,
  ciLevel = 0.95,
  winsorize = ${parameters.winsorize},
  # RNG seed the sampler runs under. phacking::phacking_meta() takes no seed
  # argument, so run_rtma_model() calls set.seed() with this value immediately
  # before fitting. The credible intervals are posterior quantiles and move
  # between runs without it, so this is what makes the numbers below
  # reproducible.
  seed = ${rtmaSeed ?? RTMA_FALLBACK_SEED}
)

cat("\\nAnalysis Configuration:\\n")
cat("  Model Type:", parameters$modelType, "\\n")
cat("  Favor Positive:", ifelse(parameters$favorPositive, "Yes", "No"), "\\n")
cat("  Alpha Select:", parameters$alphaSelect, "\\n")
cat("  CI Level:", parameters$ciLevel, "\\n")
cat("  Winsorize:", parameters$winsorize, "%\\n")
cat("  Seed:", parameters$seed, "\\n")
`;
  }

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
 * A single number the generated script checks against expected_results.json
 */
type VerificationField = {
  /** R variable that receives the outcome of the comparison */
  variable: string;
  /** Label printed in the PASS/FAIL list; " Match:" is appended */
  label: string;
  /** R expression for the value the local re-run produced */
  actual: string;
  /** R expression for the recorded value, rooted at `expected` */
  expected: string;
};

/**
 * Generates the block that compares a local re-run against the numbers the web
 * application reported.
 *
 * Shared by the MAIVE and RTMA scripts because the comparison itself is the
 * same everywhere: compare at full precision, fall back to the 4-decimal
 * precision older API responses carried, skip fields the stored run predates,
 * print PASS/FAIL. Only the field list and the
 * plausible causes of a mismatch differ, so those are the arguments. RTMA
 * previously shipped expected_results.json without ever reading it (#489).
 *
 * @param fields - Values to compare, in the order they should be printed
 * @param mismatchCauses - Explanations listed when a comparison fails
 */
function generateVerificationSection(
  fields: VerificationField[],
  mismatchCauses: string[],
): string {
  const labelWidth = Math.max(
    ...fields.map((field) => `${field.label} Match:`.length),
  );

  const comparisons = fields
    .map(
      (field) =>
        `${field.variable} <- if (recorded(${field.expected})) matches(${field.actual}, ${field.expected}) else NA`,
    )
    .join("\n");

  const report = fields
    .map(
      (field) =>
        `cat("${`${field.label} Match:`.padEnd(labelWidth)}", verdict(${field.variable}), "\\n")`,
    )
    .join("\n");

  const causes = mismatchCauses
    .map((cause) => `  cat("  - ${cause}\\n")`)
    .join("\n");

  return `
# Compare with expected results
cat("\\n=== VERIFICATION ===\\n")
cat("Comparing with expected results from web application...\\n")

expected <- jsonlite::fromJSON("expected_results.json")
tolerance <- 1e-8

# expected_results.json was captured from the web app's JSON API response.
# The backend now serializes at full double precision (digits = NA), but runs
# stored before that change carry values rounded to 4 decimal places
# (jsonlite::toJSON default digits = 4). Accept either: an exact match at full
# precision, or a match once this script's local re-run is rounded the same way.
#
# Fields the original run predates are absent from the file; those are reported
# as unrecorded instead of counting as a mismatch.
recorded <- function(value) !is.null(value) && length(value) == 1 && is.finite(value)
matches <- function(actual, expected) {
  abs(actual - expected) < tolerance || abs(round(actual, 4) - expected) < tolerance
}
verdict <- function(match) {
  if (is.na(match)) "- not recorded" else if (match) "\\u2713 PASS" else "\\u2717 FAIL"
}

${comparisons}

${report}

checks <- c(${fields.map((field) => field.variable).join(", ")})
if (all(is.na(checks))) {
  cat("\\n\\u26a0 expected_results.json records none of these fields; nothing to verify.\\n")
} else if (all(checks[!is.na(checks)])) {
  cat("\\n\\u2713 All key results match! Reproducibility confirmed.\\n")
  if (any(is.na(checks))) {
    cat("  (fields shown as not recorded were absent from expected_results.json)\\n")
  }
} else {
  cat("\\n\\u26a0 Some results differ. This may be due to:\\n")
${causes}
  cat("  The R and package versions this re-run actually used are recorded in\\n")
  cat("  session_info.txt, next to the results; compare them with the versions above.\\n")
}
`;
}

/**
 * Generates the block that records the session the re-run happened in
 *
 * The mismatch hints name the versions the web application ran under, but
 * until now nothing recorded which R, MAIVE, clubSandwich or phacking the local
 * re-run actually used, so a failed comparison was a dead end (#576).
 * sessionInfo() is captured right after the model runs, so every package the
 * fit touched is loaded by then, and it is written before the verification
 * step so it exists even if that step fails.
 *
 * @param recordedVersions - "package version" pairs the original run reports
 */
function generateSessionInfoSection(
  versionInfo: VersionInfo,
  recordedVersions: string[],
): string {
  const recorded = [`R ${versionInfo.rVersion}`, ...recordedVersions].join(
    ", ",
  );

  // The confirmation line carries the literal glyph rather than a \u2713
  // escape: R renders the escape as "<U+2713>" in a C locale, which is what
  // a bare Rscript on a fresh machine gets.
  return `
# Record the session this re-run happened in, next to the results. When the
# verification below fails, this is what tells you which R and which package
# versions produced the local numbers, so the mismatch can be traced instead of
# guessed at.
session_info_path <- "session_info.txt"
writeLines(
  c(
    paste("Local re-run recorded:", format(Sys.time(), "%Y-%m-%d %H:%M:%S %Z")),
    "Web application ran under: ${recorded}",
    "",
    capture.output(sessionInfo())
  ),
  session_info_path
)
cat("✓ Session info saved as:", session_info_path, "\\n")
`;
}

/**
 * Generates the RTMA verification block
 *
 * Compares the fields the RTMA response carries. The credible interval bounds
 * are checked individually because they are what the sampler seed moves, so a
 * matching mode with a drifting interval has to be visible.
 */
function generateRtmaVerificationSection(phackingVersion: string): string {
  return generateVerificationSection(
    [
      {
        variable: "mu_match",
        label: "mu (mode)",
        actual: "results$mu",
        expected: "expected$mu",
      },
      {
        variable: "mu_median_match",
        label: "mu (median)",
        actual: "results$muMedian",
        expected: "expected$muMedian",
      },
      {
        variable: "mu_ci_lower_match",
        label: "mu CI lower",
        actual: "results$muCI[1]",
        expected: "expected$muCI[1]",
      },
      {
        variable: "mu_ci_upper_match",
        label: "mu CI upper",
        actual: "results$muCI[2]",
        expected: "expected$muCI[2]",
      },
      {
        variable: "tau_match",
        label: "tau (mode)",
        actual: "results$tau",
        expected: "expected$tau",
      },
      {
        variable: "tau_median_match",
        label: "tau (median)",
        actual: "results$tauMedian",
        expected: "expected$tauMedian",
      },
      {
        variable: "tau_ci_lower_match",
        label: "tau CI lower",
        actual: "results$tauCI[1]",
        expected: "expected$tauCI[1]",
      },
      {
        variable: "tau_ci_upper_match",
        label: "tau CI upper",
        actual: "results$tauCI[2]",
        expected: "expected$tauCI[2]",
      },
      {
        variable: "unadjusted_mean_match",
        label: "Unadjusted FE mean",
        actual: "results$unadjustedMean",
        expected: "expected$unadjustedMean",
      },
      {
        variable: "k_match",
        label: "Estimates used (k)",
        actual: "results$k",
        expected: "expected$k",
      },
      {
        variable: "affirmative_match",
        label: "Affirmative count",
        actual: "results$affirmativeCount",
        expected: "expected$affirmativeCount",
      },
    ],
    [
      `A different phacking version (this run: ${phackingVersion})`,
      "A different sampler seed, reported above",
      "A different R version or Stan toolchain",
      "Floating-point arithmetic differences",
    ],
  );
}

/**
 * Generates the results display section
 *
 * @param versionInfo - Versions the original run reports, named in the
 *   mismatch hints so they can be compared with session_info.txt
 */
function generateResultsDisplaySection(versionInfo: VersionInfo): string {
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

# Some numbers come back as the string "NA" when they are undefined (a WLS or
# WAIVE Hausman statistic, an Egger p-value with a zero standard error), so
# print through a helper rather than sprintf("%.6f", ...), which errors on a
# character value.
fmt_num <- function(x) {
  if (is.null(x) || length(x) != 1 || !is.numeric(x) || !is.finite(x)) "NA" else sprintf("%.6f", x)
}

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
cat("P-value:          ", fmt_num(results$publicationBias$pValue), "\\n")
cat("Significant:      ", results$publicationBias$isSignificant, "\\n")
if (!identical(results$publicationBias$eggerBootCI, "NA") && !is.null(results$publicationBias$eggerBootCI)) {
  cat("Bootstrap CI:     ", sprintf("[%.6f, %.6f]", results$publicationBias$eggerBootCI[1], results$publicationBias$eggerBootCI[2]), "\\n")
}

cat("\\n=== MODEL DIAGNOSTICS ===\\n")
if (!identical(results$firstStageFStatistic, "NA") && !is.null(results$firstStageFStatistic)) {
  cat("First-Stage F-statistic:", sprintf("%.6f", results$firstStageFStatistic), "\\n")
}
cat("Hausman Statistic: ", fmt_num(results$hausmanTest$statistic), "\\n")
cat("Chi-Squared CV:    ", sprintf("%.6f", results$hausmanTest$criticalValue), "\\n")
cat("Rejects Null:      ", results$hausmanTest$rejectsNull, "\\n")
${generateVerificationSection(
  [
    {
      variable: "effect_match",
      label: "Effect Estimate",
      actual: "results$effectEstimate",
      expected: "expected$effectEstimate",
    },
    {
      variable: "se_match",
      label: "Standard Error",
      actual: "results$standardError",
      expected: "expected$standardError",
    },
    {
      variable: "egger_match",
      label: "Egger Coefficient",
      actual: "results$publicationBias$eggerCoef",
      expected: "expected$publicationBias$eggerCoef",
    },
  ],
  [
    `A different MAIVE package version (this run: ${versionInfo.maiveTag})`,
    `A different clubSandwich version (this run: ${versionInfo.clubSandwichVersion})`,
    `A different R version (this run: ${versionInfo.rVersion})`,
    "A different random seed (for bootstrap methods)",
    "Floating-point arithmetic differences",
  ],
)}`;
}

/**
 * Generates the clubSandwich installation block for the MAIVE script
 *
 * MAIVE takes its cluster-robust covariance estimator from clubSandwich, so it
 * decides every standard error, confidence interval and p-value the script
 * prints. It used to arrive silently as a dependency of the MAIVE install, at
 * whatever version CRAN served that day (#576). Install the recorded version
 * instead, before MAIVE so that install finds it and leaves it alone, and say
 * so when the loaded one differs. Same shape as the phacking block above.
 * The output lines carry literal glyphs rather than \u escapes, which R
 * renders as "<U+2713>" in the C locale a bare Rscript usually runs under.
 *
 * @param clubSandwichVersion - Version the backend image ran under
 */
function generateClubSandwichInstallSection(
  clubSandwichVersion: string,
): string {
  // A backend that never reported its clubSandwich version leaves nothing to
  // pin to. An unpinned install still beats failing the script, as long as it
  // says out loud that the inference may not be the recorded one.
  if (!/^\d+(\.\d+)*$/.test(clubSandwichVersion)) {
    return `
# Install clubSandwich (cluster-robust covariance behind MAIVE inference)
cat("\\n⚠ This package does not record the clubSandwich version the analysis\\n")
cat("  ran under, so the current CRAN release is installed instead. Standard\\n")
cat("  errors and confidence intervals may differ from the web application's.\\n")
if (!requireNamespace("clubSandwich", quietly = TRUE)) {
  install.packages("clubSandwich", repos = "https://cloud.r-project.org/")
}
library(clubSandwich)
`;
  }

  return `
# Install clubSandwich, pinned to the version the web application ran under.
# MAIVE takes its cluster-robust covariance estimator from clubSandwich, so it
# decides every standard error, confidence interval and p-value below; an
# unpinned install would quietly change the inference once CRAN moves on. It
# is installed before MAIVE so that install (upgrade = "never") keeps it.
clubsandwich_version <- "${clubSandwichVersion}"
clubsandwich_ready <- requireNamespace("clubSandwich", quietly = TRUE) &&
  identical(as.character(utils::packageVersion("clubSandwich")), clubsandwich_version)

if (!clubsandwich_ready) {
  cat("\\nInstalling clubSandwich", clubsandwich_version, "...\\n")
  if (!requireNamespace("remotes", quietly = TRUE)) {
    install.packages("remotes", repos = "https://cloud.r-project.org/")
  }
  # install_version() falls back to the CRAN archive once this version is no
  # longer the current release.
  remotes::install_version(
    "clubSandwich",
    version = clubsandwich_version,
    repos = "https://cloud.r-project.org/",
    upgrade = "never"
  )
}
library(clubSandwich)

clubsandwich_loaded <- as.character(utils::packageVersion("clubSandwich"))
if (identical(clubsandwich_loaded, clubsandwich_version)) {
  cat("✓ clubSandwich", clubsandwich_version, "loaded\\n")
} else {
  cat("⚠ clubSandwich", clubsandwich_loaded, "is loaded, but this analysis ran under",
      clubsandwich_version, "- standard errors may differ\\n")
}
`;
}

/**
 * Generates the phacking installation block for the RTMA script
 *
 * phacking is the RTMA implementation, so installing "whatever CRAN has today"
 * means a package regenerated later can silently refit under a different
 * method (#489). Install the recorded version instead, and say so when the
 * loaded one differs.
 *
 * @param phackingVersion - Version the backend image ran under
 */
function generatePhackingInstallSection(phackingVersion: string): string {
  // A backend that never reported its phacking version (or reported something
  // that is not a version) leaves nothing to pin to. Falling back to the
  // unpinned install is still better than failing the script, as long as it
  // says out loud that the RTMA implementation is not the recorded one.
  if (!/^\d+(\.\d+)*$/.test(phackingVersion)) {
    return `
# Install phacking package (RTMA)
cat("\\n\\u26a0 This package does not record the phacking version the analysis ran\\n")
cat("  under, so the current CRAN release is installed instead. The RTMA\\n")
cat("  implementation may differ from the one the web application used.\\n")
if (!requireNamespace("phacking", quietly = TRUE)) {
  install.packages("phacking", repos = "https://cloud.r-project.org/")
}
library(phacking)
`;
  }

  return `
# Install phacking package (RTMA), pinned to the version the web application
# ran under. phacking is the RTMA implementation itself, so an unpinned install
# would quietly change the method once CRAN moves on.
phacking_version <- "${phackingVersion}"
phacking_ready <- requireNamespace("phacking", quietly = TRUE) &&
  identical(as.character(utils::packageVersion("phacking")), phacking_version)

if (!phacking_ready) {
  cat("\\nInstalling phacking", phacking_version, "...\\n")
  if (!requireNamespace("remotes", quietly = TRUE)) {
    install.packages("remotes", repos = "https://cloud.r-project.org/")
  }
  # install_version() falls back to the CRAN archive once this version is no
  # longer the current release.
  remotes::install_version(
    "phacking",
    version = phacking_version,
    repos = "https://cloud.r-project.org/",
    upgrade = "never"
  )
}
library(phacking)

phacking_loaded <- as.character(utils::packageVersion("phacking"))
if (identical(phacking_loaded, phacking_version)) {
  cat("\\u2713 phacking", phacking_version, "loaded\\n")
} else {
  cat("\\u26a0 phacking", phacking_loaded, "is loaded, but this analysis ran under",
      phacking_version, "- results may differ\\n")
}
`;
}

/**
 * Generates RTMA-specific wrapper R script
 *
 * @param recordedSeed - Seed the original run reported, or null when the run
 *   predates seeded RTMA sampling and cannot be reproduced exactly
 */
function generateRtmaWrapperScript(
  versionInfo: VersionInfo,
  parameters: ModelParameters,
  numRows: number,
  recordedSeed: number | null,
  winsorizeInfo?: WinsorizeInfo,
): string {
  const timestamp = new Date().toISOString();
  const seed = recordedSeed ?? RTMA_FALLBACK_SEED;
  const seedHeaderNote =
    recordedSeed === null
      ? `# Seed:            ${seed} (default; the original run recorded no seed,
#                  so its credible intervals cannot be reproduced exactly)`
      : `# Seed:            ${seed}`;

  return `#!/usr/bin/env Rscript
#
# ============================================================
# RTMA (Right-Truncated Meta-Analysis) Reproducibility Script
# ============================================================
#
# Generated by:    MAIVE UI v${versionInfo.uiVersion}
# Analysis Date:   ${timestamp}
# Method:          RTMA (Mathur, 2024)
# Git Commit:      ${describeGitRef(versionInfo)}
# R Version:       ${versionInfo.rVersion}
# phacking:        ${versionInfo.phackingVersion} (the RTMA implementation)
${seedHeaderNote}
#
# This script reproduces the RTMA analysis performed in the
# MAIVE web application (${CONST.LINKS.MAIVE.WEBSITE}).
#
# ============================================================

cat("\\n")
cat("============================================================\\n")
cat("RTMA Analysis Reproducibility Script\\n")
cat("============================================================\\n")
cat("UI Version:    ${versionInfo.uiVersion}\\n")
cat("R Version:     ${versionInfo.rVersion}\\n")
cat("phacking:      ${versionInfo.phackingVersion}\\n")
cat("Git Commit:    ${describeGitRef(versionInfo)}\\n")
cat("============================================================\\n\\n")

# ============================================================
# 1. ENVIRONMENT SETUP
# ============================================================

cat("Setting up R environment...\\n")

# Required R packages
required_packages <- c(
  "jsonlite",      # JSON parsing
  "base64enc",     # Base64 encoding/decoding
  "ragg",          # Graphics device for high-quality plots
  "systemfonts",   # Font support
  "textshaping",   # Text rendering
  # maive_model.R attaches these two when it is sourced below (for the
  # winsorize_percent helper); neither enters the RTMA fit, which phacking
  # performs, so they are not pinned here. session_info.txt records the
  # versions that were loaded.
  "clubSandwich",  # Loaded by maive_model.R
  "metafor"        # Loaded by maive_model.R (also a phacking dependency)
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
${generatePhackingInstallSection(versionInfo.phackingVersion)}
cat("\\u2713 Environment setup complete\\n")

# ============================================================
# 2. LOAD HELPER FUNCTIONS
# ============================================================

cat("\\nLoading helper functions from R source files...\\n")

# Source the RTMA model implementation (fetched from GitHub)
if (!file.exists("rtma_model.R")) {
  stop("ERROR: rtma_model.R not found. Ensure all files from the ZIP are in the working directory.")
}
source("rtma_model.R")
cat("\\u2713 Loaded rtma_model.R\\n")

# Source maive_model.R (needed for winsorize_percent helper)
if (!file.exists("maive_model.R")) {
  stop("ERROR: maive_model.R not found. Ensure all files from the ZIP are in the working directory.")
}
source("maive_model.R")
cat("\\u2713 Loaded maive_model.R\\n")

# ============================================================
# 3. LOAD DATA
# ============================================================

cat("\\nLoading data from data.csv...\\n")

if (!file.exists("data.csv")) {
  stop("ERROR: data.csv not found. Ensure all files from the ZIP are in the working directory.")
}

data <- read.csv("data.csv", stringsAsFactors = FALSE)
cat("\\u2713 Loaded", nrow(data), "observations with", ncol(data), "columns\\n")

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
${generateParametersSection(parameters, seed)}

# ============================================================
# 5. RUN ANALYSIS
# ============================================================

cat("\\n========================================\\n")
cat("Running RTMA analysis...\\n")
cat("========================================\\n\\n")

# Seed here as well as in parameters$seed above. rtma_model.R is bundled from
# the backend commit this analysis ran on, and versions from before RTMA runs
# were seeded ignore parameters$seed entirely. Nothing between this line and
# phacking_meta() draws from the RNG, so the sampler starts from the same state
# either way, and the section below reports which path took effect.
set.seed(parameters$seed)

# Run the analysis using the same function as the web backend
# Note: run_rtma_model expects JSON strings (designed for Plumber backend)
#
# digits = NA keeps every value at full double precision. jsonlite::toJSON()
# otherwise writes 4 decimal places, which would round the standard errors
# before the model ever sees them and refit on different data than the web
# application did (#489). The backend serializes its own input the same way.
results <- run_rtma_model(
  jsonlite::toJSON(data, dataframe = "rows", digits = NA),
  jsonlite::toJSON(parameters, auto_unbox = TRUE, digits = NA)
)

cat("\\u2713 Analysis complete\\n")
${generateSessionInfoSection(versionInfo, [
  `phacking ${versionInfo.phackingVersion}`,
])}
# ============================================================
# 6. DISPLAY RESULTS
# ============================================================

cat("\\n========================================\\n")
cat("RTMA ANALYSIS RESULTS\\n")
cat("========================================\\n\\n")

cat("=== CORRECTED EFFECT ===\\n")
cat("mu (mode):   ", sprintf("%.6f", results$mu), "\\n")
cat("mu (median): ", sprintf("%.6f", results$muMedian), "\\n")
cat("mu CI:       ", sprintf("[%.6f, %.6f]", results$muCI[1], results$muCI[2]),
    sprintf("(equal-tailed, level %.2f)", results$ciLevel), "\\n")

cat("\\n=== UNADJUSTED COMPARISON ===\\n")
cat("FE mean:     ", sprintf("%.6f", results$unadjustedMean),
    "(inverse-variance pooled mean, no correction)\\n")

cat("\\n=== HETEROGENEITY ===\\n")
cat("tau (mode):  ", sprintf("%.6f", results$tau), "\\n")
cat("tau (median):", sprintf("%.6f", results$tauMedian), "\\n")
cat("tau CI:      ", sprintf("[%.6f, %.6f]", results$tauCI[1], results$tauCI[2]),
    sprintf("(equal-tailed, level %.2f)", results$ciLevel), "\\n")

cat("\\n=== REPRODUCIBILITY ===\\n")
cat("Seed requested:  ", parameters$seed, "\\n")
if (is.null(results$seed)) {
  cat("\\u26a0 The bundled rtma_model.R reports no seed, so it predates seeded RTMA runs.\\n")
  cat("  The set.seed() call above still pins this run, but repeat it to confirm.\\n")
} else if (!isTRUE(all.equal(as.numeric(results$seed), as.numeric(parameters$seed)))) {
  cat("\\u26a0 The fit ran under seed", results$seed, "instead of", parameters$seed, "\\n")
} else {
  cat("\\u2713 The fit ran under the requested seed\\n")
}${
    recordedSeed === null
      ? `
cat("\\u26a0 The original web-app run recorded no seed, so its credible intervals\\n")
cat("  cannot be reproduced exactly. This run is pinned and repeatable from here on.\\n")`
      : ""
  }

cat("\\n=== ESTIMATES ===\\n")
cat("Used (k):        ", results$k, "\\n")
cat("Affirmative:     ", results$affirmativeCount, "\\n")
cat("Not affirmative: ", results$nonaffirmativeCount,
    sprintf("(%.1f%%)", results$nonaffirmativeProportion * 100), "\\n")
cat("Dropped rows:    ", results$droppedRows, "\\n")
${generateRtmaVerificationSection(versionInfo.phackingVersion)}
cat("\\n=== Z-SCORE DENSITY PLOT ===\\n")
if (!is.null(results$zScorePlot) && results$zScorePlot != "") {
  # Decode base64 image
  img_data <- sub("^data:image/png;base64,", "", results$zScorePlot)
  png_binary <- base64enc::base64decode(img_data)

  # Save as PNG file
  plot_path <- "z_score_plot.png"
  writeBin(png_binary, plot_path)
  cat("\\u2713 Z-score plot saved as:", plot_path, "\\n")
  cat("  Dimensions:", results$zScorePlotWidth, "x", results$zScorePlotHeight, "pixels\\n")
} else {
  cat("\\u26a0 No z-score plot data available\\n")
}

# ============================================================
# 7. SAVE FULL RESULTS
# ============================================================

cat("\\n=== SAVING RESULTS ===\\n")

# Save as R object
rds_path <- "rtma_results.rds"
saveRDS(results, rds_path)
cat("\\u2713 R object saved as:", rds_path, "\\n")

# Save as JSON
json_path <- "rtma_results.json"
write(jsonlite::toJSON(results, auto_unbox = TRUE, pretty = TRUE), json_path)
cat("\\u2713 JSON saved as:", json_path, "\\n")

# ============================================================
# 8. SUMMARY
# ============================================================

cat("\\n========================================\\n")
cat("ANALYSIS COMPLETE\\n")
cat("========================================\\n\\n")

cat("Generated files:\\n")
cat("  \\u2713 z_score_plot.png       - Z-score density plot\\n")
cat("  \\u2713 rtma_results.rds       - R object (load with readRDS())\\n")
cat("  \\u2713 rtma_results.json      - JSON format (for other tools)\\n")
cat("  \\u2713 session_info.txt       - R and package versions this run used\\n")

cat("\\nTo load results in another R session:\\n")
cat("  results <- readRDS('rtma_results.rds')\\n")

cat("\\nFor support and questions:\\n")
cat("  GitHub: ${CONST.LINKS.APP_GITHUB.ISSUES}\\n")
cat("  Docs:   ${CONST.LINKS.MAIVE.WEBSITE}\\n")

cat("\\n")
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
  assertScriptParameters(parameters);

  if (parameters.modelType === "RTMA") {
    return generateRtmaWrapperScript(
      versionInfo,
      parameters,
      numRows,
      getRtmaSeed(results),
      winsorizeInfo,
    );
  }

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
# clubSandwich:    ${versionInfo.clubSandwichVersion} (cluster-robust covariance behind MAIVE inference)
# Git Commit:      ${describeGitRef(versionInfo)}
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
cat("clubSandwich:  ${versionInfo.clubSandwichVersion}\\n")
cat("R Version:     ${versionInfo.rVersion}\\n")
cat("Git Commit:    ${describeGitRef(versionInfo)}\\n")
cat("============================================================\\n\\n")

# ============================================================
# 1. ENVIRONMENT SETUP
# ============================================================

cat("Setting up R environment...\\n")
${generateClubSandwichInstallSection(versionInfo.clubSandwichVersion)}
# Required R packages
required_packages <- c(
  "jsonlite",      # JSON parsing
  "base64enc",     # Base64 encoding/decoding
  "clubSandwich",  # Cluster-robust covariance for MAIVE inference (pinned above)
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
#
# digits = NA keeps every value at full double precision. jsonlite::toJSON()
# otherwise writes 4 decimal places, which would round the standard errors
# before the model ever sees them and refit on different data than the web
# application did (#489). The backend serializes its own input the same way.
results <- run_maive_model(
  jsonlite::toJSON(data, dataframe = "rows", digits = NA),
  jsonlite::toJSON(parameters, auto_unbox = TRUE, digits = NA)
)

cat("✓ Analysis complete\\n")
${generateSessionInfoSection(versionInfo, [
  `MAIVE ${versionInfo.maiveTag}`,
  `clubSandwich ${versionInfo.clubSandwichVersion}`,
])}${generateResultsDisplaySection(versionInfo)}

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
cat("  ✓ session_info.txt     - R and package versions this run used\\n")

cat("\\nTo load results in another R session:\\n")
cat("  results <- readRDS('maive_results.rds')\\n")

cat("\\nFor support and questions:\\n")
cat("  GitHub: ${CONST.LINKS.APP_GITHUB.ISSUES}\\n")
cat("  Docs:   ${CONST.LINKS.MAIVE.WEBSITE}\\n")

cat("\\n")
`;
}
