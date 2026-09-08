import { createElement } from "react";

import CONFIG from "@src/CONFIG";
import CONST from "@src/CONST";
import type { ModelParameters } from "@src/types";
import { formatNumberWithSeparator } from "@src/utils/numberFormat";

type StandardErrorTreatment = ModelParameters["standardErrorTreatment"];

type MetricText = Readonly<{
  label: string;
  tooltip: string;
}>;

export type RichInfoMessage = Readonly<{
  leading: string;
  citation: string;
  postCitation: string;
  citeButtonLabel: string;
  postCiteButton: string;
}>;

type SectionWithMetrics<TMetrics extends Record<string, MetricText>> =
  Readonly<{
    title: string;
    metrics: TMetrics;
  }>;

export type ResultsText = Readonly<{
  effectEstimate: SectionWithMetrics<{
    estimate: MetricText;
    standardError: MetricText;
    significance: MetricText;
    andersonRubinCI: MetricText;
    bootCI: MetricText;
  }>;
  publicationBias: SectionWithMetrics<{
    eggerCoef: MetricText;
    eggerSE: MetricText;
    significance: MetricText;
    eggerBootCI: MetricText;
    eggerAndersonRubinCI: MetricText;
  }>;
  diagnosticTests: SectionWithMetrics<{
    hausmanTest: MetricText;
    hausmanCriticalValue: MetricText;
    firstStageFStatistic: MetricText;
    firstStageFStatisticLog: MetricText;
    firstStageSpecification: MetricText;
  }>;
  modelDetails: SectionWithMetrics<{
    finalModel: MetricText;
    peeseSe2Coef: MetricText;
    peeseSe2Se: MetricText;
    kinkValue: MetricText;
  }>;
  funnelPlot: Readonly<{
    title: string;
    tooltip: string;
  }>;
  activeFilterLabel: string;
}>;

const STANDARD_ERROR_TREATMENT_TOOLTIPS: Record<
  StandardErrorTreatment,
  string
> = {
  not_clustered: "Heteroskedasticity-robust standard error",
  clustered: "Cluster-robust standard error",
  clustered_cr2:
    "Cluster-robust standard error (CR2); robust to a small number of clusters",
  bootstrap:
    "Wild bootstrap standard error; robust to a small number of clusters",
};

