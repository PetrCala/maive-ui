import CONST from "@src/CONST";
import type { ModelParameters } from "@src/types/api";

export const DEFAULT_MODEL_PARAMETERS: ModelParameters = {
  modelType: CONST.MODEL_TYPES.MAIVE,
  includeStudyDummies: false,
  includeStudyClustering: false,
  standardErrorTreatment: CONST.STANDARD_ERROR_TREATMENTS.CLUSTERED_CR2.VALUE,
  computeAndersonRubin: false,
  maiveMethod: CONST.MAIVE_METHODS.PET_PEESE,
  weight: CONST.WEIGHT_OPTIONS.EQUAL_WEIGHTS.VALUE,
  shouldUseInstrumenting: true,
};

// Advanced options that should trigger the advanced tab to be open
export const ADVANCED_OPTION_KEYS: Array<keyof ModelParameters> = [
  "maiveMethod",
  "weight",
  "includeStudyDummies",
  "shouldUseInstrumenting",
];
