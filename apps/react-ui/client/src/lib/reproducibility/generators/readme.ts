/**
 * Generates README documentation for reproducibility packages
 */

import CONST from "@src/CONST";
import { getCitationsForModel } from "@src/utils/citationUtils";
import type { ModelParameters } from "@src/types/api";
import type { VersionInfo } from "@src/types/reproducibility";

/**
 * Renders a URL as its own display label, so the visible text cannot go stale
 * when the underlying constant changes. These strings are archived inside
 * every downloaded replication package, so a drifted label is permanent.
 */
function linkLabel(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

/**
 * Names the source ref honestly: the exact commit when the deployment
 * recorded one, otherwise the branch the files were fetched from, so the
 * package never prints a ref that does not exist (#555).
 */
export function describeGitRef(versionInfo: VersionInfo): string {
  if (versionInfo.isExactCommit) {
    return versionInfo.gitCommitHash;
  }
  return `not recorded by this deployment; sources fetched from the ${versionInfo.gitRef} branch`;
}

/** GitHub URL for the deployed source: a commit page or a branch tree. */
export function gitRefUrl(versionInfo: VersionInfo): string {
  const kind = versionInfo.isExactCommit ? "commit" : "tree";
  return `${CONST.LINKS.APP_GITHUB.HOMEPAGE}/${kind}/${versionInfo.gitRef}`;
}

/** A backend R file shipped in a package, with its README description. */
export type PackagedRSourceFile = {
  file: string;
  description: string;
};

/**
 * The backend R files a package ships: exactly the ones its run_analysis.R
 * sources, directly or through another shipped file (maive_model.R sources
 * funnel_plot.R). The ZIP, the README and the version manifest all read this
 * list, so they cannot disagree. host.R is the Plumber server entrypoint and
 * nothing in a package sources it, so it is not shipped.
 */
export function packagedRSourceFiles(modelType: string): PackagedRSourceFile[] {
  if (modelType === "RTMA") {
    return [
      {
        file: "rtma_model.R",
        description: "RTMA model implementation (from web app backend)",
      },
      {
        file: "maive_model.R",
        description:
          "Data helpers the RTMA script sources, such as winsorization (from web app backend)",
      },
      {
        file: "funnel_plot.R",
        description:
          "Plotting code `maive_model.R` sources when it loads (from web app backend)",
      },
    ];
  }
  return [
    {
      file: "maive_model.R",
      description: "Core MAIVE model implementation (from web app backend)",
    },
    {
      file: "funnel_plot.R",
      description: "Funnel plot generation code (from web app backend)",
    },
  ];
}

/**
 * Converts model parameters to a readable markdown table
 *
 * @param rtmaSeed - Seed the RTMA sampler ran under, when the run recorded one
 */
function generateParameterTable(
  parameters: ModelParameters,
  rtmaSeed?: number | null,
): string {
  const rows =
    parameters.modelType === "RTMA"
      ? [
          ["Model Type", "RTMA"],
          ["Favor Positive", parameters.favorPositive ? "Yes" : "No"],
          ["Alpha Select", "0.05"],
          ["CI Level", "0.95"],
          ["Winsorize Percentage", `${parameters.winsorize}%`],
          [
            "Sampler Seed",
            rtmaSeed == null
              ? "not recorded (run predates seeded RTMA sampling)"
              : String(rtmaSeed),
          ],
        ]
      : [
          ["Model Type", parameters.modelType],
          ["MAIVE Method", parameters.maiveMethod],
          ["Weight Scheme", parameters.weight.replace(/_/g, " ")],
          [
            "Use Instrumenting",
            parameters.shouldUseInstrumenting ? "Yes" : "No",
          ],
          [
            "Include Study Dummies",
            parameters.includeStudyDummies ? "Yes" : "No",
          ],
          [
            "Include Study Clustering",
            parameters.includeStudyClustering ? "Yes" : "No",
          ],
          [
            "Standard Error Treatment",
            parameters.standardErrorTreatment.replace(/_/g, " "),
          ],
          [
            "Compute Anderson-Rubin",
            parameters.computeAndersonRubin ? "Yes" : "No",
          ],
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
  rtmaSeed?: number | null,
): string {
  const timestamp = new Date(versionInfo.timestamp).toLocaleString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });

  const parameterTable = generateParameterTable(parameters, rtmaSeed);

  const isRtma = parameters.modelType === "RTMA";
  const title = isRtma
    ? "RTMA Analysis Reproducibility Package"
    : "MAIVE Analysis Reproducibility Package";
  const analysisType = isRtma ? "RTMA" : "MAIVE";

  const rSourceFiles = packagedRSourceFiles(parameters.modelType);
  const rSourceRows = rSourceFiles
    .map(({ file, description }) => `| \`${file}\` | ${description} |`)
    .join("\n");
  const rSourceNames = rSourceFiles.map(({ file }) => `\`${file}\``).join(", ");

  // The two scripts write different files and verify different fields, so an
  // RTMA package must not describe the MAIVE ones: it used to promise a
  // funnel_plot.png and maive_results.* that an RTMA run never writes.
  const resultsFile = isRtma ? "rtma_results" : "maive_results";
  const outputFilesTable = [
    isRtma
      ? ["z_score_plot.png", "PNG image", "Z-score density plot"]
      : ["funnel_plot.png", "PNG image", "Funnel plot visualization"],
    [
      `${resultsFile}.rds`,
      "R object",
      "Complete results (load with `readRDS()`)",
    ],
    [
      `${resultsFile}.json`,
      "JSON",
      "Results in JSON format (for use with other tools)",
    ],
    [
      "session_info.txt",
      "Text",
      "R, platform and package versions this re-run actually used (`sessionInfo()`)",
    ],
  ]
    .map(
      ([file, format, description]) =>
        `| \`${file}\` | ${format} | ${description} |`,
    )
    .join("\n");

  // Mirrors the labels the generated script prints (wrapperScript.ts).
  const verificationLabels = isRtma
    ? [
        "mu (mode)",
        "mu (median)",
        "mu CI lower",
        "mu CI upper",
        "tau (mode)",
        "tau (median)",
        "tau CI lower",
        "tau CI upper",
        "Unadjusted FE mean",
        "Estimates used (k)",
        "Affirmative count",
      ]
    : ["Effect Estimate", "Standard Error", "Egger Coefficient"];
  const labelWidth = Math.max(
    ...verificationLabels.map((label) => `${label} Match:`.length),
  );
  const expectedVerification = verificationLabels
    .map((label) => `${`${label} Match:`.padEnd(labelWidth)} ✓ PASS`)
    .join("\n");

  const accessExample = isRtma
    ? `corrected_mean <- results$mu
credible_interval <- results$muCI
heterogeneity <- results$tau`
    : `effect_estimate <- results$effectEstimate
standard_error <- results$standardError
egger_coef <- results$publicationBias$eggerCoef`;

  const customVisualization = isRtma
    ? "The z-score density plot is saved as `z_score_plot.png`. `rtma_model.R` draws it with `phacking::z_density()`; see `render_z_density_plot()` there to regenerate or customize it."
    : `\`\`\`r
# The funnel plot is saved as PNG, but you can regenerate it
# Load the plotting functions
source("funnel_plot.R")

# Customize and regenerate
# (see funnel_plot.R for available parameters)
\`\`\``;

  return `# ${title}

This package contains everything needed to reproduce the ${analysisType} meta-analysis performed on **${timestamp}**.

## Package Information

- **MAIVE UI Version:** ${versionInfo.uiVersion}
- **MAIVE R Package:** ${versionInfo.maiveTag}${
    isRtma
      ? `\n- **phacking R Package:** ${versionInfo.phackingVersion}`
      : `\n- **clubSandwich R Package:** ${versionInfo.clubSandwichVersion}`
  }
- **R Version Used:** ${versionInfo.rVersion}
- **Git Commit:** ${describeGitRef(versionInfo)}
- **Dataset Size:** ${numRows} observations

${
  isRtma
    ? `## What is RTMA?

RTMA (Right-Truncated Meta-Analysis) corrects for the joint effects of p-hacking and publication bias by fitting a truncated normal likelihood to the distribution of z-scores. It uses the \`phacking\` R package (Mathur & Braginsky, 2023).

**Learn more:**
- **phacking package:** [CRAN](https://cran.r-project.org/package=phacking)
- **Paper:** Mathur, M.B. (2024). P-hacking in meta-analyses: A formalization and new meta-analytic methods. *Research Synthesis Methods*, 15(3), 483-499. [doi.org/10.1002/jrsm.1701](${CONST.LINKS.RTMA.PAPER})
- **MAIVE App:** [${linkLabel(CONST.LINKS.APP.WEBSITE)}](${CONST.LINKS.APP.WEBSITE})`
    : `## What is MAIVE?

MAIVE (Meta-Analysis Instrumental Variable Estimator) is a statistical tool for detecting spurious precision in meta-analysis data. It helps identify potential data quality issues that may affect the validity of meta-analytic findings.

**Learn more:**
- **Paper:** [Nature Communications](${CONST.LINKS.MAIVE.PAPER})
- **Website:** [${linkLabel(CONST.LINKS.MAIVE.WEBSITE)}](${CONST.LINKS.MAIVE.WEBSITE})
- **GitHub:** [${linkLabel(CONST.LINKS.APP_GITHUB.HOMEPAGE)}](${CONST.LINKS.APP_GITHUB.HOMEPAGE})`
}

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
6. ✓ Run the ${analysisType} analysis
7. ✓ Compare results with expected values
8. ✓ Generate and save the ${isRtma ? "z-score density plot" : "funnel plot"}
9. ✓ Save results in multiple formats

