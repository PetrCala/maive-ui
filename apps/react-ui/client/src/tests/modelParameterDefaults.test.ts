import { describe, it, expect } from "vitest";
import { resolveRunParameters } from "@api/server/modelParameterDefaults";
import type {
  ResolveRunParametersOptions,
  ResolvedRunParameters,
} from "@api/server/modelParameterDefaults";
import CONFIG from "@src/CONFIG";

const resolveOk = (
  modelType: unknown,
  parameters: unknown,
  options?: ResolveRunParametersOptions,
): ResolvedRunParameters => {
  const result = resolveRunParameters(modelType, parameters, options);
  expect(result.error).toBeUndefined();
  if (!result.resolved) {
    throw new Error("expected parameters to resolve");
  }
  return result.resolved;
};

const resolveError = (modelType: unknown, parameters: unknown): string => {
  const result = resolveRunParameters(modelType, parameters);
  expect(result.resolved).toBeUndefined();
  if (!result.error) {
    throw new Error("expected a validation error");
  }
  return result.error.message;
};

describe("resolveRunParameters", () => {
  it("defaults to CONFIG.DEFAULT_MODEL_PARAMETERS when modelType/parameters are omitted", () => {
    const resolved = resolveOk(undefined, undefined);
    expect(resolved.modelType).toBe(CONFIG.DEFAULT_MODEL_PARAMETERS.modelType);
    expect(resolved.parameters).toMatchObject({
      ...CONFIG.DEFAULT_MODEL_PARAMETERS,
      shouldUseInstrumenting: true,
    });
  });

  it("derives shouldUseInstrumenting=false for WLS unless explicitly overridden", () => {
    const resolved = resolveOk("WLS", undefined);
    expect(resolved.parameters).toMatchObject({
      modelType: "WLS",
      shouldUseInstrumenting: false,
    });
  });

  it("rejects an explicit shouldUseInstrumenting=true on WLS as a conflict (#555)", () => {
    expect(resolveError("WLS", { shouldUseInstrumenting: true })).toMatch(
      /WLS does not instrument/,
    );
  });

  it("derives shouldUseInstrumenting=true for MAIVE/WAIVE", () => {
    const resolved = resolveOk("WAIVE", undefined);
    expect(resolved.parameters).toMatchObject({
      modelType: "WAIVE",
      shouldUseInstrumenting: true,
    });
  });

  it("merges explicit parameter overrides over the defaults", () => {
    const resolved = resolveOk("MAIVE", { winsorize: 5 });
    expect(resolved.parameters).toMatchObject({
      modelType: "MAIVE",
      winsorize: 5,
      maiveMethod: CONFIG.DEFAULT_MODEL_PARAMETERS.maiveMethod,
    });
  });

  it("rejects unknown parameter keys instead of silently dropping them (#555)", () => {
    expect(
      resolveError("MAIVE", { winsorize: 5, unknownKnob: "boom" }),
    ).toMatch(/Unknown MAIVE-family parameter key: unknownKnob/);
  });

  it("derives the data-dependent defaults from the submitted rows", () => {
    const withStudyId = resolveOk("MAIVE", undefined, {
      data: [
        { effect: 0.1, se: 0.1, n_obs: 10, study_id: "a" },
        { effect: 0.2, se: 0.1, n_obs: 10, study_id: "a" },
      ],
    });
    expect(withStudyId.parameters).toMatchObject({
      includeStudyClustering: true,
    });
    const positional = resolveOk("MAIVE", undefined, {
      data: [{ a: 0.1, b: 0.1, c: 10, d: "s1" }],
    });
    expect(positional.parameters).toMatchObject({
      includeStudyClustering: true,
    });
    const withoutStudyId = resolveOk("MAIVE", undefined, {
      data: [{ effect: 0.1, se: 0.1, n_obs: 10 }],
    });
    expect(withoutStudyId.parameters).toMatchObject({
      includeStudyClustering: false,
    });
  });

  it("expands a named recipe and reports it", () => {
    const resolved = resolveOk(undefined, undefined, {
      recipe: "EK",
      data: [{ effect: 0.1, se: 0.1, n_obs: 10 }],
    });
    expect(resolved.modelType).toBe("WLS");
    expect(resolved.recipe).toBe("EK");
    expect(resolved.parameters).toMatchObject({
      maiveMethod: "EK",
      shouldUseInstrumenting: false,
    });
  });

  it("routes modelType RTMA to the RTMA defaults", () => {
    const resolved = resolveOk("RTMA", undefined);
    expect(resolved).toEqual({
      modelType: "RTMA",
      recipe: "RTMA",
      parameters: {
        modelType: "RTMA",
        favorPositive: true,
        alphaSelect: 0.05,
        ciLevel: 0.95,
        winsorize: 0,
      },
    });
  });

  it("threads a caller seed through the async RTMA path (#555)", () => {
    const resolved = resolveOk("RTMA", { seed: 123 });
    expect(resolved.parameters).toMatchObject({ modelType: "RTMA", seed: 123 });
    expect(resolveError("RTMA", { seed: -1 })).toMatch(/Invalid seed value/);
  });

  it("applies explicit RTMA overrides", () => {
    const resolved = resolveOk("RTMA", {
      favorPositive: false,
      winsorize: 2,
    });
    expect(resolved.parameters).toEqual({
      modelType: "RTMA",
      favorPositive: false,
      alphaSelect: 0.05,
      ciLevel: 0.95,
      winsorize: 2,
    });
  });

  it("rejects an invalid modelType", () => {
    expect(resolveError("BOGUS", undefined)).toMatch(/Invalid modelType/);
  });

  it("rejects invalid enum values instead of silently defaulting", () => {
    expect(resolveError("MAIVE", { maiveMethod: "PETX" })).toMatch(
      /Invalid maiveMethod value: PETX/,
    );
    expect(resolveError("MAIVE", { weight: "heavy" })).toMatch(
      /Invalid weight value/,
    );
    expect(resolveError("MAIVE", { standardErrorTreatment: "nope" })).toMatch(
      /Invalid standardErrorTreatment value/,
    );
  });

  it("rejects non-boolean flags", () => {
    expect(resolveError("MAIVE", { includeStudyDummies: "yes" })).toMatch(
      /Invalid includeStudyDummies value/,
    );
  });

  it("rejects out-of-range winsorize", () => {
    expect(resolveError("MAIVE", { winsorize: 150 })).toMatch(
      /Invalid winsorize value/,
    );
    expect(resolveError("MAIVE", { winsorize: -1 })).toMatch(
      /Invalid winsorize value/,
    );
  });

  it("rejects out-of-range RTMA alphaSelect and ciLevel", () => {
    expect(resolveError("RTMA", { alphaSelect: 5 })).toMatch(
      /Invalid alphaSelect value/,
    );
    expect(resolveError("RTMA", { ciLevel: 1.5 })).toMatch(
      /Invalid ciLevel value/,
    );
  });
});
