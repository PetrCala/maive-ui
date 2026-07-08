import CONST from "@src/CONST";
import CONFIG from "@src/CONFIG";
import type { ModelParameters, RTMAParameters } from "@src/types/api";
import type { ValidationError } from "@api/server/datasetValidation";

// Applies the `/v1/runs` parameter defaults (design D6, §6.5): a minimal
// valid request is `{ "data": [...] }`, where `modelType` defaults to the UI's
// default model type, and unset parameters fall back to
// `CONFIG.DEFAULT_MODEL_PARAMETERS`. `modelType: "RTMA"` routes to the RTMA
// defaults instead, since RTMA has its own parameter shape.
//
// Supplied parameters are validated the same way the sync R endpoints
// validate them (enum membership, numeric bounds, boolean flags), so a bad
// value fails fast with a 400 instead of queueing a run that dies in R.
// Only whitelisted keys reach the queued parameter object, keeping the async
// payload identical to what the sync path sends.

const RTMA_DEFAULTS: Omit<RTMAParameters, "modelType"> = {
  favorPositive: true,
  alphaSelect: 0.05,
  ciLevel: 0.95,
  winsorize: 0,
};

const MODEL_TYPE_VALUES = Object.values(CONST.MODEL_TYPES);
const MAIVE_METHOD_VALUES = Object.values(CONST.MAIVE_METHODS);
const WEIGHT_VALUES = Object.values(CONST.WEIGHT_OPTIONS).map(
  (option) => option.VALUE,
);
const SE_TREATMENT_VALUES = Object.values(CONST.STANDARD_ERROR_TREATMENTS).map(
  (option) => option.VALUE,
);

export type ResolvedRunParameters = {
  modelType: string;
  parameters: ModelParameters | RTMAParameters;
};

export type ResolveRunParametersResult =
  | { resolved: ResolvedRunParameters; error?: undefined }
  | { resolved?: undefined; error: ValidationError };

const asOverrides = (parametersInput: unknown): Record<string, unknown> =>
  parametersInput &&
  typeof parametersInput === "object" &&
  !Array.isArray(parametersInput)
    ? (parametersInput as Record<string, unknown>)
    : {};

class ParameterValidationError extends Error {}

const invalid = (message: string): never => {
  throw new ParameterValidationError(message);
};

const enumParameter = <T extends string>(
  overrides: Record<string, unknown>,
  name: string,
  choices: readonly string[],
  fallback: T,
): T => {
  const value = overrides[name];
  if (value === undefined || value === null) {
    return fallback;
  }
  if (typeof value !== "string" || !choices.includes(value)) {
    invalid(
      `Invalid ${name} value: ${String(value)}. Must be one of: ${choices.join(", ")}.`,
    );
  }
  return value as T;
};

const flagParameter = (
  overrides: Record<string, unknown>,
  name: string,
  fallback: boolean,
): boolean => {
  const value = overrides[name];
  if (value === undefined || value === null) {
    return fallback;
  }
  if (typeof value !== "boolean") {
    invalid(`Invalid ${name} value: must be true or false.`);
  }
  return value as boolean;
};

const winsorizeParameter = (overrides: Record<string, unknown>): number => {
  const value = overrides.winsorize;
  if (value === undefined || value === null) {
    return 0;
  }
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    value >= 100
  ) {
    invalid(
      "Invalid winsorize value: must be a percentage between 0 (disabled) and 100.",
    );
  }
  return value as number;
};

const unitIntervalParameter = (
  overrides: Record<string, unknown>,
  name: string,
  fallback: number,
): number => {
  const value = overrides[name];
  if (value === undefined || value === null) {
    return fallback;
  }
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value <= 0 ||
    value >= 1
  ) {
    invalid(
      `Invalid ${name} value: must be a number strictly between 0 and 1.`,
    );
  }
  return value as number;
};

const resolveOrThrow = (
  modelTypeInput: unknown,
  parametersInput: unknown,
): ResolvedRunParameters => {
  const overrides = asOverrides(parametersInput);

  const requestedModelType =
    modelTypeInput === undefined ||
    modelTypeInput === null ||
    modelTypeInput === ""
      ? CONFIG.DEFAULT_MODEL_PARAMETERS.modelType
      : modelTypeInput;

  if (
    typeof requestedModelType !== "string" ||
    !MODEL_TYPE_VALUES.includes(
      requestedModelType as (typeof MODEL_TYPE_VALUES)[number],
    )
  ) {
    invalid(
      `Invalid modelType value: ${String(requestedModelType)}. Must be one of: ${MODEL_TYPE_VALUES.join(", ")}.`,
    );
  }
  const modelType = requestedModelType as ModelParameters["modelType"];

  if (modelType === CONST.MODEL_TYPES.RTMA) {
    const parameters: RTMAParameters = {
      modelType: "RTMA",
      favorPositive: flagParameter(
        overrides,
        "favorPositive",
        RTMA_DEFAULTS.favorPositive,
      ),
      alphaSelect: unitIntervalParameter(
        overrides,
        "alphaSelect",
        RTMA_DEFAULTS.alphaSelect,
      ),
      ciLevel: unitIntervalParameter(
        overrides,
        "ciLevel",
        RTMA_DEFAULTS.ciLevel,
      ),
      winsorize: winsorizeParameter(overrides),
    };
    return { modelType: "RTMA", parameters };
  }

  const defaults = CONFIG.DEFAULT_MODEL_PARAMETERS;

  const shouldUseInstrumenting =
    overrides.shouldUseInstrumenting === undefined ||
    overrides.shouldUseInstrumenting === null
      ? modelType !== CONST.MODEL_TYPES.WLS
      : flagParameter(overrides, "shouldUseInstrumenting", false);

  // Fixed whitelist matching the sync R path (api_v1.R); unknown keys and
  // RTMA-only parameters (e.g. favorPositive) never reach the queue.
  const parameters: ModelParameters = {
    modelType,
    maiveMethod: enumParameter(
      overrides,
      "maiveMethod",
      MAIVE_METHOD_VALUES,
      defaults.maiveMethod,
    ),
    weight: enumParameter(overrides, "weight", WEIGHT_VALUES, defaults.weight),
    standardErrorTreatment: enumParameter(
      overrides,
      "standardErrorTreatment",
      SE_TREATMENT_VALUES,
      defaults.standardErrorTreatment,
    ),
    includeStudyDummies: flagParameter(
      overrides,
      "includeStudyDummies",
      defaults.includeStudyDummies,
    ),
    includeStudyClustering: flagParameter(
      overrides,
      "includeStudyClustering",
      defaults.includeStudyClustering,
    ),
    computeAndersonRubin: flagParameter(
      overrides,
      "computeAndersonRubin",
      defaults.computeAndersonRubin,
    ),
    useLogFirstStage: flagParameter(
      overrides,
      "useLogFirstStage",
      defaults.useLogFirstStage,
    ),
    winsorize: winsorizeParameter(overrides),
    shouldUseInstrumenting,
    favorPositive: defaults.favorPositive,
  };

  return { modelType, parameters };
};

export const resolveRunParameters = (
  modelTypeInput: unknown,
  parametersInput: unknown,
): ResolveRunParametersResult => {
  try {
    return { resolved: resolveOrThrow(modelTypeInput, parametersInput) };
  } catch (error) {
    if (error instanceof ParameterValidationError) {
      return { error: { message: error.message } };
    }
    throw error;
  }
};
