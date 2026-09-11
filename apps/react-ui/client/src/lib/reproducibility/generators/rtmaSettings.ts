/**
 * The settings an exported RTMA script runs with, in one place for the
 * script, the README, the version manifest and parameters.json.
 */

import { RTMA_DEFAULTS } from "@src/lib/parameterResolver";
import type { ModelParameters } from "@src/types/api";

/**
 * Selection threshold and interval level of every exported RTMA script. The
 * app's RTMA runs use the resolver defaults, and the results page does not
 * carry either value, so the script writes these.
 */
export const RTMA_ALPHA_SELECT = RTMA_DEFAULTS.alphaSelect;
export const RTMA_CI_LEVEL = RTMA_DEFAULTS.ciLevel;

/**
 * Seed written into an RTMA script when the run itself carries none.
 *
 * Mirrors RTMA_DEFAULT_SEED in apps/lambda-r-backend/r_scripts/rtma_model.R.
 * Only reached for runs stored before the backend pinned a seed (#479); those
 * numbers cannot be reproduced by any seed, so the script says so rather than
 * pretending this one recreates them.
 */
export const RTMA_FALLBACK_SEED = 2025;

/** parameters.json for an RTMA package: the RTMA keys, nothing else */
export type RtmaPackageParameters = {
  modelType: "RTMA";
  favorPositive: boolean;
  alphaSelect: number;
  ciLevel: number;
  winsorize: number;
  seed: number;
};

/**
 * The parameters an RTMA script runs with, as written to parameters.json.
 *
 * The results page carries an RTMA run in its MAIVE-shaped parameter object
 * (toPageParameters), so the MAIVE keys there (method, weights, first stage,
 * clustering) are page defaults the run never used and must not be exported.
 *
 * @param rtmaSeed - Seed the sampler ran under, or null when the run recorded
 *   none (the script then falls back to RTMA_FALLBACK_SEED)
 */
export function rtmaPackageParameters(
  parameters: ModelParameters,
  rtmaSeed: number | null,
): RtmaPackageParameters {
  return {
    modelType: "RTMA",
    favorPositive: parameters.favorPositive,
    alphaSelect: RTMA_ALPHA_SELECT,
    ciLevel: RTMA_CI_LEVEL,
    winsorize: parameters.winsorize,
    seed: rtmaSeed ?? RTMA_FALLBACK_SEED,
  };
}
