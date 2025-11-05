/**
 * Generates README documentation for reproducibility packages
 */

import type { ModelParameters } from "@src/types/api";
import type { VersionInfo } from "@src/types/reproducibility";

/**
 * Converts model parameters to a readable markdown table
 */
function generateParameterTable(parameters: ModelParameters): string {
  const rows = [
    ["Model Type", parameters.modelType],
    ["MAIVE Method", parameters.maiveMethod],
    ["Weight Scheme", parameters.weight.replace(/_/g, " ")],
    ["Use Instrumenting", parameters.shouldUseInstrumenting ? "Yes" : "No"],
    ["Include Study Dummies", parameters.includeStudyDummies ? "Yes" : "No"],
    [
      "Include Study Clustering",
      parameters.includeStudyClustering ? "Yes" : "No",
    ],
    [
      "Standard Error Treatment",
      parameters.standardErrorTreatment.replace(/_/g, " "),
    ],
    ["Compute Anderson-Rubin", parameters.computeAndersonRubin ? "Yes" : "No"],
    ["Use Log First Stage", parameters.useLogFirstStage ? "Yes" : "No"],
    ["Winsorize Percentage", `${parameters.winsorize}%`],
  ];

  const table = [
    "| Parameter | Value |",
    "|-----------|-------|",
    ...rows.map(([param, value]) => `| ${param} | ${value} |`),
  ].join("\n");

  return table;
}

/**
 * Generates the complete README.md content
 */