**First run may take a few minutes** while R installs the required packages. Subsequent runs will be much faster.

## Package Contents

| File | Description |
|------|-------------|
| \`run_analysis.R\` | Main script that orchestrates the entire analysis |
${rSourceRows}
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
${outputFilesTable}

## Verifying Results

The script automatically compares computed results with the web application output.

**Expected output:**
\`\`\`
=== VERIFICATION ===
Comparing with expected results from web application...
${expectedVerification}

✓ All key results match! Reproducibility confirmed.
\`\`\`

**Small numerical differences** (< 1e-8) are normal due to:
- Floating-point arithmetic precision
- Different R versions
- Different BLAS/LAPACK implementations

**Larger differences** may indicate:
- Different ${isRtma ? "phacking" : "MAIVE"} package version
- Different random seed (${isRtma ? "the script reports the one the sampler ran under" : "for bootstrap methods"})
- Missing or incompatible dependencies

## Using the Results in Your Own Scripts

### Load Results

\`\`\`r
# Load the complete results object
results <- readRDS("${resultsFile}.rds")

# Access specific values
${accessExample}

# View results structure
str(results)
\`\`\`

### Create Custom Visualizations

${customVisualization}

## Troubleshooting

### Installation Issues

**Problem:** Package installation fails

**Solutions:**
- Ensure you have a stable internet connection
- Try installing packages manually:
  \`\`\`r
  install.packages("remotes")
  remotes::install_github("${CONST.GITHUB.OWNER}/${CONST.GITHUB.REPO_PACKAGE}@${versionInfo.maiveTag}")
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

The script writes \`session_info.txt\` next to the results with the R, platform and package versions the re-run actually used. Start there and compare it with the versions listed above.

**Possible causes:**
1. Different MAIVE package version
   - Check installed version: \`packageVersion("MAIVE")\`
   - Should be: ${versionInfo.maiveTag}
${
  isRtma
    ? `
