import type { EstimateType } from "@src/types";
import CONST from "@src/CONST";

const TEXT = {
  common: {
    close: "Close",
  },
  upload: {
    title: "Upload Your Data",
    description:
      "Please ensure your data file meets the following requirements:",
    requirements: {
      fileFormat:
        "The file must be in **.xlsx**, **.xls**, or **.csv** format.",
      firstRowHeaders: "The **first row** should contain column headers.",
      requiredColumns: "Required columns: **effect**, **se**, **n_obs**.",
      optionalColumns: "Optional columns: **study_id**.",
      noAdditionalColumns: "**No additional columns** are allowed.",
      effectColumn:
        "The **effect** column represents the effect estimate. It must contain only numbers.",
      seColumn:
        "The **se** column represents the standard error. It must contain only numbers.",
      nObsColumn:
        "The **n_obs** column represents the number of observations. It must contain only numbers.",
      studyIdColumn:
        "The **study_id** column represents the study ID. It can contain strings or numbers.",
    },
  },
  model: {
    modelType: {
      label: "Model Type",
      tooltip: "The type of model to use for the analysis.",
    },
    includeStudyDummies: {
      label: "Include Study Level Fixed Effects",
      tooltip: "Whether to include study-level fixed effects in the analysis.",
    },
    includeStudyClustering: {
      label: "Include Study Level Clustering",
      tooltip: "Whether to include study-level clustering in the analysis.",
    },
    standardErrorTreatment: {
      label: "Standard Error Treatment",
      tooltip: "The method to use for standard error treatment.",
    },
    computeAndersonRubin: {
      label: "Compute Anderson-Rubin Confidence Interval",
      tooltip: "Whether to compute the Anderson-Rubin confidence interval.",
      warning:
        "This option enables heavy computation and may significantly increase processing time.",
    },
    advancedOptions: {
      title: "Advanced Options",
    },
    maiveMethod: {
      label: "MAIVE Method",
      tooltip: "The method to use for the MAIVE analysis.",
    },
    shouldUseInstrumenting: {
      label: "Use Instrumenting",
      tooltip: "Whether to use instrumenting in the analysis.",
    },
    runModel: "Run Model",
  },
  results: {
    effectEstimate: {
      title: "Effect Estimate",
      metrics: {
        estimate: {
          label: "Estimate",
          tooltip: (estimateType: EstimateType): string => {
            // This is an example of how different models may be handled in the future, once WAIVE is implemented.
            // For now, we only use MAIVE.
            const desc: Record<EstimateType, string> = {
              [CONST.MODEL_TYPES.MAIVE]:
                "Point estimate of the average causal effect obtained with the MAIVE instrumental-variable estimator.",
              [CONST.MODEL_TYPES.WAIVE]:
                "Point estimate of the average causal effect obtained with the WAIVE estimator.", // subject to change
              Unknown:
                "Point estimate of the average causal effect produced by the selected meta-analysis method.",
            };
            return desc[estimateType] ?? desc.Unknown;
          },
        },
        standardError: {
          label: "Standard Error",
          tooltip: (estimateType: EstimateType) =>
            // An example of a simpler way of handling dynamic input
            `Heteroskedasticity-robust standard error of the ${estimateType} effect estimate, obtained from the two-stage (sample-size-instrumented) procedure.`,
        },
        significance: {
          label: "Significant at 5% level",
          tooltip:
            "Shows whether the null hypothesis of no effect is rejected at the 5% (two-sided) level using the robust standard error above.",
        },
        andersonRubinCI: {
          label: "Anderson-Rubin 95% CI",
          tooltip:
            "Weak-instrument-robust 95% Anderson-Rubin confidence interval for the effect; remains valid even when the first-stage F statistic is low.",
        },
      },
    },

    publicationBias: {
      title: "Publication Bias Analysis",
      metrics: {
        pValue: {
          label: "p-value",
          tooltip:
            "p-value from the instrumented FAT-PET regression that tests for publication bias / p-hacking after MAIVE adjustment.",
        },
        significance: {
          label: "Significant at 5% level",
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
      title: "Funnel Plot",
      tooltip:
        "Scatter of MAIVE-adjusted effect sizes against fitted precision; used to visualise heterogeneity and detect residual publication bias.",
    },
  },
  maiveModal: {
    title: "What is MAIVE?",
    overview: {
      title: "Overview",
      text: `MAIVE (Meta-Analysis Instrumental Variable Estimator) corrects “spurious precision” — over-optimistic standard errors that arise when researchers choose methods or models that under-report uncertainty.
      By using an instrumental-variables adjustment based on the inverse sample size, MAIVE typically **reduces meta-analytic bias** while leaving publication-bias corrections (e.g. PET-PEESE) intact.
      It is most useful for observational research, where standard errors are easiest to game and inverse-variance weights can back-fire.`,
    },

    howItWorks: {
      title: "How MAIVE Works",
      text: [
        `**Step 1 (First stage).** Regress the *reported* variances on the inverse sample size: SE² = ψ₀ + ψ₁(1/N) + ν. This isolates the share of variance that honest sampling theory can explain.`,
        `**Step 2 (Second stage).** Replace each variance in your chosen funnel-plot model (PET, PEESE, PET-PEESE, EK, …) with the fitted value from Step 1 and **drop inverse- variance weights**. The resulting IV estimator is MAIVE.`,
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
          text: "Works as a drop-in replacement for PET-PEESE, EK, WAIVE, Trim-&-Fill, selection models, or even a simple mean.",
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
          text: "Simulation and large-scale evidence show MAIVE pulls exaggerated effects toward zero in at least 70% of cases when F > 100.",
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
          text: "Economics, psychology, education, sociology - any field where sampling decisions are complex.",
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
      text: `Ready to check your data for spurious precision? Upload your
    dataset and let MAIVE analyze it for you. The process is simple
    and provides clear, actionable results.`,
    },
    uploadYourData: "Upload Your Data",
  },
} as const;

export default TEXT;
