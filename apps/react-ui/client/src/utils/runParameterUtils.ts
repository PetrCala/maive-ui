import type { ModelParameters } from "@src/types";
import CONFIG from "@src/CONFIG";
import CONST from "@src/CONST";

/**
 * Rebuild a full `ModelParameters` from the JSON string a run carries around
 * (the results page reads it from the URL, the runs list stores it per entry).
 *
 * `shouldUseInstrumenting` is not stored independently of `modelType`: it is
 * derived, because the two would otherwise be able to disagree. A stored
 * `shouldUseInstrumenting: false` on a non-WAIVE, non-RTMA run is how a WLS run
 * is recorded, so it is read back as WLS rather than as the model type that
 * happens to sit in the object.
 *
 * Unparseable input falls back to the defaults rather than throwing, so one bad
 * entry cannot take down a page that renders several runs at once.
 *
 * @param parameters JSON-stringified parameters, or null when absent
 * @returns Fully populated parameters with the instrumenting flag derived
 */
export const parseRunParameters = (
  parameters: string | null | undefined,
): ModelParameters => {
  let parsedJson: Partial<ModelParameters> = {};
  if (parameters) {
    try {
      const parsed = JSON.parse(parameters) as unknown;
      if (parsed && typeof parsed === "object") {
        parsedJson = parsed as Partial<ModelParameters>;
      }
    } catch (error) {
      console.error("Failed to parse model parameters:", error);
    }
  }

  const resolved: ModelParameters = {
    ...CONFIG.DEFAULT_MODEL_PARAMETERS,
    ...parsedJson,
  };

  if (
    resolved.shouldUseInstrumenting === false &&
    resolved.modelType !== CONST.MODEL_TYPES.WAIVE &&
    resolved.modelType !== CONST.MODEL_TYPES.RTMA
  ) {
    resolved.modelType = CONST.MODEL_TYPES.WLS;
  }

  resolved.shouldUseInstrumenting = !(
    resolved.modelType === CONST.MODEL_TYPES.WLS ||
    resolved.modelType === CONST.MODEL_TYPES.RTMA
  );

  return resolved;
};
