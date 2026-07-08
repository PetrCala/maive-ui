import { describe, it, expect } from "vitest";
import { resolveRunParameters } from "@api/server/modelParameterDefaults";
import type { ResolvedRunParameters } from "@api/server/modelParameterDefaults";
import CONFIG from "@src/CONFIG";

const resolveOk = (
  modelType: unknown,
  parameters: unknown,
): ResolvedRunParameters => {
  const result = resolveRunParameters(modelType, parameters);
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

  it("keeps an explicit shouldUseInstrumenting override for WLS", () => {
    const resolved = resolveOk("WLS", {
      shouldUseInstrumenting: true,
    });
    expect(resolved.parameters).toMatchObject({
      modelType: "WLS",
      shouldUseInstrumenting: true,
    });
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

  it("drops unknown parameter keys instead of queueing them", () => {
    const resolved = resolveOk("MAIVE", {
      winsorize: 5,
      unknownKnob: "boom",
    });
    expect(resolved.parameters).not.toHaveProperty("unknownKnob");
  });

  it("routes modelType RTMA to the RTMA defaults, ignoring MAIVE parameter fields", () => {
    const resolved = resolveOk("RTMA", undefined);
    expect(resolved).toEqual({
      modelType: "RTMA",
      parameters: {
        modelType: "RTMA",
        favorPositive: true,
        alphaSelect: 0.05,
        ciLevel: 0.95,
        winsorize: 0,
      },
    });
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
