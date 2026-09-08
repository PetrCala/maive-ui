/**
 * The single parameter resolver behind every run (#555).
 *
 * A run reaches the R backend from four places: the model page in the
 * browser, the same-origin sync proxies (`/api/run-model`, `/api/run-rtma`),
 * the public sync routes (`/v1/run-model`, `/v1/run-rtma`) and the async
 * queue (`/api/runs`, `/v1/runs`). Before this module each of them filled in
 * missing parameters on its own, and they disagreed: the browser turned study
 * clustering on for any four-column upload and switched WLS to standard
 * weights, while the API paths fell back to `CONFIG.DEFAULT_MODEL_PARAMETERS`
 * and left both off. Same CSV, different analysis, nothing in the response to
 * tell the caller.
 *
 * This file is pure TypeScript with no server or browser dependencies, so the
 * browser imports the very function the API routes run. That is what keeps it
 * one source of truth rather than a rule the two sides try to mirror: there is
 * no second implementation to drift. The R backend still applies the same
 * rules for callers that reach it directly (api_v1.R), and a shared fixture
 * (tests/e2e/fixtures/resolver_parity.json) asserts the two agree.
 *
 * Two modes:
 * - `strict` (the API): a caller-supplied value that the rules would have to
 *   change is a 400, never a silently different analysis. Unknown keys are
 *   also a 400, naming the key.
 * - `lenient` (the browser): the same rules are applied and every change is
 *   reported in `adjustments`, which the model page turns into the usual
 *   parameter alerts.
 *
 * Both modes derive the same values from the same inputs, so a browser user
 * and an API caller asking for the same recipe on the same data get the same
 * `resolvedParameters` back.
 */

import CONFIG from "@src/CONFIG";
import CONST from "@src/CONST";
import type {
  ModelParameters,
  RDTParameters,
  RTMAParameters,
} from "@src/types/api";

export type DataShape = {
  /** A study identifier column is present (by name, or as a 4th column). */
  hasStudyIdColumn: boolean;
  /** A sample-size column is present; without one only RTMA can run. */
  hasNObsColumn: boolean;
};

/** Shape to assume when no data is available to inspect. */
export const UNKNOWN_DATA_SHAPE: DataShape = {
  hasStudyIdColumn: false,
  hasNObsColumn: true,
};

export type RecipeName = "MAIVE" | "RTMA" | "PET-PEESE" | "EK";

export type Recipe = {
  name: RecipeName;
  /** One-line description for docs and discovery files. */
  description: string;
  /** Endpoint family the recipe runs on. */
  family: "maive" | "rtma";
  /** Parameter preset the recipe expands to; caller parameters win over it. */
  parameters: Partial<ModelParameters>;
};

/**
 * The four named recipes. MAIVE and RTMA are the two model families; PET-PEESE
 * and EK are the conventional (non-instrumented) estimators, which the app
 * calls the WLS model. Dropping `shouldUseInstrumenting: false` from either of
 * those gives the MAIVE variant of the same method instead.
 */
export const RECIPES: Record<RecipeName, Recipe> = {
  MAIVE: {
    name: "MAIVE",
    description:
      "PET-PEESE with standard errors instrumented by sample size (Irsova et al., 2025).",
    family: "maive",
    parameters: {
      modelType: "MAIVE",
      maiveMethod: "PET-PEESE",
      shouldUseInstrumenting: true,
    },
  },
  RTMA: {
    name: "RTMA",
    description:
      "Right-truncated meta-analysis correcting for p-hacking (Mathur, 2024; phacking package).",
    family: "rtma",
    parameters: {
      modelType: "RTMA",
    },
  },
  // eslint-disable-next-line @typescript-eslint/naming-convention
  "PET-PEESE": {
    name: "PET-PEESE",
    description:
      "Conventional PET-PEESE without instrumenting (the app's WLS model with the PET-PEESE method).",
    family: "maive",
    parameters: {
      modelType: "WLS",
      maiveMethod: "PET-PEESE",
      shouldUseInstrumenting: false,
    },
  },
  EK: {
    name: "EK",
    description:
      "Conventional endogenous kink (EK) without instrumenting (the app's WLS model with the EK method).",
    family: "maive",
    parameters: {
      modelType: "WLS",
      maiveMethod: "EK",
      shouldUseInstrumenting: false,
    },
  },
};