const RESULTS_TEXT: ResultsText = {
  effectEstimate: {
    title: "Corrected Mean Estimate",
    metrics: {
      estimate: {
        label: "Estimate",
        tooltip:
          "Point estimate of the effect size corrected for publication bias, p-hacking, and spurious precision.",
      },
      standardError: {
        label: "Standard Error",
        tooltip: STANDARD_ERROR_TREATMENT_TOOLTIPS.not_clustered,
      },
      significance: {
        label: "Significant at 5% level",
        tooltip:
          "Shows whether the null hypothesis of no bias is rejected at the 5% (two-sided) level using the robust standard error above.",
      },
      andersonRubinCI: {
        label: "Anderson-Rubin 95% CI",
        tooltip:
          "Weak-instrument-robust 95% Anderson-Rubin confidence interval for the effect; remains valid even when the first-stage F statistic is low. Returns NA when: (1) AR computation is disabled, (2) the acceptance region is disjoint with extreme heterogeneity in standard errors, or (3) no valid acceptance region is found.",
      },
      bootCI: {
        label: "Bootstrap 95% CI",
        tooltip: "Bootstrap 95% confidence interval for the effect estimate.",
      },
    },
  },
  publicationBias: {
    title: "Publication Bias and p-hacking Analysis",
    metrics: {
      eggerCoef: {
        label: "Egger Coefficient Estimate",
        tooltip:
          "Coefficient capturing funnel asymmetry in the instrumented Egger regression.",
      },
      eggerSE: {
        label: "Egger Coefficient Standard Error",
        tooltip:
          "Robust standard error of the coefficient capturing funnel asymmetry in the instrumented Egger regression.",
      },
      significance: {
        label: "Egger Test Significant at 5% level",
        tooltip:
          "Indicates whether publication bias is statistically significant at the 5% level according to the instrumented FAT test.",
      },
      eggerBootCI: {
        label: "Egger Coefficient Bootstrap 95% CI",
        tooltip:
          "Bootstrap 95% confidence interval for the Egger coefficient from the instrumented regression.",
      },
      eggerAndersonRubinCI: {
        label: "Egger Coefficient Anderson-Rubin 95% CI",
        tooltip:
          "Weak-instrument-robust 95% Anderson-Rubin confidence interval for the Egger coefficient, matching the options used for the main estimate. Returns NA when: (1) AR computation is disabled, (2) the acceptance region is disjoint with extreme heterogeneity in standard errors, or (3) no valid acceptance region is found.",
      },
    },
  },
  diagnosticTests: {
    title: "Diagnostic Tests",
    metrics: {
      hausmanTest: {
        label: "Hausman Test",
        tooltip:
          "Hausman-type statistic comparing the MAIVE IV estimator with the conventional PET-PEESE (OLS) estimator; large values favour the IV approach.",
      },
      hausmanCriticalValue: {
        label: "Hausman Test Critical Value",
        tooltip:
          "5% critical value for the Hausman test. Reject exogeneity if the test statistic exceeds this value.",
      },
      firstStageFStatistic: {
        label: "First-Stage F-Statistic",
        tooltip:
          "Heteroskedasticity-robust F statistic for the strength of the instrument (inverse sample size) in the levels first-stage regression of reported variances. Values above 10 denote a strong instrument.",
      },
      firstStageFStatisticLog: {
        label: "First-Stage F-Statistic (γ₁)",
        tooltip:
          "Heteroskedasticity-robust F statistic for the log-scale slope coefficient (γ₁) in the first-stage regression log(SE²) ~ log N. Values above 10 denote a strong instrument.",
      },
      firstStageSpecification: {
        label: "First-stage specification",
        tooltip:
          "Indicates the functional form used for the first-stage variance regression. Log mode reports log(SE²) ~ log N with Duan smearing to return fitted variances to levels.",
      },
    },
  },
  modelDetails: {
    title: "Model Details",
    metrics: {
      finalModel: {
        label: "Final Model",
        tooltip:
          "The model selected by the PET-PEESE procedure based on the significance of the intercept in the PET regression. If the intercept is significant, PEESE is used; otherwise, PET is used.",
      },
      peeseSe2Coef: {
        label: "Coefficient on SE²",
        tooltip:
          "The estimated coefficient on the squared standard error term in the PEESE (Precision-Effect Estimate with Standard Error) regression. This captures the quadratic relationship between effect size and precision.",
      },
      peeseSe2Se: {
        label: "SE of Coefficient on SE²",
        tooltip:
          "The standard error of the coefficient on SE², reflecting the uncertainty in the quadratic precision-effect relationship.",
      },
      kinkValue: {
        label: "Kink Value",
        tooltip:
          "The threshold value at which the relationship between effect size and precision changes slope in the Endogenous Kink (EK) model. A kink value of 0 indicates the model reduces to PET (linear specification).",
      },
    },
  },
  funnelPlot: {
    title: "MAIVE-Adjusted Funnel Plot",
    tooltip:
      "Scatter of effect sizes against their MAIVE-adjusted precision. Shaded regions represent levels of statistical significance of the reported estimates. The solid line shows the MAIVE fit, and the corrected meta-analytic estimate is given by the intercept of this line with the upper horizontal axis.",
  },
  activeFilterLabel: "Filter",
};