2. Different phacking package version
   - Check installed version: \`packageVersion("phacking")\`
   - Should be: ${versionInfo.phackingVersion} (run_analysis.R installs it)`
    : `
2. Different clubSandwich package version
   - Check installed version: \`packageVersion("clubSandwich")\`
   - Should be: ${versionInfo.clubSandwichVersion} (run_analysis.R installs it)
   - clubSandwich supplies the cluster-robust covariance behind every MAIVE standard error`
}

3. Different R version
   - Check R version: \`R.version.string\`
   - Expected: ${versionInfo.rVersion} or higher

4. Random seed differences (for bootstrap methods)
   - Bootstrap methods may produce slightly different results each run
   - This is expected and doesn't indicate an error

## Citation

If you use ${analysisType} in your research, please cite:

${getCitationsForModel(parameters.modelType)
  .map((citation) =>
    [
      citation.role ? `**${citation.role}:**` : null,
      "```bibtex",
      citation.formats.bibtex,
      "```",
    ]
      .filter(Boolean)
      .join("\n"),
  )
  .join("\n\n")}

## Support and Questions

- **GitHub Issues:** [${linkLabel(CONST.LINKS.APP_GITHUB.ISSUES)}](${CONST.LINKS.APP_GITHUB.ISSUES})
- **Documentation:** [${linkLabel(CONST.LINKS.MAIVE.WEBSITE)}](${CONST.LINKS.MAIVE.WEBSITE})
- **R Package:** [${linkLabel(CONST.LINKS.MAIVE.GITHUB)}](${CONST.LINKS.MAIVE.GITHUB})

## Technical Details

### Software Versions

- **MAIVE UI:** ${versionInfo.uiVersion}
- **MAIVE Package:** ${versionInfo.maiveTag}${
    isRtma
      ? `\n- **phacking Package:** ${versionInfo.phackingVersion}`
      : `\n- **clubSandwich Package:** ${versionInfo.clubSandwichVersion}`
  }
