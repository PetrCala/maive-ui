import CONST from "@src/CONST"
import { DeepValueOf } from "@src/types"

type EstimateType = DeepValueOf<typeof CONST.MODEL_TYPES> | "Unknown";

export const RESULTS_CONFIG = {
	effectEstimate: {
		title: "Effect Estimate",
		metrics: {
			estimate: {
				label: "Estimate",
				tooltip: (estimateType: EstimateType) =>
					`The estimated causal effect of the treatment variable on the outcome variable. This is the main result of the ${estimateType} analysis.`,
			},
			standardError: {
				label: "Standard Error",
				tooltip:
					"A measure of the uncertainty in the effect estimate. Smaller values indicate more precise estimates.",
			},
			significance: {
				label: "Significant at 5% level",
				tooltip:
					"Indicates whether the effect is statistically significant at the 5% level. A significant result suggests the effect is unlikely to be due to chance.",
			},
			andersonRubinCI: {
				label: "Anderson-Rubin 95% CI",
				tooltip:
					"A confidence interval that is robust to weak instruments. Provides a range of plausible values for the true effect.",
			},
		},
	},
	publicationBias: {
		title: "Publication Bias Analysis",
		metrics: {
			pValue: {
				label: "p-value",
				tooltip:
					"The p-value of the test for publication bias / p-hacking based on instrumented FAT. Values below 0.05 suggest publication bias / p-hacking.",
			},
			significance: {
				label: "Significant at 5% level",
				tooltip:
					"Indicates whether publication bias is statistically significant. A significant result suggests systematic bias in the literature.",
			},
		},
	},
	diagnosticTests: {
		title: "Diagnostic Tests",
		metrics: {
			hausmanTest: {
				label: "Hausman Test",
				tooltip:
					"Tests whether the instrumental variables estimator is consistent. Rejecting the null suggests the IV estimator is preferred over OLS.",
			},
			hausmanCriticalValue: {
				label: "Hausman Test Critical Value",
				tooltip:
					"The critical value for the Hausman test at the 5% significance level. Used to determine whether to reject the null hypothesis.",
			},
			firstStageFTest: {
				label: "First Stage F-Test",
				tooltip:
					"Tests the strength of the instruments. Values above 10 suggest strong instruments, while values below 10 indicate weak instruments.",
			},
		},
	},
	funnelPlot: {
		title: "Funnel Plot",
		tooltip:
			"A visual representation of the relationship between effect sizes and their precision. Used to detect publication bias and assess the overall evidence.",
	},
} as const