const TEXT = {
  home: {
    title: "Seamless Meta-Analysis with MAIVE",
    uploadYourData: "Upload Your Data",
    whatIsMaive: "What is MAIVE?",
  },
  common: {
    close: "Close",
  },
  citation: {
    shortText: "Irsova et al., Nature Communications, 2025",
    reminder: {
      title: "Citation Reminder",
      text: "This method is included in the MAIVE app (Irsova et al., Nature Communications, 2025). Please cite the paper using the button in the footer if you use this tool in your research.",
      richText: {
        leading: "This method is included in the MAIVE app (",
        citation: "Irsova et al., Nature Communications, 2025",
        postCitation: "). Please cite the paper using the ",
        citeButtonLabel: "Cite",
        postCiteButton:
          " button in the footer if you use this tool in your research.",
      },
    },
    title: "How to Cite This App",
    description:
      "Please cite the MAIVE paper when using this tool for your research.",
    descriptionMulti:
      "Please cite the method you used, and the MAIVE app that runs it, when using this tool for your research.",
    viewPaper: "View full paper →",
    viewPackage: "View package →",
    copied: "Copied!",
    copy: "Copy",
  },
  upload: {
    title: "Upload Your Data",
    description:
      "Please ensure your data file meets the following requirements:",
    requirements: {
      fileFormat:
        "The file must be in **.xlsx**, **.xls**, or **.csv** format.",
      columnMapping:
        "After uploading, you can **map the columns** in your file to MAIVE's required fields.",
      requiredColumns:
        "Please include columns for **effect estimates** and **standard errors**. **Sample sizes** are required for every model except RTMA (study IDs are optional).",
      numberFormats:
        "Effect estimates and standard errors can include decimal points or commas; MAIVE will interpret both.",
      extraColumns:
        "Extra columns are welcome! You'll be able to ignore them during column mapping.",
    },
  },
  mapping: {
    title: "Map Your Columns",
    description:
      "Tell MAIVE which columns contain your effect sizes, standard errors, and sample sizes.",
    fieldLabels: {
      effect: "Effect size",
      se: "Standard error",
      nObs: "Sample size",
      studyId: "Study ID (optional)",
    },
    helperText:
      "Each column can only be mapped once. The Sample size field is required for every model except RTMA; without it, only RTMA will be available. The Study ID field is optional: leave it blank if you don't have study-level clustering.",
    continueButton: "Continue to validation",
    autoMappingNotice:
      "We've pre-selected columns where the headers looked familiar. Feel free to adjust before continuing.",
    rawPreviewTitle: "Column preview",
    mappedPreviewTitle: "Data preview",
    mappedPreviewDescription:
      "Values shown here update automatically as you change the column mapping.",
    validationTitle: "Validation",
    validationDescription:
      "Map the required fields to unlock validation and continue to the next step.",
    validationIncomplete: "Map the required fields to continue to validation.",
    readyForValidation:
      "All required fields are mapped. Continue to run the validation checks.",
    loading: "Preparing your data...",
    mappingError:
      "We couldn't find the uploaded data. Please upload your file again.",
  },
  validation: {
    title: "Prepare Your Data",
    description:
      "Map your columns, optionally filter your dataset, and let MAIVE verify everything is ready for analysis.",
    helperText:
      "Previews and validation update automatically as you adjust the settings below.",
    loading: "Preparing your validation results...",
    missingDataTitle: "No data selected",
    missingDataMessage:
      "Upload your file and complete the column mapping to view validation results.",
    continueButton: "Continue to model setup",
    previewTitle: "Data preview",
    previewDescription:
      "Double-check that the normalized values look correct before continuing.",
    resultsTitle: "Validation Results",
    resultsDescription:
      "Review the checks below and fix any errors before continuing to model setup.",
    subsampleFilter: {
      title: "Use a subsample filter?",
      description:
        "Would you like to include only a subset of your data in the analysis?",
      toggleLabel: "Filter setting",
      enableLabel: "Yes",
      disableLabel: "No",
      conditionLabel: "Condition",
      selectColumn: "Select a variable",
      valuePlaceholder: "Enter a value",
      joinerLabel: "Combine items with",
      joinerAnd: "AND",
      joinerOr: "OR",
      addCondition: "Add condition",
      addGroup: "Add group",
      removeCondition: "Remove condition",
      removeGroup: "Remove group",
      moveItemUp: "Move item up",
      moveItemDown: "Move item down",
      rowsMatchingLabel: "Rows matching",
      unavailableMatches: "Select filter options to preview matches",
      incompleteMessage:
        "Select a variable, operator, and value to preview matches.",
      noMatchesMessage: "The filter produced no matching rows.",
    },
  },
  model: {
    basicOptions: {
      bottomText:
        "Note that selecting WLS in Model Type allows you to run classical PET, PEESE, PET-PEESE, and EK.",
    },
    modelType: {
      label: "Model Type",
      tooltip: createElement(
        "span",
        null,
        createElement("strong", null, "MAIVE:"),
        " Meta-Analysis Instrumental Variable Estimator (Irsova et al., 2025, Nat Comms).",
        createElement("br"),
        createElement("br"),
        createElement("strong", null, "WAIVE (Experimental):"),
        " Weighted Adjustment Instrumental Variable Estimator (corrects more aggressively for p-hacking).",
        createElement("br"),
        createElement("br"),
        createElement("strong", null, "WLS:"),
        " Meta-regression corrections without instrumenting.",
        createElement("br"),
        createElement("br"),
        createElement("strong", null, "RTMA:"),
        " Right-Truncated Meta-Analysis (Mathur, 2024). Corrects for p-hacking and publication bias using a truncated normal likelihood.",
        ...(CONFIG.RDT_ENABLED
          ? [
              createElement("br"),
              createElement("br"),
              createElement("strong", null, "RDT (Experimental):"),
              " Residual Discontinuity Test. A diagnostic for precision adjusted to reach significance; reports no corrected effect.",
            ]
          : []),
      ),
      rtmaOnlyInfo:
        "Your data has no sample-size column, so RTMA is the only available model. MAIVE, WAIVE, and WLS require sample sizes; re-upload with a sample-size column to use them.",
    },
    includeStudyDummies: {
      label: "Fixed-Intercept Multilevel",
      tooltip:
        "Controls for within-study dependence by assigning each study its own intercept (effect). Accounts for unobserved study-level factors without relying on the assumptions required for random-effects modeling (e.g., random effects uncorrelated with publication bias).",
    },
    includeStudyClustering: {
      label: "Include Study Level Clustering",
      tooltip:
        "Whether to include study-level clustering in the analysis. If you data does not have a study ID column, this option will have no effect.",
    },
    standardErrorTreatment: {
      label: "Standard Error Treatment",
      tooltip:
        "Adjusts meta-analytic standard errors to account for correlations among estimates reported within the same study. The bootstrap and CR2 (Pustejovsky & Tipton, 2018, JBES) options provide valid inference even with a small number of studies.",
      bootstrapLargeDatasetWarning: `Bootstrap standard errors can significantly increase processing time for large datasets (${formatNumberWithSeparator(CONST.LARGE_DATASET_ROW_THRESHOLD)}+ rows).`,
    },
    computeAndersonRubin: {
      label: "Compute Anderson-Rubin Confidence Interval",
      tooltip:
        "The Anderson-Rubin confidence interval is robust to weak instruments (when sample size poorly predicts precision). It should be reported when the first-stage F-statistic is below 10.",
      warning:
        "May increase processing time. For the corrected mean (intercept), intervals can be wide because the instrument identifies the slope, not the intercept. In some cases (e.g. high heterogeneity in standard errors), AR intervals may return NA.",
    },
    advancedOptions: {
      title: "Advanced Options",
    },
    maiveMethod: {
      label: "MAIVE Method",
      waiveLabel: "WAIVE Method",
      nonInstrumentingLabel: "Method",
      tooltip: createElement(
        "span",
        null,
        createElement("strong", null, "PET:"),
        " Precision Effect Test.",
        createElement("br"),
        createElement("br"),
        createElement("strong", null, "PEESE:"),
        " Precision Effect Estimate with Standard Errors.",
        createElement("br"),
        createElement("br"),
        createElement("strong", null, "PET-PEESE:"),
        " Two-step combination of PET and PEESE (Stanley & Doucouliagos, 2014, RSM).",
        createElement("br"),
        createElement("br"),
        createElement("strong", null, "EK:"),
        " Endogenous Kink model (Bom & Rachinger, 2019, RSM).",
      ),
    },
    weight: {
      label: "Weighting",
      tooltip: createElement(
        "span",
        null,
        createElement("strong", null, "Equal Weights:"),
        " Limiting case of a random-effects model with large heterogeneity.",
        createElement("br"),
        createElement("br"),
        createElement("strong", null, "Standard Weights:"),
        " Inverse-variance weights.",
        createElement("br"),
        createElement("br"),
        createElement("strong", null, "Adjusted Weights:"),
        " MAIVE-adjusted inverse-variance weights.",
        createElement("br"),
        createElement("br"),
        createElement("strong", null, "Study Weights:"),
        " Each study contributes equally, regardless of how many estimates it reports.",
      ),
    },
    winsorize: {
      label: "Winsorization (%)",
      tooltip:
        "Reduces the influence of extreme outliers by replacing values beyond symmetric percentile bounds with the corresponding boundary values. Select the winsorization percentage (0 to 5%) to apply to effect sizes and standard errors.",
      selectedLabel: "Selected winsorization",
    },
    shouldUseInstrumenting: {
      label: "Use Instrumenting",
      tooltip:
        "Whether to use instrumenting in the analysis. Selecting the WLS model automatically turns instrumenting off so you can estimate classical (non-MAIVE) versions of PET, PEESE, PET-PEESE, and EK.",
      noInstrumentingInfo: {
        leading:
          "Without instrumenting, this run is not MAIVE. Please still cite ",
        citation: "Irsova et al., Nature Communications (2025)",
        postCitation: " as the app used using the ",
        citeButtonLabel: "Cite",
        postCiteButton:
          " button in the footer if you use this tool in your research.",
      },
    },
    useLogFirstStage: {
      label: "Use log first stage",
      tooltip:
        "Estimates the first-stage regression on log variances versus log sample size, applying Duan smearing when transforming fitted variances back to levels. This is the default: logs typically strengthen the instrument and often perform better in practical applications. Set to No to run the first stage in levels instead.",
    },
    favorPositive: {
      label: "Favor Positive",
      tooltip:
        "Assumes that publication bias and p-hacking favor positive (right-tailed) results. Set to No if the literature in question favors negative results instead.",
    },
    runModel: "Run Model",
    largeRtma: {
      queuedInfo:
        "Large dataset detected. The p-hacking correction is running in the background; you can keep working and check My Runs for the result.",
      syncUnavailable: `This dataset is too large for the interactive p-hacking correction (over ${CONST.RTMA_SYNC_ROW_LIMIT} rows), and background processing is currently unavailable. The run was not submitted; please try again later.`,
    },
  },
  rtma: {
    dropdownLabel: "RTMA",
    seed: {
      label: "Sampler Seed",
      tooltip:
        "Random seed the RTMA sampler ran under. The credible intervals are posterior quantiles, so they depend on it; the same data and seed reproduce the same numbers exactly.",
      unknownValue: "Not recorded",
      unknownTooltip:
        "This run predates seeded RTMA sampling, so its credible intervals cannot be reproduced exactly. Rerun the model to get a seeded result.",
    },
    diagnostics: {
      optimConverged: {
        label: "Mode Optimisation",
        tooltip:
          "Whether the optimisation that produces the reported modes converged. It runs separately from the sampler, so a failure leaves the modes meaningless while the credible intervals, which are posterior quantiles, stay sound.",
      },
      rHat: {
        label: "R-hat (μ / τ)",
        tooltip:
          "Gelman-Rubin convergence statistic for each parameter. Above 1.01 the chains have not converged on the same distribution and no summary of them can be trusted.",
      },
      nEff: {
        label: "Effective Draws (μ / τ)",
        tooltip:
          "Number of effectively independent posterior draws behind each parameter's summaries. The sampler runs four chains, so anything below roughly 400 means the estimates and intervals rest on very little.",
      },
      divergences: {
        label: "Divergent Transitions",
        tooltip:
          "Iterations where the sampler could not follow the geometry of the posterior. Any at all mean part of the posterior went unexplored, so the intervals can be biased even when everything else looks healthy.",
      },
      unavailableLabel: "Convergence Diagnostics",
      unavailableValue: "Not recorded",
      unavailableTooltip:
        "This run predates RTMA convergence diagnostics, so there is no way to tell whether its fit converged. Rerun the model to get them.",
    },
  },
  // RDT (Residual Discontinuity Test, #559). The sign convention below is
  // load-bearing: the residual is of log(SE), so lower means more precise
  // than sample size predicts, and the signature is a downward jump.
  rdt: {
    dropdownLabel: "RDT (Experimental)",
    helpText:
      "RDT (Residual Discontinuity Test) is an experimental diagnostic, not an estimator. It regresses log(SE) on log(N) and tests whether the residual, the part of reported precision that sample size does not explain, jumps at |t| = 1.96. It reports no corrected effect and has no options; winsorization does not apply because it would move estimates across the cutoff.",
    results: {
      title: "RDT Results",
      jump: {
        label: "Jump in residual precision at |t| = 1.96",
        subLabel:
          "negative = estimates just past the threshold are more precise than their sample sizes predict",
        tooltip:
          "Local-linear regression-discontinuity estimate of the jump in the residual of log(SE) on log(N) at |t| = 1.96, with a CR2 cluster-robust standard error and a conventional 95% interval. Lower residual means more precise than sample size predicts, so a negative jump is the p-hacking signature.",
      },
      detectable: {
        label: "Smallest jump this dataset could detect (80% power)",
        subLabel:
          "a jump of about 0.10 corresponds to standard errors roughly 10% smaller than sample size predicts; below the detectable size, a null result says nothing.",
        tooltip:
          "2.8 times the standard error of the jump: the smallest true jump that a two-sided 5% test would detect 80% of the time. Power is genuinely low in most literatures, so a result that is not significant is not evidence of clean data.",
      },
      window: {
        label: "Estimation window",
        tooltip:
          "The local-linear fit uses estimates with |t| inside this window, weighted by a triangular kernel. The bandwidth follows the Imbens-Kalyanaraman rule, clamped to between 0.25 and 1.0 log points, and is widened only when one side would otherwise hold fewer than five estimates.",
      },
      checks: {
        title: "Checks",
        firstStage: {
          label: "First stage",
          note: "Slope of log(SE) on log(N) and the R-squared of that regression.",
          warning:
            "R-squared above 0.99: the standard errors are an almost exact function of sample size, the residual has no variation, and RDT cannot say anything about this data.",
        },
        sensitivity: {
          label: "Bandwidth sensitivity",
          note: "If these move outside the headline interval, the number depends on the window.",
        },
        placebo: {
          label: "Placebo thresholds",
          note: "Placebo jumps as large as the headline mean the headline is within noise.",
        },
        unavailable: "not available",
      },
      // Both paragraphs must stay on the panel (#559): without them the jump
      // is read as an estimate and a null result as evidence of clean data.
      interpretation:
        "The jump compares how much more precise estimates just past |t| = 1.96 are than their sample sizes predict, relative to estimates just short of it. A negative jump is what adjusting precision to reach significance would produce. Selection on significance alone cannot produce it, but selection that also depends on the size of the effect can, so a negative jump is not by itself proof of manipulation.",
      caution:
        "A result that is not significant does not mean the literature is clean. Read the estimate and its interval, not the p-value. The interval is a conventional cluster-robust interval, not the bias-corrected interval of Calonico, Cattaneo and Titiunik (2014), and the estimate moves with the bandwidth (see checks). RDT is experimental and reports no corrected effect.",
      plot: {
        title: "Residual Precision by |t|",
        tooltip:
          "Binned scatter of the first-stage residual (log(SE) after log(N); lower = more precise than sample size predicts) against |t| on a log scale. The dashed line marks |t| = 1.96, the shaded band is the estimation window, and the two red segments are the local-linear fits on each side of the cutoff. Dot size is proportional to the number of estimates in the bin.",
        interpretation:
          "The figure is a binned scatter of the first-stage residual against |t| on a log scale. Lower means more precise than sample size predicts. The dashed line marks |t| = 1.96, the shaded band is the estimation window, and the two red segments are the local-linear fits on each side of the cutoff; the vertical gap between them at the dashed line is the reported jump. Dot size is proportional to the number of estimates in the bin.",
      },
    },
  },
  waive: {
    dropdownLabel: "WAIVE (Experimental)",
    helpText: createElement(
      "span",
      null,
      "WAIVE downweights potentially p-hacked estimates using smooth exponential-decay weights, extending MAIVE’s correction for spurious precision. ",
      createElement(
        "a",
        {
          href: "https://meta-analysis.cz/waive_ottawa.pdf",
          target: "_blank",
          rel: "noopener noreferrer",
          className: "underline",
        },
        "Details on WAIVE are available here.",
      ),
    ),
    cautionNote: "WAIVE is experimental. Interpretation should be cautious.",
    runInfoLabel: "Experimental model (WAIVE)",
    runInfoValue: "Active",
  },
  compare: {
    // Badges on the run cards; the first-stage one is shown only for runs
    // that instrument (#575).
    firstStage: {
      log: "Log first stage",
      levels: "Levels first stage",
    },
  },
  results: RESULTS_TEXT,
  maiveModal: {
    title: "What is MAIVE?",
    description:
      "Adjust your meta-analysis for publication bias, p-hacking, and spurious precision using MAIVE. Explore the methodology and access the resources that power the estimator.",
    overview: {
      title: "Overview",
      text: `MAIVE (Meta-Analysis Instrumental Variable Estimator) adjusts for publication bias and p-hacking while correcting for “spurious precision”: over-optimistic standard errors that arise when researchers choose methods or models that under-report true uncertainty.
      By using an instrumental-variable based on the inverse sample size, MAIVE **reduces biases due to p-hacking** while leaving publication-bias corrections (e.g. PET-PEESE) intact.
      It is most useful for observational research, where standard errors are easiest to game and inverse-variance weights can back-fire. For experimental research, it presents a useful robustness check.`,
    },

    howItWorks: {
      title: "How MAIVE Works",
      text: [
        `**Step 1 (First stage).** Regress the *reported* variances on the inverse sample size: SE² = ψ₀ + ψ₁(1/N) + ν. This isolates the share of variance unlikely to be affected by p-hacking: artificially increasing sample size is harder than increasing precision.`,
        `**Step 2 (Second stage).** Replace each variance in your chosen funnel-plot model (PET, PEESE, PET-PEESE, EK) with the fitted value from Step 1 and **drop or adjust inverse-variance weights**. The resulting instrumental variable estimator is MAIVE.`,
        `**Step 3 (Inference).** Report a heteroskedasticity-robust standard error, the Anderson-Rubin confidence interval and the first-stage F statistic so users can judge instrument strength.`,
      ],
    },

    keyFeatures: {
      title: "Key Features",
      text: [
        {
          head: "Instrumental-Variable Correction",
          text: "Uses inverse sample size as a plausibly exogenous instrument for reported precision.",
        },
        {
          head: "Model Agnostic",
          text: "Works as a drop-in replacement for current meta-analysis models based on the funnel plot.",
        },
        {
          head: "Weak-Instrument Robust",
          text: "Built-in Anderson-Rubin intervals remain valid when the first-stage F statistic is small.",
        },
        {
          head: "Minimal Extra Data",
          text: "Needs only sample sizes, which most meta-analysts already collect.",
        },
        {
          head: "Bias Reduction",
          text: "Simulation and large-scale empirical evidence show that MAIVE adjusts for most bias arising from publication bias, p-hacking, and spurious precision.",
        },
      ],
    },

    applications: {
      title: "Applications",
      text: [
        {
          head: "Observational Evidence",
          text: "Economics, psychology, education, medical research: any field where research design can drive reported precision.",
        },
        {
          head: "Policy Analysis",
          text: "Give decision-makers bias-corrected effect sizes when evidence from randomized controlled experiments is scarce.",
        },
        {
          head: "Data-Quality Audits",
          text: "Flag clusters of spuriously precise results before they steer conclusions.",
        },
        {
          head: "Research Validation",
          text: "Compare meta-analytic estimates with multi-lab replications and gauge overstatement.",
        },
      ],
    },

    papersAndResources: {
      title: "Papers and Resources",
      maiveWebsite: {
        head: "MAIVE Website",
        text: "View the MAIVE website for more information about the estimator.",
        linkText: "View Website →",
      },
      maivePaper: {
        head: "MAIVE Paper",
        text: "Read the MAIVE paper for more information about the estimator.",
        linkText: "View Paper →",
      },
      maiveCRAN: {
        head: "MAIVE CRAN",
        text: "Install the stable MAIVE release from CRAN.",
        linkText: "View CRAN release →",
      },
      maiveCode: {
        head: "MAIVE Code",
        text: "View the MAIVE code for more information about the estimator.",
        linkText: "View Code →",
      },
    },

    gettingStarted: {
      title: "Getting Started",
      text: `Ready to correct your data for spurious precision? Upload your
    dataset and let MAIVE analyze it for you, or run a demo using a synthetic dataset. The process is simple
    and provides clear, actionable results.`,
    },
    uploadYourData: "Upload Your Data",
  },
} as const;

