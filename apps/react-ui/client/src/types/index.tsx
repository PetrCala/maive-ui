import CONST from "@src/CONST";
import DeepValueOf from "./DeepValueOf";

/**
 * Parameters for running the MAIVE model
 */
interface ModelParameters {
  modelType: DeepValueOf<typeof CONST.MODEL_TYPES>;
  includeStudyDummies: boolean;
  includeStudyClustering: boolean;
  standardErrorTreatment: (typeof CONST.STANDARD_ERROR_TREATMENTS)[keyof typeof CONST.STANDARD_ERROR_TREATMENTS]["VALUE"];
  computeAndersonRubin: boolean;
  maiveMethod: DeepValueOf<typeof CONST.MAIVE_METHODS>;
  shouldUseInstrumenting: boolean;
}

/** A type of the results main estimate value. This is used to determine which model was used to produce the main estimate. */
type EstimateType = DeepValueOf<typeof CONST.MODEL_TYPES> | "Unknown";

export type { ModelParameters, DeepValueOf, EstimateType };
