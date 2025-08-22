import type CONST from "@src/CONST";
import type DeepValueOf from "./DeepValueOf";
import type RuntimeConfig from "./RuntimeConfig";

/** A type of the results main estimate value. This is used to determine which model was used to produce the main estimate. */
type EstimateType = DeepValueOf<typeof CONST.MODEL_TYPES> | "Unknown";

export type { DeepValueOf, EstimateType, RuntimeConfig };
