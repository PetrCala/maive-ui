import CONST from "@src/CONST";
import CONFIG from "@src/CONFIG";
import type { ModelParameters, RTMAParameters } from "@src/types/api";

// Applies the `/v1/runs` parameter defaults (design D6, §6.5): a minimal
// valid request is `{ "data": [...] }` — `modelType` defaults to the UI's
// default model type, and unset parameters fall back to
// `CONFIG.DEFAULT_MODEL_PARAMETERS`. `modelType: "RTMA"` routes to the RTMA
// defaults instead, since RTMA has its own parameter shape.

const RTMA_DEFAULTS: Omit<RTMAParameters, "modelType"> = {
  favorPositive: true,
  alphaSelect: 0.05,
  ciLevel: 0.95,
  winsorize: 0,
};

export type ResolvedRunParameters = {
  modelType: string;
  parameters: ModelParameters | RTMAParameters;
};

const asOverrides = (parametersInput: unknown): Record<string, unknown> =>
  parametersInput &&
  typeof parametersInput === "object" &&
  !Array.isArray(parametersInput)
    ? (parametersInput as Record<string, unknown>)
    : {};

export const resolveRunParameters = (
  modelTypeInput: unknown,
  parametersInput: unknown,
): ResolvedRunParameters => {
  const overrides = asOverrides(parametersInput);

  const requestedModelType =
    typeof modelTypeInput === "string" && modelTypeInput.length > 0
      ? modelTypeInput
      : CONFIG.DEFAULT_MODEL_PARAMETERS.modelType;

  if (requestedModelType === CONST.MODEL_TYPES.RTMA) {
    const parameters: RTMAParameters = {
      modelType: "RTMA",
      favorPositive:
        typeof overrides.favorPositive === "boolean"
          ? overrides.favorPositive
          : RTMA_DEFAULTS.favorPositive,
      alphaSelect:
        typeof overrides.alphaSelect === "number"
          ? overrides.alphaSelect
          : RTMA_DEFAULTS.alphaSelect,
      ciLevel:
        typeof overrides.ciLevel === "number"
          ? overrides.ciLevel
          : RTMA_DEFAULTS.ciLevel,
      winsorize:
        typeof overrides.winsorize === "number"
          ? overrides.winsorize
          : RTMA_DEFAULTS.winsorize,
    };
    return { modelType: "RTMA", parameters };
  }

  const shouldUseInstrumenting =
    typeof overrides.shouldUseInstrumenting === "boolean"
      ? overrides.shouldUseInstrumenting
      : requestedModelType !== CONST.MODEL_TYPES.WLS;

  const parameters: ModelParameters = {
    ...CONFIG.DEFAULT_MODEL_PARAMETERS,
    ...overrides,
    modelType: requestedModelType as ModelParameters["modelType"],
    shouldUseInstrumenting,
  };

  return { modelType: requestedModelType, parameters };
};