export function generateReadme(
  versionInfo: VersionInfo,
  parameters: ModelParameters,
  numRows: number,
): string {
  const timestamp = new Date(versionInfo.timestamp).toLocaleString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });

  const parameterTable = generateParameterTable(parameters);

  return `# MAIVE Analysis Reproducibility Package

This package contains everything needed to reproduce the MAIVE meta-analysis performed on **${timestamp}**.

## Package Information

- **MAIVE UI Version:** ${versionInfo.uiVersion}
- **MAIVE R Package:** ${versionInfo.maiveTag}
- **R Version Used:** ${versionInfo.rVersion}
- **Git Commit:** ${versionInfo.gitCommitHash}
- **Dataset Size:** ${numRows} observations

## What is MAIVE?

MAIVE (Meta-Analysis for Identifying Variability and Errors) is a statistical tool for detecting spurious precision in meta-analysis data. It helps identify potential data quality issues that may affect the validity of meta-analytic findings.

**Learn more:**
- **Paper:** [Nature Communications](https://doi.org/10.1038/s41467-025-63261-0)
- **Website:** [meta-analysis.cz/maive](https://meta-analysis.cz/maive/)
- **GitHub:** [PetrCala/maive-ui](https://github.com/PetrCala/maive-ui)

## Prerequisites

To run this reproducibility package, you need:

1. **R** (version 4.4.1 or higher recommended)
   - Download from [r-project.org](https://www.r-project.org/)
   - Or use RStudio for a more user-friendly experience

2. **Internet connection** (for first-time package installation)
   - Required to install MAIVE package from GitHub
   - After first run, analysis can be performed offline

## Quick Start

### Option 1: Run from Command Line

\`\`\`bash
# Navigate to the extracted directory
cd path/to/extracted/folder

# Run the analysis script
Rscript run_analysis.R
\`\`\`

### Option 2: Run from RStudio

1. Open RStudio
2. Set working directory: \`Session > Set Working Directory > Choose Directory...\`
3. Navigate to the extracted folder
4. Open \`run_analysis.R\`
5. Click "Source" or press Ctrl+Shift+S (Cmd+Shift+S on Mac)

### Option 3: Run from R Console

\`\`\`r
# Set working directory to the extracted folder
setwd("path/to/extracted/folder")

# Source the analysis script
source("run_analysis.R")
\`\`\`

## What the Script Does

The \`run_analysis.R\` script will automatically:

1. ✓ Install required R packages (if not already installed)
2. ✓ Install the exact MAIVE package version (${versionInfo.maiveTag})
3. ✓ Load helper functions from the R backend code
4. ✓ Load your data from \`data.csv\`
5. ✓ Configure analysis parameters (exactly as in the web app)
6. ✓ Run the MAIVE analysis
7. ✓ Compare results with expected values
8. ✓ Generate and save the funnel plot
9. ✓ Save results in multiple formats

**First run may take a few minutes** while R installs the required packages. Subsequent runs will be much faster.

## Package Contents

| File | Description |
|------|-------------|
| \`run_analysis.R\` | Main script that orchestrates the entire analysis |
| \`maive_model.R\` | Core MAIVE model implementation (from web app backend) |
| \`funnel_plot.R\` | Funnel plot generation code (from web app backend) |
| \`data.csv\` | Your uploaded data (${numRows} rows) |
| \`parameters.json\` | Complete analysis configuration |
| \`expected_results.json\` | Results from web app for comparison |
| \`version-manifest.txt\` | Version details and package information |
| \`README.md\` | This file |

## Analysis Parameters

The analysis was configured with the following parameters:

${parameterTable}

## Output Files

After running \`run_analysis.R\`, you will find these new files:

| File | Format | Description |
|------|--------|-------------|
| \`funnel_plot.png\` | PNG image | Funnel plot visualization |
| \`maive_results.rds\` | R object | Complete results (load with \`readRDS()\`) |
| \`maive_results.json\` | JSON | Results in JSON format (for use with other tools) |

## Verifying Results

The script automatically compares computed results with the web application output.

**Expected output:**
\`\`\`
=== VERIFICATION ===
Comparing with expected results from web application...
Effect Estimate Match:   ✓ PASS
Standard Error Match:    ✓ PASS
Egger Coefficient Match: ✓ PASS

✓ All key results match! Reproducibility confirmed.
\`\`\`

**Small numerical differences** (< 1e-8) are normal due to:
- Floating-point arithmetic precision
- Different R versions
- Different BLAS/LAPACK implementations

**Larger differences** may indicate:
- Different MAIVE package version
- Different random seed (for bootstrap methods)
- Missing or incompatible dependencies

## Using the Results in Your Own Scripts

### Load Results

\`\`\`r
# Load the complete results object
results <- readRDS("maive_results.rds")

# Access specific values
effect_estimate <- results$effectEstimate
standard_error <- results$standardError
egger_coef <- results$publicationBias$eggerCoef

# View results structure
str(results)
\`\`\`

### Create Custom Visualizations

\`\`\`r
# The funnel plot is saved as PNG, but you can regenerate it
# Load the plotting functions
source("funnel_plot.R")

# Customize and regenerate
# (see funnel_plot.R for available parameters)
\`\`\`

## Troubleshooting

### Installation Issues

**Problem:** Package installation fails

**Solutions:**
- Ensure you have a stable internet connection
- Try installing packages manually:
  \`\`\`r
  install.packages("remotes")
  remotes::install_github("PetrCala/MAIVE@${versionInfo.maiveTag}")
  \`\`\`
- Check R version: \`R.version.string\`
- Update R if using version < 4.0

### GitHub Rate Limits

**Problem:** "API rate limit exceeded" when installing MAIVE package

**Solution:**
- Wait an hour and try again (GitHub API has hourly limits)
- Or authenticate with GitHub:
  \`\`\`r
  # Create a GitHub token at: https://github.com/settings/tokens
  Sys.setenv(GITHUB_PAT = "your_token_here")
  \`\`\`

### Results Don't Match

**Problem:** Verification shows "✗ FAIL" for some results

**Possible causes:**
1. Different MAIVE package version
   - Check installed version: \`packageVersion("MAIVE")\`
   - Should be: ${versionInfo.maiveTag}

2. Different R version
   - Check R version: \`R.version.string\`
   - Expected: ${versionInfo.rVersion} or higher

3. Random seed differences (for bootstrap methods)
   - Bootstrap methods may produce slightly different results each run
   - This is expected and doesn't indicate an error

## Citation

If you use MAIVE in your research, please cite:

\`\`\`bibtex
@article{maive2025,
  title={MAIVE: Meta-Analysis for Identifying Variability and Errors},
  author={[Authors]},
  journal={Nature Communications},
  year={2025},
  doi={10.1038/s41467-025-63261-0}
}
\`\`\`

## Support and Questions

- **GitHub Issues:** [github.com/PetrCala/maive-ui/issues](https://github.com/PetrCala/maive-ui/issues)
- **Documentation:** [meta-analysis.cz/maive](https://meta-analysis.cz/maive/)
- **R Package:** [github.com/meta-analysis-es/maive](https://github.com/meta-analysis-es/maive)

## Technical Details

### Software Versions

- **MAIVE UI:** ${versionInfo.uiVersion}
- **MAIVE Package:** ${versionInfo.maiveTag}
- **R Version:** ${versionInfo.rVersion}
- **Git Commit:** ${versionInfo.gitCommitHash}

### R Package Dependencies

The following R packages are required:

- \`MAIVE\` - Core MAIVE algorithms
- \`jsonlite\` - JSON parsing
- \`base64enc\` - Image encoding/decoding
- \`metafor\` - Meta-analysis functions
- \`ragg\` - High-quality graphics device
- \`systemfonts\` - Font support
- \`textshaping\` - Text rendering

All dependencies are automatically installed by \`run_analysis.R\`.

### Data Format

The \`data.csv\` file contains your meta-analysis data with the following columns:

- **Column 1:** Effect sizes (\`bs\`)
- **Column 2:** Standard errors (\`sebs\`)
- **Column 3:** Sample sizes (\`Ns\`)
- **Column 4 (if present):** Study IDs (\`study_id\`)

## License

This reproducibility package is generated by the MAIVE UI application. The R source code files (\`maive_model.R\`, \`funnel_plot.R\`) are part of the MAIVE UI project and follow its licensing terms.

---

**Generated by:** MAIVE UI v${versionInfo.uiVersion}
**Generated on:** ${timestamp}
**Package URL:** [github.com/PetrCala/maive-ui](https://github.com/PetrCala/maive-ui)
`;
}

