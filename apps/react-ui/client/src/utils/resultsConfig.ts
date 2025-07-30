import type { EstimateType } from "@src/types"
import CONST from "@src/CONST"


export const RESULTS_CONFIG = {
  effectEstimate: {
    title: "Effect Estimate",
    metrics: {
      estimate: {
        label: "Estimate",
        tooltip: (estimateType: EstimateType): string => {
					// This is an example of how different models may be handled in the future, once WAIVE is implemented.
					// For now, we only use MAIVE.
					const desc: Record<EstimateType, string> = {
						[CONST.MODEL_TYPES.MAIVE]: "Point estimate of the average causal effect obtained with the MAIVE instrumental-variable estimator.",
						[CONST.MODEL_TYPES.WAIVE]: "Point estimate of the average causal effect obtained with the WAIVE estimator.", // subject to change
						"Unknown": "Point estimate of the average causal effect produced by the selected meta-analysis method.",
					}
					return desc[estimateType] ?? desc.Unknown
				}
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
          "p-value from the instrumented FAT (Egger) regression that tests for publication bias / p-hacking after MAIVE adjustment.",
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
} as const
