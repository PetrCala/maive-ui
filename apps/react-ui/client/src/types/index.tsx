import type CONST from "@src/CONST";
import type DeepValueOf from "./DeepValueOf";
import type { AlertType } from "./alert";
import type {
  ModelParameters,
  ModelRequest,
  ModelResponse,
  ModelResults,
  PingResponse,
  ApiConfig,
} from "./api";
import type DataArray from "./data";
import type {
  LegacySubsampleFilterState,
  SubsampleFilterCondition,
  SubsampleFilterConditionNode,
  SubsampleFilterGroupNode,
  SubsampleFilterJoiner,
  SubsampleFilterNode,
  SubsampleFilterOperator,
  SubsampleFilterState,
} from "./data";

/** A type of the results main estimate value. This is used to determine which model was used to produce the main estimate. */
type EstimateType = DeepValueOf<typeof CONST.MODEL_TYPES> | "Unknown";

export type {
  ApiConfig,
  DataArray,
  SubsampleFilterCondition,
  SubsampleFilterConditionNode,
  SubsampleFilterGroupNode,
  SubsampleFilterJoiner,
  SubsampleFilterNode,
  SubsampleFilterOperator,
  SubsampleFilterState,
  LegacySubsampleFilterState,
  DeepValueOf,
  EstimateType,
  ModelParameters,
  ModelRequest,
  ModelResponse,
  ModelResults,
  PingResponse,
  AlertType,
};
