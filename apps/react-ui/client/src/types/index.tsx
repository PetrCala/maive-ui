import type CONST from "@src/CONST";
import type DeepValueOf from "./DeepValueOf";
import type RuntimeConfig from "./RuntimeConfig";
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
};
