import CONST from "@src/CONST";
import type {
  RTMADiagnostics,
  RTMAParameterDiagnostic,
  RTMAResults,
} from "@src/types/api";

const THRESHOLDS = CONST.RTMA_DIAGNOSTICS;

/** Label for each diagnostic parameter, matching the results summary metrics */
const PARAMETER_LABELS = {
  mu: "μ",
  tau: "τ",
} as const;

type DiagnosticParameter = keyof typeof PARAMETER_LABELS;

const PARAMETERS: DiagnosticParameter[] = ["mu", "tau"];

/**
 * Whether a diagnostic the backend reports as `null` is present at all.
 *
 * `null` means the backend could not read that number off the fit, which is
 * not the same as the fit being healthy, so every check below has to treat it
 * as "no evidence" rather than "no problem".
 */
const isReported = (value: number | null | undefined): value is number =>
  typeof value === "number" && Number.isFinite(value);

/** Format an R-hat for display; 3 decimals is enough to see the 1.01 line */
export const formatRHat = (value: number | null | undefined): string =>
  isReported(value) ? value.toFixed(3) : "Not reported";

/** Format an effective sample size for display; the fraction is never useful */
export const formatNEff = (value: number | null | undefined): string =>
  isReported(value) ? Math.round(value).toLocaleString() : "Not reported";

/** Format a divergent-transition count for display */
export const formatDivergences = (value: number | null | undefined): string =>
  isReported(value) ? String(Math.round(value)) : "Not reported";

/** Format the optimiser convergence flag for display */
export const formatOptimConverged = (
  value: boolean | null | undefined,
): string => {
  if (value === true) {
    return "Yes";
  }
  if (value === false) {
    return "No";
  }
  return "Not reported";
};

/**
 * Whether the reported mode should be treated as a usable point estimate.
 *
 * The mode comes from a separate `mle_params()` optimisation rather than from
 * the sampler, so when that optimisation fails the mode is meaningless even
 * though the credible interval next to it is perfectly sound.
 */
export const isRtmaModeUnreliable = (results: RTMAResults): boolean =>
  results.diagnostics?.optimConverged === false;

/** Whether a run carries a diagnostics block at all (runs before #480 do not) */
export const hasRtmaDiagnostics = (
  results: RTMAResults,
): results is RTMAResults & { diagnostics: RTMADiagnostics } =>
  results.diagnostics != null;

/**
 * List the parameters whose diagnostic value fails a threshold, formatted for
 * a sentence: "**1.043** for μ and **1.021** for τ".
 */
const describeOffenders = (
  diagnostic: RTMAParameterDiagnostic,
  fails: (value: number) => boolean,
  format: (value: number) => string,
): string | null => {
  const offenders = PARAMETERS.flatMap((parameter) => {
    const value = diagnostic[parameter];
    if (!isReported(value) || !fails(value)) {
      return [];
    }
    return [`**${format(value)}** for ${PARAMETER_LABELS[parameter]}`];
  });

  if (offenders.length === 0) {
    return null;
  }
  return offenders.join(" and ");
};

/**
 * Build the warnings the results page shows for an RTMA fit.
 *
 * These are generated in the UI rather than appended to the backend's own
 * `warnings` array so that the API keeps reporting only conditions raised
 * while fitting, and so the thresholds stay adjustable without a redeploy of
 * the R backend.
 *
 * @param results - RTMA results, with or without a diagnostics block
 * @returns Warning messages, most consequential first
 */
export const getRtmaDiagnosticWarnings = (results: RTMAResults): string[] => {
  const warnings: string[] = [];
  const diagnostics = results.diagnostics;

  if (diagnostics?.optimConverged === false) {
    warnings.push(
      "**The optimisation behind the reported mode did not converge.** The mode is what RTMA normally reports as the corrected effect, so that point estimate is not usable for this run. The credible intervals are posterior quantiles and are unaffected, so read those instead, and rerun with a different seed to see whether the optimisation settles.",
    );
  }

  const divergences = diagnostics?.divergences;
  if (isReported(divergences) && divergences > 0) {
    const count = Math.round(divergences);
    warnings.push(
      `The sampler reported **${count} divergent ${count === 1 ? "transition" : "transitions"}**, so it could not explore part of the posterior. The credible intervals can be biased even though the numbers themselves look ordinary.`,
    );
  }

  if (diagnostics) {
    const rHatOffenders = describeOffenders(
      diagnostics.rHat,
      (value) => value > THRESHOLDS.MAX_R_HAT,
      (value) => value.toFixed(3),
    );
    if (rHatOffenders) {
      warnings.push(
        `R-hat is ${rHatOffenders}, above the ${THRESHOLDS.MAX_R_HAT} convergence threshold. The chains did not settle on the same distribution, so neither the estimates nor the intervals are trustworthy yet.`,
      );
    }

    const nEffOffenders = describeOffenders(
      diagnostics.nEff,
      (value) => value < THRESHOLDS.MIN_N_EFF,
      (value) => Math.round(value).toLocaleString(),
    );
    if (nEffOffenders) {
      warnings.push(
        `The effective sample size is ${nEffOffenders}, below the ${THRESHOLDS.MIN_N_EFF.toLocaleString()} draws this fit should reach. The posterior summaries rest on few effectively independent draws and may be unreliable.`,
      );
    }
  }

  if (
    typeof results.nonaffirmativeCount === "number" &&
    results.nonaffirmativeCount > 0 &&
    results.nonaffirmativeCount < THRESHOLDS.MIN_NONAFFIRMATIVE_COUNT
  ) {
    warnings.push(
      `RTMA was fitted to only **${results.nonaffirmativeCount} not-affirmative ${results.nonaffirmativeCount === 1 ? "estimate" : "estimates"}**. That is the entire sample the correction has to work from, so treat the corrected effect as indicative at best.`,
    );
  }

  return warnings;
};
