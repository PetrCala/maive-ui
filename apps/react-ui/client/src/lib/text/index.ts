import CONST from "@src/CONST";
import type { ModelParameters } from "@src/types";

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
    firstStageFTest: MetricText;
    firstStageFTestLog: MetricText;
    firstStageSpecification: MetricText;
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
          "Weak-instrument-robust 95% Anderson-Rubin confidence interval for the effect; remains valid even when the first-stage F statistic is low.",
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
          "Weak-instrument-robust 95% Anderson-Rubin confidence interval for the Egger coefficient, matching the options used for the main estimate.",
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
      firstStageFTest: {
        label: "First-Stage F-Test",
        tooltip:
          "Heteroskedasticity-robust F statistic for the strength of the instrument (inverse sample size) in the levels first-stage regression of reported variances. Values above 10 denote a strong instrument.",
      },
      firstStageFTestLog: {
        label: "First-Stage F-Test (γ₁)",
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
  funnelPlot: {
    title: "MAIVE-Adjusted Funnel Plot",
    tooltip:
      "Scatter of effect sizes MAIVE-adjusted fitted precision.The plot includes 90%, 95%, and 99% confidence interval regions (shaded areas), with the solid line representing MAIVE fit. The MAIVE estimate is the intercept of the line with the horizontal axis.",
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
    viewPaper: "View full paper →",
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
        "Please include columns for **effect estimates**, **standard errors**, and **sample sizes** (study IDs are optional).",
      numberFormats:
        "Effect estimates and standard errors can include decimal points or commas—MAIVE will interpret both.",
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
      "Each column can only be mapped once. The Study ID field is optional — leave it blank if you don't have study-level clustering.",
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
        "Note that selecting standard weights and no instrumenting in Advanced Options allows you to run classical PET, PEESE, PET-PEESE, and EK.",
    },
    modelType: {
      label: "Model Type",
      tooltips: {
        MAIVE:
          "MAIVE: Meta-Analysis Instrumental Variable Estimator (Irsova et al., 2025, Nat Comms)",
        WAIVE:
          "WAIVE (Experimental): Weighted Adjustment Instrumental Variable Estimator (still under construction; corrects more aggressively for p-hacking)",
      } satisfies Record<ModelParameters["modelType"], string>,
    },
    includeStudyDummies: {
      label: "Fixed-Intercept Multilevel",
      tooltip:
        "Controls for within-study dependence by giving each study its own intercept. Accounts for unobserved study-level factors without requiring random-effects modeling.",
    },
    includeStudyClustering: {
      label: "Include Study Level Clustering",
      tooltip:
        "Whether to include study-level clustering in the analysis. If you data does not have a study ID column, this option will have no effect.",
    },
    standardErrorTreatment: {
      label: "Standard Error Treatment",
      tooltip:
        "The method to use for standard error treatment. Recommended options are bootstrap or CR2, which are robust to a small number of clusters.",
    },
    computeAndersonRubin: {
      label: "Compute Anderson-Rubin Confidence Interval",
      tooltip:
        "Whether to compute the Anderson-Rubin Confidence Interval, which is robust to weak instruments.",
      warning:
        "This option enables heavy computation and may significantly increase processing time.",
    },
    advancedOptions: {
      title: "Advanced Options",
    },
    maiveMethod: {
      label: "MAIVE Method",
      waiveLabel: "WAIVE Method",
      nonInstrumentingLabel: "Method",
      tooltip: "The correction method to use. PET-PEESE is the default.",
    },
    weight: {
      label: "Weighting",
      tooltip:
        "The weighting scheme to use in the analysis. Equal Weights: default, limiting case of a random-effects model with huge heterogeneity. Standard Weights: inverse-variance weights. Instrumented weights: MAIVE-adjusted inverse-variance weights.",
    },
    winsorize: {
      label: "Winsorization (%)",
      tooltip:
        "Limits the impact of extreme outliers by clipping values at symmetric percentile bounds. Choose the winsorization percentage (0–5%) to apply to effect sizes and standard errors.",
    },
    shouldUseInstrumenting: {
      label: "Use Instrumenting",
      tooltip:
        "Whether to use instrumenting in the analysis. When “No” is chosen, you can estimate classical (non-MAIVE) versions of PET, PEESE, PET-PEESE, and EK.",
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
        "Estimate the first-stage regression on log variances versus log sample size. Applies Duan smearing when transforming fitted variances back to levels.",
    },
    runModel: "Run Model",
  },
  waive: {
    dropdownLabel: "WAIVE (Experimental)",
    helpText:
      "WAIVE downweights likely p-hacked estimates using smooth exponential-decay weights, extending MAIVE’s correction for spurious precision.",
    cautionNote: "WAIVE is experimental. Interpretation should be cautious.",
    runInfoLabel: "Experimental model (WAIVE)",
    runInfoValue: "Active",
  },
  results: RESULTS_TEXT,
  maiveModal: {
    title: "What is MAIVE?",
    description:
      "Adjust your meta-analysis for publication bias, p-hacking, and spurious precision using MAIVE. Explore the methodology and access the resources that power the estimator.",
    overview: {
      title: "Overview",
      text: `MAIVE (Meta-Analysis Instrumental Variable Estimator) adjusts for publication bias and p-hacking while correcting for “spurious precision” — over-optimistic standard errors that arise when researchers choose methods or models that under-report true uncertainty.
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
          text: "Economics, psychology, education, medical research — any field where research design can drive reported precision.",
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
  const funnelTitle = isWaive
    ? baseResultsText.funnelPlot.title.replace(/MAIVE/g, "WAIVE")
    : baseResultsText.funnelPlot.title;
  const funnelTooltip = isWaive
    ? baseResultsText.funnelPlot.tooltip.replace(/MAIVE/g, "WAIVE")
    : baseResultsText.funnelPlot.tooltip;

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
      title: funnelTitle,
      tooltip: funnelTooltip,
    },
  };
};

export default TEXT;