/**
 * Generates version manifest file content
 */
export function generateVersionManifest(
  versionInfo: VersionInfo,
  parameters: ModelParameters,
): string {
  const timestamp = versionInfo.timestamp;

  return `MAIVE Analysis Reproducibility Package - Version Manifest
============================================================

Generated: ${timestamp}

SOFTWARE VERSIONS
-----------------
MAIVE UI Version:        ${versionInfo.uiVersion}
MAIVE R Package:         ${versionInfo.maiveTag}
R Version:               ${versionInfo.rVersion}
Git Commit Hash:         ${versionInfo.gitCommitHash}

GITHUB REFERENCES
-----------------
UI Repository:           https://github.com/PetrCala/maive-ui
UI Commit:               https://github.com/PetrCala/maive-ui/commit/${versionInfo.gitCommitHash}
MAIVE Package:           https://github.com/PetrCala/MAIVE/releases/tag/${versionInfo.maiveTag}

R SOURCE FILES
--------------
maive_model.R:           https://github.com/PetrCala/maive-ui/blob/${versionInfo.gitCommitHash}/apps/lambda-r-backend/r_scripts/maive_model.R
funnel_plot.R:           https://github.com/PetrCala/maive-ui/blob/${versionInfo.gitCommitHash}/apps/lambda-r-backend/r_scripts/funnel_plot.R

ANALYSIS CONFIGURATION
----------------------
Model Type:              ${parameters.modelType}
MAIVE Method:            ${parameters.maiveMethod}
Weight Scheme:           ${parameters.weight}
Use Instrumenting:       ${parameters.shouldUseInstrumenting}
Study Dummies:           ${parameters.includeStudyDummies}
Study Clustering:        ${parameters.includeStudyClustering}
SE Treatment:            ${parameters.standardErrorTreatment}
Anderson-Rubin:          ${parameters.computeAndersonRubin}
Log First Stage:         ${parameters.useLogFirstStage}
Winsorize:               ${parameters.winsorize}%

PACKAGE DEPENDENCIES
--------------------
Required R packages:
  - MAIVE (${versionInfo.maiveTag})
  - jsonlite
  - base64enc
  - metafor
  - ragg
  - systemfonts
  - textshaping
  - remotes (for installation)

REPRODUCIBILITY NOTES
---------------------
This package contains:
  1. Exact R source code from the deployed backend (commit ${versionInfo.gitCommitHash})
  2. User's original data (pre-winsorization if applicable)
  3. Exact parameter configuration used in the web application
  4. Expected results for verification

To ensure perfect reproducibility:
  - Use R version ${versionInfo.rVersion} or compatible
  - Install MAIVE package version ${versionInfo.maiveTag}
  - Run from the same working directory as the extracted files
  - For bootstrap methods, results may vary slightly due to randomness

CITATION
--------
If you use MAIVE in your research, please cite:
  DOI: 10.1038/s41467-025-63261-0
  URL: https://meta-analysis.cz/maive/

SUPPORT
-------
  Issues:  https://github.com/PetrCala/maive-ui/issues
  Docs:    https://meta-analysis.cz/maive/

============================================================
End of Version Manifest
`;
}