const getNonInstrumentingResultsText = (): ResultsText => {
  const { effectEstimate, publicationBias, funnelPlot } = RESULTS_TEXT;

  return {
    ...RESULTS_TEXT,
    effectEstimate: {
      ...effectEstimate,
      metrics: {
        ...effectEstimate.metrics,
        estimate: {
          ...effectEstimate.metrics.estimate,
          tooltip:
            "Point estimate of the effect size corrected for publication bias and p-hacking.",
        },
      },
    },
    publicationBias: {
      ...publicationBias,
      metrics: {
        ...publicationBias.metrics,
        eggerCoef: {
          ...publicationBias.metrics.eggerCoef,
          tooltip:
            "Coefficient capturing funnel asymmetry in the Egger regression.",
        },
        eggerSE: {
          ...publicationBias.metrics.eggerSE,
          tooltip:
            "Robust standard error of the coefficient capturing funnel asymmetry in the Egger regression.",
        },
        significance: {
          ...publicationBias.metrics.significance,
          tooltip:
            "Indicates whether publication bias is statistically significant at the 5% level according to the Egger test.",
        },
        eggerBootCI: {
          ...publicationBias.metrics.eggerBootCI,
          tooltip:
            "Bootstrap 95% confidence interval for the Egger coefficient from the regression without instrumenting.",
        },
        eggerAndersonRubinCI: {
          ...publicationBias.metrics.eggerAndersonRubinCI,
          tooltip:
            "Weak-instrument-robust 95% Anderson-Rubin confidence interval for the Egger coefficient when computed without instrumenting.",
        },
      },
    },
    funnelPlot: {
      ...funnelPlot,
      title: "Funnel Plot",
      tooltip:
        "Scatter of effect sizes against their standard errors. The plot includes 90%, 95%, and 99% confidence interval regions (shaded areas), with the solid line representing the regression fit. The estimate is the intercept of the line with the horizontal axis.",
    },
  };
};