export const RECIPE_NAMES = Object.keys(RECIPES) as RecipeName[];

export type ParameterAdjustment = {
  param: string;
  from: unknown;
  to: unknown;
  reason: string;
};

export type ResolvedRun = {
  modelType: ModelParameters["modelType"];
  parameters: ModelParameters | RTMAParameters | RDTParameters;
  /** The named recipe the resolved parameters correspond to, if any. */
  recipe: RecipeName | null;
  /** Values the rules changed (lenient mode only; always empty in strict). */
  adjustments: ParameterAdjustment[];
};

export type ResolveMode = "strict" | "lenient";

export type ResolveInput = {
  dataShape?: DataShape;
  /** Top-level `modelType` (the async submit body carries it beside `parameters`). */
  modelType?: unknown;
  parameters?: unknown;
  /** Named recipe to expand before applying caller parameters. */
  recipe?: unknown;
  /**
   * Endpoint constraint: `/v1/run-model` is `maive`, `/v1/run-rtma` is
   * `rtma`, and the app's own `/api/run-rdt` proxy is `rdt`.
   */
  family?: "maive" | "rtma" | "rdt";
  /**
   * Accept the experimental RDT model type (#559). Off by default, so the
   * public API rejects RDT no matter what CONST.MODEL_TYPES lists; the app's
   * own routes (`/api/runs`, the `rdt` family) opt in.
   */
  allowExperimentalModels?: boolean;
  mode?: ResolveMode;
};

export type ResolveError = { message: string };

export type ResolveResult =
  | { resolved: ResolvedRun; error?: undefined }
  | { resolved?: undefined; error: ResolveError };

const MODEL_TYPE_VALUES = Object.values(CONST.MODEL_TYPES);
/** Model types the public API accepts: everything but the experimental RDT. */
const PUBLIC_MODEL_TYPE_VALUES = MODEL_TYPE_VALUES.filter(
  (value) => value !== CONST.MODEL_TYPES.RDT,
);
const MAIVE_METHOD_VALUES = Object.values(CONST.MAIVE_METHODS);
const WEIGHT_VALUES = Object.values(CONST.WEIGHT_OPTIONS).map(
  (option) => option.VALUE,
);
const SE_TREATMENT_VALUES = Object.values(CONST.STANDARD_ERROR_TREATMENTS).map(
  (option) => option.VALUE,
);

/** Every key a MAIVE-family `parameters` object may carry. */
export const MAIVE_PARAMETER_KEYS: ReadonlyArray<keyof ModelParameters> = [
  "modelType",
  "maiveMethod",
  "weight",
  "standardErrorTreatment",
  "includeStudyDummies",
  "includeStudyClustering",
  "computeAndersonRubin",
  "useLogFirstStage",
  "winsorize",
  "shouldUseInstrumenting",
  "favorPositive",
];

/** Every key an RTMA `parameters` object may carry. */
export const RTMA_PARAMETER_KEYS: ReadonlyArray<keyof RTMAParameters> = [
  "modelType",
  "favorPositive",
  "alphaSelect",
  "ciLevel",
  "winsorize",
  "seed",
];

/**
 * Every key an RDT `parameters` object may carry. RDT has no user options
 * (#559): cutoff, running variable, kernel, bandwidth and inference are all
 * fixed in the backend.
 */
export const RDT_PARAMETER_KEYS: ReadonlyArray<keyof RDTParameters> = [
  "modelType",
];

export const RTMA_DEFAULTS: Omit<RTMAParameters, "modelType" | "seed"> = {
  favorPositive: true,
  alphaSelect: 0.05,
  ciLevel: 0.95,
  winsorize: 0,
};

const MAX_SEED = 2147483647; // .Machine$integer.max in R