- **R Version:** ${versionInfo.rVersion}
- **Git Commit:** ${describeGitRef(versionInfo)}

### R Package Dependencies

The following R packages are required:

- \`MAIVE\` - Core MAIVE algorithms${
    isRtma
      ? `\n- \`phacking\` - RTMA implementation (pinned to ${versionInfo.phackingVersion})\n- \`clubSandwich\` - Loaded by maive_model.R`
      : `\n- \`clubSandwich\` - Cluster-robust covariance behind MAIVE inference (pinned to ${versionInfo.clubSandwichVersion})`
  }
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

This reproducibility package is generated by the MAIVE UI application. The R source code files (${rSourceNames}) are part of the MAIVE UI project and follow its licensing terms.

---

**Generated by:** MAIVE UI v${versionInfo.uiVersion}
**Generated on:** ${timestamp}
**Package URL:** [${linkLabel(CONST.LINKS.APP_GITHUB.HOMEPAGE)}](${CONST.LINKS.APP_GITHUB.HOMEPAGE})
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
  // RTMA is fitted by phacking rather than by the MAIVE package, so its version
  // is the one that has to be recorded for an RTMA run to be reproducible.
  const isRtma = parameters.modelType === "RTMA";
  // clubSandwich supplies the covariance estimator behind every MAIVE standard
  // error, so it is the version a MAIVE run has to record (#576).
  const inferenceLine = isRtma
    ? `\nphacking R Package:      ${versionInfo.phackingVersion}`
    : `\nclubSandwich R Package:  ${versionInfo.clubSandwichVersion}`;
  const rSourceLines = packagedRSourceFiles(parameters.modelType)
    .map(
      ({ file }) =>
        `${`${file}:`.padEnd(25)}${CONST.LINKS.APP_GITHUB.HOMEPAGE}/blob/${versionInfo.gitRef}/${CONST.GITHUB.R_SCRIPTS_PATH}/${file}`,
    )
    .join("\n");

  return `MAIVE Analysis Reproducibility Package - Version Manifest
============================================================

Generated: ${timestamp}

SOFTWARE VERSIONS
-----------------
MAIVE UI Version:        ${versionInfo.uiVersion}
MAIVE R Package:         ${versionInfo.maiveTag}
R Version:               ${versionInfo.rVersion}${inferenceLine}
Git Commit Hash:         ${describeGitRef(versionInfo)}

GITHUB REFERENCES
-----------------
UI Repository:           ${CONST.LINKS.APP_GITHUB.HOMEPAGE}
UI Source:               ${gitRefUrl(versionInfo)}
MAIVE Package:           https://github.com/${CONST.GITHUB.OWNER}/${CONST.GITHUB.REPO_PACKAGE}/releases/tag/${versionInfo.maiveTag}

R SOURCE FILES
--------------
${rSourceLines}

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
  - MAIVE (${versionInfo.maiveTag})${
    isRtma
      ? `\n  - phacking (${versionInfo.phackingVersion})\n  - clubSandwich`
      : `\n  - clubSandwich (${versionInfo.clubSandwichVersion})`
  }
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
  1. R source code from the deployed backend (${describeGitRef(versionInfo)})
  2. User's original data (pre-winsorization if applicable)
  3. Exact parameter configuration used in the web application
  4. Expected results for verification

To ensure perfect reproducibility:
  - Use R version ${versionInfo.rVersion} or compatible
  - Install MAIVE package version ${versionInfo.maiveTag}${
    isRtma
      ? `\n  - Install phacking package version ${versionInfo.phackingVersion} (run_analysis.R does this)`
      : `\n  - Install clubSandwich package version ${versionInfo.clubSandwichVersion} (run_analysis.R does this)`
  }
  - Run from the same working directory as the extracted files
  - For bootstrap methods, results may vary slightly due to randomness
  - run_analysis.R writes session_info.txt next to the results; when the
    verification fails, compare the versions recorded there with the ones above

CITATION
--------
If you use ${parameters.modelType === "RTMA" ? "RTMA" : "MAIVE"} in your research, please cite:

${getCitationsForModel(parameters.modelType)
  .map((citation) =>
    citation.role
      ? `${`${citation.role}:`.padEnd(13)}${citation.formats.plain}`
      : `  ${citation.formats.plain}`,
  )
  .join("\n")}

  URL: ${CONST.LINKS.MAIVE.WEBSITE}

SUPPORT
-------
  Issues:  ${CONST.LINKS.APP_GITHUB.ISSUES}
  Docs:    ${CONST.LINKS.MAIVE.WEBSITE}

============================================================
End of Version Manifest
`;
}
