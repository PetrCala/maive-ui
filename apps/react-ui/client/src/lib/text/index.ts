type MetricText = Readonly<{
  label: string;
  tooltip: string;
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
    pValue: MetricText;
    eggerCoef: MetricText;
    eggerSE: MetricText;
    significance: MetricText;
  }>;
  diagnosticTests: SectionWithMetrics<{
    hausmanTest: MetricText;
    hausmanCriticalValue: MetricText;
    firstStageFTest: MetricText;
  }>;
  funnelPlot: Readonly<{
    title: string;
    tooltip: string;
  }>;
}>;

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
        tooltip: "Heteroskedasticity-robust standard error.",
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
      pValue: {
        label: "Egger Test p-value",
        tooltip:
          "p-value from the instrumented FAT-PET regression that tests for publication bias / p-hacking after MAIVE adjustment.",
      },
      eggerCoef: {
        label: "Egger Coefficient",
        tooltip:
          "Coefficient capturing funnel asymmetry in the instrumented Egger regression.",
      },
      eggerSE: {
        label: "Standard Error of the Egger Coefficient",
        tooltip:
          "Robust standard error of the coefficient capturing funnel asymmetry in the instrumented Egger regression.",
      },
      significance: {
        label: "Egger Test Significant at 5% level",
        tooltip:
          "Indicates whether publication bias is statistically significant at the 5% level according to the instrumented FAT test.",
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
          "Heteroskedasticity-robust F statistic for the strength of the instrument (inverse sample size) in the first-stage regression of reported variances. Values above 10 denote a strong instrument.",
      },
    },
  },
  funnelPlot: {
    title: "MAIVE-Adjusted Funnel Plot",
    tooltip:
      "Scatter of effect sizes MAIVE-adjusted fitted precision.The plot includes 90%, 95%, and 99% confidence interval regions (shaded areas), with the solid line representing MAIVE fit. The MAIVE estimate is the intercept of the line with the horizontal axis.",
  },
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
      columnOrder:
        "**Column order determines what each column represents** - headers are optional.",
      requiredColumns:
        "**First 3 columns** (in order): effect estimates, standard errors, sample sizes.",
      optionalColumns:
        "**4th column (optional)**: study ID. Recommended when some studies report more than one estimate.",
      noAdditionalColumns: "**No additional columns** are allowed.",
      effectColumn:
        "The **1st column** represents effect estimates (standardized effects or regression coefficients). It must contain only numbers.",
      seColumn:
        "The **2nd column** represents standard errors. It must contain only numbers.",
      nObsColumn:
        "The **3rd column** represents the sample size. It must contain only numbers.",
      studyIdColumn:
        "The **4th column** (if present) represents study IDs. It can contain strings or numbers.",
      // Keep these two commented out for now, as the upload page gets a little overwhelming with all the requirements.
      // minimumRows:
      //   "The file must contain at least 4 rows of data (excluding headers if present).",
      // minimumObservations:
      //   "If a study ID column is present, the number of rows must be larger than the number of unique study IDs plus 3 to ensure enough degrees of freedom for distribution functions.",
    },
  },
  model: {
    basicOptions: {
      bottomText:
        "Note that selecting standard weights and no instrumenting in Advanced Options allows you to run classical PET, PEESE, PET-PEESE, and EK.",
    },
    modelType: {
      label: "Model Type",
      tooltip:
        "The type of model to use for the analysis. By selecting standard weights and no instrumenting in advanced options you can use this UI to run classical PET, PEESE, PET-PEESE, and EK.",
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
      tooltip: "The correction method to use. PET-PEESE is the default.",
    },
    weight: {
      label: "Weighting",
      tooltip:
        "The weighting scheme to use in the analysis. Equal Weights: default, limiting case of a random-effects model with huge heterogeneity. Standard Weights: inverse-variance weights. Instrumented weights: MAIVE-adjusted inverse-variance weights.",
    },
    shouldUseInstrumenting: {
      label: "Use Instrumenting",
      tooltip:
        "Whether to use instrumenting in the analysis. When “No” is chosen, you can estimate classical (non-MAIVE) versions of PET, PEESE, PET-PEESE, and EK.",
    },
    runModel: "Run Model",
  },
  results: RESULTS_TEXT,
  maiveModal: {
    title: "What is MAIVE?",
    overview: {
      title: "Overview",
      text: `MAIVE (Meta-Analysis Instrumental Variable Estimator) adjusts for publication bias and p-hacking while correcting for “spurious precision” — over-optimistic standard errors that arise when researchers choose methods or models that under-report uncertainty.
      By using an instrumental-variables adjustment based on the inverse sample size, MAIVE **reduces biases due to p-hacking** while leaving publication-bias corrections (e.g. PET-PEESE) intact.
      It is most useful for observational research, where standard errors are easiest to game and inverse-variance weights can back-fire.`,
    },

    howItWorks: {
      title: "How MAIVE Works",
      text: [
        `**Step 1 (First stage).** Regress the *reported* variances on the inverse sample size: SE² = ψ₀ + ψ₁(1/N) + ν. This isolates the share of variance that is not affected by p-hacking.`,
        `**Step 2 (Second stage).** Replace each variance in your chosen funnel-plot model (PET, PEESE, PET-PEESE, EK) with the fitted value from Step 1 and **drop or adjust inverse-variance weights**. The resulting IV estimator is MAIVE.`,
        `**Step 3 (Inference).** Report a heteroskedasticity-robust standard error, the Anderson-Rubin confidence interval (valid even when the first-stage F < 10), and the first-stage F statistic so users can judge instrument strength.`,
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
          text: "Simulation and large-scale evidence show that MAIVE adjusts for most bias arising from publication bias, p-hacking, and spurious precision.",
        },
      ],
    },

    applications: {
      title: "Applications",
      text: [
        {
          head: "Research Validation",
          text: "Compare meta-analytic estimates with multi-lab replications and gauge over-statement.",
        },
        {
          head: "Observational Evidence",
          text: "Economics, psychology, education, medical research - any field where sampling decisions are complex.",
        },
        {
          head: "Policy Analysis",
          text: "Give decision-makers bias-corrected effect sizes when randomized evidence is scarce.",
        },
        {
          head: "Data-Quality Audits",
          text: "Flag clusters of spuriously precise results before they steer conclusions.",
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
    dataset and let MAIVE analyze it for you, or run a demo using a synthetic dataset. In any case, the process is simple
    and provides clear, actionable results.`,
    },
    uploadYourData: "Upload Your Data",
  },
} as const;

export const getResultsText = (
  shouldUseInstrumenting: boolean,
): ResultsText => {
  if (shouldUseInstrumenting) {
    return RESULTS_TEXT;
  }

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
        pValue: {
          ...publicationBias.metrics.pValue,
          tooltip:
            "p-value from the Egger regression that tests for publication bias or p-hacking.",
        },
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

export default TEXT;
