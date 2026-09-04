import {
  resolveColumns,
  type ValidationError,
} from "@api/server/datasetValidation";
import {
  resolveRunParameters as resolveShared,
  type DataShape,
  type RecipeName,
  type ResolvedRun,
} from "@src/lib/parameterResolver";
import type {
  ModelParameters,
  RDTParameters,
  RTMAParameters,
} from "@src/types/api";

// Server-side entry point to the shared parameter resolver
// (src/lib/parameterResolver.ts, #555). The rules themselves live there so
// the browser runs the same function; this wrapper only adapts the API
// routes' inputs (top-level modelType, the `recipe` field, the raw data rows)
// and keeps the result shape the routes were already built around.
//
// Every API call resolves in strict mode: a value the rules would have to
// change, or a key the contract does not know, is a 400 rather than a
// clean-looking run of a different analysis.

export type ResolvedRunParameters = {
  modelType: string;
  parameters: ModelParameters | RTMAParameters | RDTParameters;
  recipe: RecipeName | null;
};

export type ResolveRunParametersResult =
  | { resolved: ResolvedRunParameters; error?: undefined }
  | { resolved?: undefined; error: ValidationError };

export type ResolveRunParametersOptions = {
  /** Raw data rows, used to derive the data-dependent defaults. */
  data?: unknown;
  /** Named recipe from the request body. */
  recipe?: unknown;
  /** Endpoint family constraint (`/v1/run-model` vs `/v1/run-rtma`, or the app's `/run-rdt`). */
  family?: "maive" | "rtma" | "rdt";
  /**
   * Accept experimental model types the public API does not expose (RDT,
   * #559). Only the app's own same-origin routes set this; the public /v1
   * routes leave it off and get a 400 for RDT.
   */
  allowExperimentalModels?: boolean;
};

// The API resolves columns by canonical name with positional fallback (D5),
// so the data shape must come from that same resolution, not from the
// browser's header heuristics: api_v1.R derives has_study_id the same way,
// which is what keeps the two resolvers in step on the same rows.
const shapeFromData = (data: unknown): DataShape | undefined => {
  if (!Array.isArray(data)) {
    return undefined;
  }
  const rows = data.filter(
    (row): row is Record<string, unknown> =>
      typeof row === "object" && row !== null && !Array.isArray(row),
  );
  const columns = resolveColumns(rows);
  if (!columns) {
    return undefined;
  }
  return {
    hasStudyIdColumn: columns.studyId !== undefined,
    hasNObsColumn: columns.nObs !== undefined,
  };
};

const toResolved = (run: ResolvedRun): ResolvedRunParameters => ({
  modelType: run.modelType,
  parameters: run.parameters,
  recipe: run.recipe,
});

export const resolveRunParameters = (
  modelTypeInput: unknown,
  parametersInput: unknown,
  options: ResolveRunParametersOptions = {},
): ResolveRunParametersResult => {
  const result = resolveShared({
    dataShape: shapeFromData(options.data),
    modelType: modelTypeInput,
    parameters: parametersInput,
    recipe: options.recipe,
    family: options.family,
    allowExperimentalModels: options.allowExperimentalModels,
    mode: "strict",
  });
  if (result.error) {
    return { error: { message: result.error.message } };
  }
  return { resolved: toResolved(result.resolved) };
};
