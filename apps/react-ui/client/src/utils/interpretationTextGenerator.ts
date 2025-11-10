/**
 * Interpretation Text Generator
 *
 * Generates dynamic interpretation text for MAIVE analysis results based on
 * model parameters and statistical results.
 */

import CONST from "@src/CONST";
import type { ModelParameters, ModelResults } from "@src/types";

/**
 * Computes 95% confidence interval from estimate and standard error
 */
export function computeConfidenceInterval(
  estimate: number,
  se: number,
): [number, number] {
  const margin = 1.96 * se;
  return [estimate - margin, estimate + margin];
}

/**
 * Checks if estimate is statistically significant at 5% level
 */
export function isSignificant(estimate: number, se: number): boolean {
  return Math.abs(estimate / se) >= 1.96;
}

/**
 * Determines instrument strength based on F-statistic
 * @returns "weak" if F < 10, "strong" if F >= 10
 */
export function getInstrumentStrength(fStat: number | "NA"): "weak" | "strong" {
  if (fStat === "NA" || fStat < 10) {
    return "weak";
  }
  return "strong";
}

/**
 * Determines spurious precision evidence strength based on Hausman test
 * @returns "strong" if rejects null, "moderate" otherwise
 */
export function getSpuriousPrecisionEvidence(
  rejectsNull: boolean,
): "strong" | "moderate" {
  return rejectsNull ? "strong" : "moderate";
}

/**
 * Checks if Hausman test is NA (undefined)
 */
export function isHausmanTestNA(hausmanTest: {
  statistic: number;
  criticalValue: number;
  rejectsNull: boolean;
}): boolean {
  // If statistic is NaN, Infinity, or critical value is NaN/Infinity, treat as NA
  return (
    !Number.isFinite(hausmanTest.statistic) ||
    !Number.isFinite(hausmanTest.criticalValue) ||
    Number.isNaN(hausmanTest.statistic) ||
    Number.isNaN(hausmanTest.criticalValue)
  );
}

/**
 * Formats a number to 2 decimal places
 */
export function formatNumber(value: number): string {
  return value.toFixed(2);
}

/**
 * Generates interpretation text for the Effect Estimate section
 */
export function generateEffectInterpretation(
  results: ModelResults,
  parameters: ModelParameters,
  simpleMean?: number,
): string {
  const { effectEstimate, standardError } = results;
  const { modelType } = parameters;

  const [ciLower, ciUpper] = computeConfidenceInterval(
    effectEstimate,
    standardError,
  );
  const significant = isSignificant(effectEstimate, standardError);

  const prefix = `Using ${modelType}, the`;
  const significanceText = significant
    ? "statistically different from zero"
    : "not different from zero";

  let text = `${prefix} bias-corrected mean effect is ${formatNumber(effectEstimate)} (95% CI ${formatNumber(ciLower)}, ${formatNumber(ciUpper)}), ${significanceText} at the 5% level.`;

  // Add simple mean comparison if available
  if (simpleMean !== undefined && !Number.isNaN(simpleMean)) {
    text += ` For comparison, the simple mean of reported estimates is ${formatNumber(simpleMean)}.`;
  }

  return text;
}

/**
 * Generates interpretation text for the Publication Bias section
 */
export function generateBiasInterpretation(
  results: ModelResults,
  parameters: ModelParameters,
): string {
  const { publicationBias } = results;
  const { shouldUseInstrumenting } = parameters;

  const { eggerCoef, eggerSE } = publicationBias;
  const [ciLower, ciUpper] = computeConfidenceInterval(eggerCoef, eggerSE);

  // Check if CI excludes 0
  const excludesZero = ciLower > 0 || ciUpper < 0;
  const evidenceText = excludesZero
    ? "find evidence of substantial"
    : "do not find evidence of substantial";
  const ciText = excludesZero ? "excludes" : "includes";

  const biasType = shouldUseInstrumenting
    ? "publication bias or p-hacking"
    : "publication bias";
  const eggerType = shouldUseInstrumenting ? "instrumented Egger" : "Egger";

  return `We ${evidenceText} ${biasType} (${eggerType} 95% CI ${ciText} 0).`;
}

/**
 * Generates interpretation text for the Diagnostic Tests section
 */
export function generateTestsInterpretation(
  results: ModelResults,
  parameters: ModelParameters,
): string {
  const { firstStageFStatistic, hausmanTest } = results;
  const {
    shouldUseInstrumenting,
    useLogFirstStage,
    modelType,
    includeStudyDummies,
  } = parameters;

  // Only generate if instrumenting is used
  if (!shouldUseInstrumenting) {
    return "";
  }

  const sentences: string[] = [];

  // First-stage F-statistic sentence
  if (firstStageFStatistic !== "NA") {
    const strength = getInstrumentStrength(firstStageFStatistic);
    const strengthText = strength === "weak" ? "weak" : "strong";
    const ciRequirement =
      strength === "weak" ? "required" : "optional but recommended";

    sentences.push(
      `The instrument is ${strengthText} (first-stage F-statistic = ${formatNumber(firstStageFStatistic)}), implying that the Anderson–Rubin confidence interval is ${ciRequirement}.`,
    );
  }

  // Hausman test sentence - only show for MAIVE (not WAIVE) and when not using fixed intercepts
  const isWaive = modelType === CONST.MODEL_TYPES.WAIVE;
  const hasFixedIntercept = includeStudyDummies ?? false;
  const shouldShowHausman = !isWaive && !hasFixedIntercept;

  if (shouldShowHausman) {
    const hausmanNA = isHausmanTestNA(hausmanTest);
    if (hausmanNA) {
      sentences.push(
        "The Hausman test is undefined because IV variance < OLS variance — estimators are nearly identical, so this test is not informative.",
      );
    } else {
      const { rejectsNull } = hausmanTest;
      const rejectText = rejectsNull ? "rejects" : "does not reject";
      const evidenceStrength = getSpuriousPrecisionEvidence(rejectsNull);

      sentences.push(
        `The Hausman test ${rejectText} equality of OLS and IV, indicating that evidence of spurious precision is ${evidenceStrength}.`,
      );
    }
  }

  // Logs recommendation sentence (only if F < 30 AND not using logs)
  if (
    firstStageFStatistic !== "NA" &&
    firstStageFStatistic < 30 &&
    !useLogFirstStage
  ) {
    sentences.push(
      "Because the first-stage F-statistic < 30, running the first stage in logs is recommended.",
    );
  }

  return sentences.join(" ");
}

/**
 * Generates complete interpretation text combining all sections
 */
export function generateCompleteInterpretation(
  results: ModelResults,
  parameters: ModelParameters,
  simpleMean?: number,
): string {
  const effectText = generateEffectInterpretation(
    results,
    parameters,
    simpleMean,
  );
  const biasText = generateBiasInterpretation(results, parameters);
  const testsText = generateTestsInterpretation(results, parameters);

  const parts = [effectText, biasText];
  if (testsText) {
    parts.push(testsText);
  }

  return parts.join(" ");
}

/**
 * Section-specific interpretation generators
 */
export const interpretationGenerators = {
  effect: generateEffectInterpretation,
  bias: generateBiasInterpretation,
  tests: generateTestsInterpretation,
  complete: generateCompleteInterpretation,
} as const;

export type InterpretationSection = keyof typeof interpretationGenerators;
