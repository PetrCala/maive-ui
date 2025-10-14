import type CONST from "@src/CONST";
import type DeepValueOf from "./DeepValueOf";
import type RuntimeConfig from "./RuntimeConfig";
import type { AlertType } from "./alert";
import type {
  ModelParameters,
  ModelRequest,
  ModelResponse,
  ModelResults,
  PingResponse,
  ApiConfig,
  ApiError,
} from "./api";
import type DataArray from "./data";
import type {
  FilterJoiner,
  FilterOperator,
  SubsampleFilter,
  SubsampleFilterCondition,
} from "./filter";

/** A type of the results main estimate value. This is used to determine which model was used to produce the main estimate. */
type EstimateType = DeepValueOf<typeof CONST.MODEL_TYPES> | "Unknown";

export type {
  ApiConfig,
  ApiError,
  DataArray,
  DeepValueOf,
  EstimateType,
  ModelParameters,
  ModelRequest,
  ModelResponse,
  ModelResults,
  PingResponse,
  RuntimeConfig,
  AlertType,
  FilterOperator,
  FilterJoiner,
  SubsampleFilter,
  SubsampleFilterCondition,
};