class ParameterResolutionError extends Error {}

const invalid = (message: string): never => {
  throw new ParameterResolutionError(message);
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const asOverrides = (parametersInput: unknown): Record<string, unknown> => {
  if (parametersInput === undefined || parametersInput === null) {
    return {};
  }
  if (!isPlainObject(parametersInput)) {
    invalid("The `parameters` field must be a JSON object.");
  }
  return parametersInput as Record<string, unknown>;
};

const isUnset = (value: unknown): boolean =>
  value === undefined || value === null;

/**
 * Column checks shared with the browser's dataUtils. A study identifier is
 * recognised by name (`study_id`, `study id`, `StudyID`) or, matching the
 * positional contract of the R backend, by the presence of a fourth column.
 */
export const headersHaveStudyId = (headers: string[]): boolean =>
  headers.some((header) => /\bstudy[\s_-]?id\b/i.test(header)) ||
  headers.length === 4;

export const headersHaveNObs = (headers: string[]): boolean =>
  headers.some((header) => /^n[\s_-]?obs$/i.test(header));

/**
 * Describes an uploaded dataset for the resolver: which optional columns it
 * carries. Only the first row's keys matter.
 */
export const describeDataShape = (
  rows: Array<Record<string, unknown>> | undefined | null,
): DataShape => {
  const first = rows?.[0];
  if (!first) {
    return { hasStudyIdColumn: false, hasNObsColumn: false };
  }
  const headers = Object.keys(first);
  return {
    hasStudyIdColumn: headersHaveStudyId(headers),
    hasNObsColumn: headersHaveNObs(headers),
  };
};

const rejectUnknownKeys = (
  overrides: Record<string, unknown>,
  known: readonly string[],
  family: string,
): void => {
  const unknown = Object.keys(overrides).filter((key) => !known.includes(key));
  if (unknown.length > 0) {
    invalid(
      `Unknown ${family} parameter key${unknown.length > 1 ? "s" : ""}: ${unknown.join(", ")}. Known keys: ${known.join(", ")}.`,
    );
  }
};

const enumParameter = <T extends string>(
  overrides: Record<string, unknown>,
  name: string,
  choices: readonly string[],
  fallback: T,
): T => {
  const value = overrides[name];
  if (isUnset(value)) {
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
  if (isUnset(value)) {
    return fallback;
  }
  if (typeof value !== "boolean") {
    invalid(`Invalid ${name} value: must be true or false.`);
  }
  return value as boolean;
};

const winsorizeParameter = (overrides: Record<string, unknown>): number => {
  const value = overrides.winsorize;
  if (isUnset(value)) {
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
  if (isUnset(value)) {
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

const seedParameter = (
  overrides: Record<string, unknown>,
): number | undefined => {
  const value = overrides.seed;
  if (isUnset(value)) {
    return undefined;
  }
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > MAX_SEED
  ) {
    invalid(
      `Invalid seed value: must be a positive integer no larger than ${MAX_SEED}.`,
    );
  }
  return value as number;
};

const resolveRecipe = (recipeInput: unknown): Recipe | null => {
  if (isUnset(recipeInput) || recipeInput === "") {
    return null;
  }
  if (
    typeof recipeInput !== "string" ||
    !RECIPE_NAMES.includes(recipeInput as RecipeName)
  ) {
    invalid(
      `Invalid recipe value: ${String(recipeInput)}. Must be one of: ${RECIPE_NAMES.join(", ")}.`,
    );
  }
  return RECIPES[recipeInput as RecipeName];
};

/**
 * Names the recipe a resolved parameter set corresponds to, or null when it
 * is a custom configuration. Only the fields that define the recipe are
 * compared, so clustering, weighting and winsorization choices do not stop a
 * run from being "MAIVE".
 */
export const detectRecipe = (
  parameters: ModelParameters | RTMAParameters | RDTParameters,
): RecipeName | null => {
  if (parameters.modelType === CONST.MODEL_TYPES.RTMA) {
    return "RTMA";
  }
  if (parameters.modelType === CONST.MODEL_TYPES.RDT) {
    return null;
  }
  const params = parameters;
  const match = RECIPE_NAMES.find((name) => {
    const preset = RECIPES[name].parameters;
    return (
      preset.modelType === params.modelType &&
      preset.maiveMethod === params.maiveMethod &&
      preset.shouldUseInstrumenting === params.shouldUseInstrumenting
    );
  });
  return match ?? null;
};

type Rule = {
  /** Parameter the rule may change. */
  param: keyof ModelParameters;
  /** The value the rule requires, or undefined when the rule does not apply. */
  required: (params: ModelParameters, shape: DataShape) => unknown;
  /** Why, phrased for both a 400 message and a browser alert. */
  reason: string;
};

/**
 * Dependencies between parameters, applied after defaults. Order matters:
 * later rules read the values earlier ones settled. These are the cascades
 * the model page has always applied interactively; listing them here is what
 * lets the API apply the same ones.
 */
const RULES: Rule[] = [
  {
    param: "shouldUseInstrumenting",
    required: (params) =>
      params.modelType === CONST.MODEL_TYPES.WAIVE ? true : undefined,
    reason: "WAIVE always instruments standard errors",
  },
  {
    param: "shouldUseInstrumenting",
    required: (params) =>
      params.modelType === CONST.MODEL_TYPES.WLS ? false : undefined,
    reason:
      "WLS does not instrument; use modelType MAIVE for the instrumented estimator",
  },
  {
    param: "maiveMethod",
    required: (params) =>
      params.modelType === CONST.MODEL_TYPES.WAIVE
        ? CONST.MAIVE_METHODS.PET_PEESE
        : undefined,
    reason: "WAIVE only supports PET-PEESE",
  },
  {
    param: "useLogFirstStage",
    required: (params) => (params.shouldUseInstrumenting ? undefined : false),
    reason: "a log first stage needs instrumenting",
  },
  {
    param: "weight",
    required: (params) =>
      !params.shouldUseInstrumenting &&
      params.weight === CONST.WEIGHT_OPTIONS.ADJUSTED_WEIGHTS.VALUE
        ? CONST.WEIGHT_OPTIONS.STANDARD_WEIGHTS.VALUE
        : undefined,
    reason: "adjusted weights require instrumenting",
  },
  {
    param: "includeStudyClustering",
    required: (params, shape) => {
      if (!shape.hasStudyIdColumn) {
        return false;
      }
      return (
        params.standardErrorTreatment !==
        CONST.STANDARD_ERROR_TREATMENTS.NOT_CLUSTERED.VALUE
      );
    },
    reason:
      "study clustering follows the standard error treatment when the data has a study_id column and is off otherwise",
  },
  {
    param: "computeAndersonRubin",
    required: (params) => (params.shouldUseInstrumenting ? undefined : false),
    reason: "the Anderson-Rubin CI needs instrumenting",
  },
  {
    param: "computeAndersonRubin",
    required: (params) =>
      params.weight === CONST.WEIGHT_OPTIONS.STANDARD_WEIGHTS.VALUE
        ? false
        : undefined,
    reason: "the Anderson-Rubin CI is not available with standard weights",
  },
  {
    param: "computeAndersonRubin",
    required: (params) => (params.includeStudyDummies ? false : undefined),
    reason:
      "the Anderson-Rubin CI is not available with fixed-intercept multilevel (study dummies)",
  },
];

type ModelTypeValue = ModelParameters["modelType"];

const resolveModelType = (
  modelTypeInput: unknown,
  overrides: Record<string, unknown>,
  shape: DataShape,
  explicit: Set<string>,
  mode: ResolveMode,
  family: ResolveInput["family"],
  allowExperimental: boolean,
): ModelTypeValue => {
  const fromParameters = overrides.modelType;
  const topLevel =
    isUnset(modelTypeInput) || modelTypeInput === ""
      ? undefined
      : modelTypeInput;

  if (
    !isUnset(fromParameters) &&
    topLevel !== undefined &&
    fromParameters !== topLevel
  ) {
    invalid(
      `modelType was given twice with different values: ${String(topLevel)} and ${String(fromParameters)}.`,
    );
  }

  const requested = !isUnset(fromParameters) ? fromParameters : topLevel;
  if (requested === undefined) {
    // The RTMA endpoint names its model itself. Otherwise, no sample sizes
    // means only RTMA can run: the model page (lenient) makes that choice
    // for a two-column upload, while the API (strict) does not pick a model
    // the caller did not name, and says why below.
    if (family === "rtma" || (mode === "lenient" && !shape.hasNObsColumn)) {
      return CONST.MODEL_TYPES.RTMA as ModelTypeValue;
    }
    if (family === "rdt") {
      return CONST.MODEL_TYPES.RDT as ModelTypeValue;
    }
    return CONFIG.DEFAULT_MODEL_PARAMETERS.modelType;
  }
  explicit.add("modelType");
  // RDT is experimental (#559): the browser and the app's own routes may run
  // it, but through the public API it is not a model type at all, so the
  // error lists only the public ones and never hints that it exists.
  const accepted = allowExperimental
    ? MODEL_TYPE_VALUES
    : PUBLIC_MODEL_TYPE_VALUES;
  if (
    typeof requested !== "string" ||
    !accepted.includes(requested as ModelTypeValue)
  ) {
    invalid(
      `Invalid modelType value: ${String(requested)}. Must be one of: ${accepted.join(", ")}.`,
    );
  }
  return requested as ModelTypeValue;
};

const resolveRdt = (overrides: Record<string, unknown>): RDTParameters => {
  rejectUnknownKeys(overrides, RDT_PARAMETER_KEYS, "RDT");
  return { modelType: "RDT" };
};

const resolveRtma = (overrides: Record<string, unknown>): RTMAParameters => {
  rejectUnknownKeys(overrides, RTMA_PARAMETER_KEYS, "RTMA");
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
    ciLevel: unitIntervalParameter(overrides, "ciLevel", RTMA_DEFAULTS.ciLevel),
    winsorize: winsorizeParameter(overrides),
  };
  const seed = seedParameter(overrides);
  if (seed !== undefined) {
    parameters.seed = seed;
  }
  return parameters;
};

const resolveMaiveFamily = (
  modelType: ModelTypeValue,
  overrides: Record<string, unknown>,
  shape: DataShape,
  explicit: Set<string>,
  mode: ResolveMode,
  adjustments: ParameterAdjustment[],
): ModelParameters => {
  rejectUnknownKeys(overrides, MAIVE_PARAMETER_KEYS, "MAIVE-family");
  const defaults = CONFIG.DEFAULT_MODEL_PARAMETERS;

  // Instrumenting defaults from the model type; an explicit false on MAIVE
  // is the conventional estimator, which the app labels WLS. The relabel is
  // recorded so the caller can see the canonical name.
  let resolvedModelType = modelType;
  const instrumentingDefault = modelType !== CONST.MODEL_TYPES.WLS;
  const shouldUseInstrumenting = flagParameter(
    overrides,
    "shouldUseInstrumenting",
    instrumentingDefault,
  );
  if (
    resolvedModelType === CONST.MODEL_TYPES.MAIVE &&
    shouldUseInstrumenting === false
  ) {
    adjustments.push({
      param: "modelType",
      from: resolvedModelType,
      to: CONST.MODEL_TYPES.WLS,
      reason:
        "MAIVE without instrumenting is the conventional estimator, which the app calls WLS",
    });
    resolvedModelType = CONST.MODEL_TYPES.WLS as ModelTypeValue;
  }

  const params: ModelParameters = {
    modelType: resolvedModelType,
    maiveMethod: enumParameter(
      overrides,
      "maiveMethod",
      MAIVE_METHOD_VALUES,
      defaults.maiveMethod,
    ),
    weight: enumParameter(
      overrides,
      "weight",
      WEIGHT_VALUES,
      shouldUseInstrumenting
        ? defaults.weight
        : CONST.WEIGHT_OPTIONS.STANDARD_WEIGHTS.VALUE,
    ),
    standardErrorTreatment: enumParameter(
      overrides,
      "standardErrorTreatment",
      SE_TREATMENT_VALUES,
      shape.hasStudyIdColumn && CONFIG.SHOULD_USE_CLUSTERED_CR2_SE_AS_DEFAULT
        ? CONST.STANDARD_ERROR_TREATMENTS.CLUSTERED_CR2.VALUE
        : defaults.standardErrorTreatment,
    ),
    includeStudyDummies: flagParameter(
      overrides,
      "includeStudyDummies",
      defaults.includeStudyDummies,
    ),
    // Placeholder; the clustering rule below derives it from the data shape.
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
    // A log first stage is the default for every model that instruments
    // (#575); without instrumenting there is no first stage, so the default
    // is off and the rule below treats an explicit true as a conflict.
    useLogFirstStage: flagParameter(
      overrides,
      "useLogFirstStage",
      shouldUseInstrumenting ? defaults.useLogFirstStage : false,
    ),
    winsorize: winsorizeParameter(overrides),
    shouldUseInstrumenting,
    favorPositive: flagParameter(
      overrides,
      "favorPositive",
      defaults.favorPositive,
    ),
  };

  RULES.forEach((rule) => {
    const required = rule.required(params, shape);
    if (required === undefined || params[rule.param] === required) {
      return;
    }
    if (mode === "strict" && explicit.has(rule.param)) {
      invalid(
        `Invalid ${rule.param} value: ${String(params[rule.param])} conflicts with the other parameters because ${rule.reason}.`,
      );
    }
    adjustments.push({
      param: rule.param,
      from: params[rule.param],
      to: required,
      reason: rule.reason,
    });
    (params as unknown as Record<string, unknown>)[rule.param] = required;
  });

  return params;
};

const resolveOrThrow = (input: ResolveInput): ResolvedRun => {
  const mode = input.mode ?? "strict";
  const shape = input.dataShape ?? UNKNOWN_DATA_SHAPE;
  const recipe = resolveRecipe(input.recipe);
  const callerOverrides = asOverrides(input.parameters);
  const overrides: Record<string, unknown> = {
    ...(recipe?.parameters ?? {}),
    ...callerOverrides,
  };
  const explicit = new Set(Object.keys(overrides));
  const adjustments: ParameterAdjustment[] = [];

  // Lenient mode is the browser, which gates RDT behind CONFIG.RDT_ENABLED
  // itself; strict callers must opt in explicitly.
  const allowExperimental =
    mode === "lenient" ||
    input.family === "rdt" ||
    input.allowExperimentalModels === true;
  const modelType = resolveModelType(
    input.modelType,
    overrides,
    shape,
    explicit,
    mode,
    input.family,
    allowExperimental,
  );

  const isRtma = modelType === CONST.MODEL_TYPES.RTMA;
  const isRdt = modelType === CONST.MODEL_TYPES.RDT;
  if (input.family === "rdt" && !isRdt) {
    invalid(
      `Invalid modelType value: ${modelType}. This endpoint runs RDT only.`,
    );
  }
  if (input.family === "rtma" && !isRtma) {
    invalid(
      `Invalid modelType value: ${modelType}. This endpoint runs RTMA only; use /v1/run-model for MAIVE, WAIVE and WLS.`,
    );
  }
  if (input.family === "maive" && isRtma) {
    invalid(
      "Invalid modelType value: RTMA. This endpoint runs MAIVE, WAIVE and WLS; use /v1/run-rtma for RTMA.",
    );
  }
  if (input.family === "maive" && isRdt) {
    invalid(
      "Invalid modelType value: RDT. This endpoint runs MAIVE, WAIVE and WLS.",
    );
  }
  if (!isRtma && !shape.hasNObsColumn) {
    if (mode === "strict") {
      invalid(
        explicit.has("modelType")
          ? `Invalid modelType value: ${modelType}. The data has no n_obs (sample size) column, which ${isRdt ? "RDT requires" : "MAIVE, WAIVE and WLS all require"}; only RTMA can run on it.`
          : "The data has no n_obs (sample size) column, which the default model (MAIVE) requires. Add n_obs, or set modelType to RTMA.",
      );
    }
    adjustments.push({
      param: "modelType",
      from: modelType,
      to: CONST.MODEL_TYPES.RTMA,
      reason: "the data has no sample-size column, so only RTMA can run",
    });
  }

  let parameters: ModelParameters | RTMAParameters | RDTParameters;
  if (isRtma) {
    parameters = resolveRtma(overrides);
  } else if (!shape.hasNObsColumn) {
    // Lenient fallback to RTMA on a two-column upload: the MAIVE-family
    // knobs the page state carries are not RTMA parameters, so only the
    // shared ones travel.
    parameters = resolveRtma(
      Object.fromEntries(
        Object.entries(overrides).filter(([key]) =>
          RTMA_PARAMETER_KEYS.includes(key as keyof RTMAParameters),
        ),
      ),
    );
  } else if (isRdt) {
    parameters = resolveRdt(overrides);
  } else {
    parameters = resolveMaiveFamily(
      modelType,
      overrides,
      shape,
      explicit,
      mode,
      adjustments,
    );
  }

  return {
    modelType: parameters.modelType,
    parameters,
    recipe: detectRecipe(parameters),
    adjustments,
  };
};

/**
 * Resolves caller-supplied parameters against the data shape into the full
 * parameter object the R backend runs, or a validation error.
 */
export const resolveRunParameters = (input: ResolveInput): ResolveResult => {
  try {
    return { resolved: resolveOrThrow(input) };
  } catch (error) {
    if (error instanceof ParameterResolutionError) {
      return { error: { message: error.message } };
    }
    throw error;
  }
};

/**
 * The model page keeps one `ModelParameters` object for every model type,
 * RTMA and RDT included, so a resolved RTMA or RDT run is widened back onto
 * that shape.
 */
export const toPageParameters = (
  parameters: ModelParameters | RTMAParameters | RDTParameters,
): ModelParameters => {
  if (parameters.modelType === CONST.MODEL_TYPES.RDT) {
    return {
      ...CONFIG.DEFAULT_MODEL_PARAMETERS,
      modelType: "RDT",
      shouldUseInstrumenting: false,
      computeAndersonRubin: false,
    };
  }
  if (parameters.modelType !== CONST.MODEL_TYPES.RTMA) {
    return parameters;
  }
  const rtma = parameters as RTMAParameters;
  return {
    ...CONFIG.DEFAULT_MODEL_PARAMETERS,
    modelType: "RTMA",
    shouldUseInstrumenting: false,
    computeAndersonRubin: false,
    favorPositive: rtma.favorPositive,
    winsorize: rtma.winsorize,
  };
};

/**
 * The inverse: the subset of the page's parameter object the resolver should
 * see for the selected model type. RTMA ignores every MAIVE-family knob, RDT
 * has no knobs at all, and sending them would trip the unknown-key check.
 * WLS has no first stage, so the page's (hidden) log-first-stage choice is
 * left out too: the resolver then defaults it off for the run without
 * reporting an adjustment, and the page keeps the choice for the next
 * instrumented model (#575).
 */
export const fromPageParameters = (
  parameters: ModelParameters,
): Partial<ModelParameters> | Partial<RTMAParameters> | RDTParameters => {
  if (parameters.modelType === CONST.MODEL_TYPES.RDT) {
    return { modelType: "RDT" };
  }
  if (parameters.modelType !== CONST.MODEL_TYPES.RTMA) {
    if (parameters.shouldUseInstrumenting) {
      return parameters;
    }
    const { useLogFirstStage, ...withoutFirstStage } = parameters;
    return withoutFirstStage;
  }
  return {
    modelType: "RTMA",
    favorPositive: parameters.favorPositive,
    winsorize: parameters.winsorize,
  };
};
