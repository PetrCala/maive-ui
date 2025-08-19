import CONST from "@src/CONST";
import DeepValueOf from "./DeepValueOf";

/** A type of the results main estimate value. This is used to determine which model was used to produce the main estimate. */
type EstimateType = DeepValueOf<typeof CONST.MODEL_TYPES> | "Unknown";

export type { DeepValueOf, EstimateType };