export const getResultsText = (
  modelType: ModelParameters["modelType"],
  shouldUseInstrumenting: boolean,
  standardErrorTreatment: StandardErrorTreatment = "not_clustered",
): ResultsText => {
  const baseResultsText = shouldUseInstrumenting
    ? RESULTS_TEXT
    : getNonInstrumentingResultsText();

  const standardErrorTooltip =
    STANDARD_ERROR_TREATMENT_TOOLTIPS[standardErrorTreatment] ??
    STANDARD_ERROR_TREATMENT_TOOLTIPS.not_clustered;

  const isWaive = modelType === CONST.MODEL_TYPES.WAIVE;
  const isRtma = modelType === CONST.MODEL_TYPES.RTMA;
  const isRdt = modelType === CONST.MODEL_TYPES.RDT;

  let plotTitle: string;
  let plotTooltip: string;
  if (isRdt) {
    plotTitle = TEXT.rdt.results.plot.title;
    plotTooltip = TEXT.rdt.results.plot.tooltip;
  } else if (isRtma) {
    plotTitle = "Z-Score Distribution";
    plotTooltip =
      "Distribution of z-scores in the favored direction (estimate divided by standard error, sign-flipped when the favored direction is negative). The dashed vertical line marks the critical value; estimates with z above it are affirmative (significant in the favored direction). RTMA fits its model to the distribution of the not-affirmative estimates to correct for selection bias.";
  } else if (isWaive) {
    plotTitle = baseResultsText.funnelPlot.title.replace(/MAIVE/g, "WAIVE");
    plotTooltip = baseResultsText.funnelPlot.tooltip.replace(/MAIVE/g, "WAIVE");
  } else {
    plotTitle = baseResultsText.funnelPlot.title;
    plotTooltip = baseResultsText.funnelPlot.tooltip;
  }

  return {
    ...baseResultsText,
    effectEstimate: {
      ...baseResultsText.effectEstimate,
      metrics: {
        ...baseResultsText.effectEstimate.metrics,
        standardError: {
          ...baseResultsText.effectEstimate.metrics.standardError,
          tooltip: standardErrorTooltip,
        },
      },
    },
    funnelPlot: {
      ...baseResultsText.funnelPlot,
      title: plotTitle,
      tooltip: plotTooltip,
    },
  };
};

export default TEXT;
