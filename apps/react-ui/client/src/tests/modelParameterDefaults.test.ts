import { describe, it, expect } from "vitest";
import { resolveRunParameters } from "@api/server/modelParameterDefaults";
import CONFIG from "@src/CONFIG";

describe("resolveRunParameters", () => {
  it("defaults to CONFIG.DEFAULT_MODEL_PARAMETERS when modelType/parameters are omitted", () => {
    const resolved = resolveRunParameters(undefined, undefined);
    expect(resolved.modelType).toBe(CONFIG.DEFAULT_MODEL_PARAMETERS.modelType);
    expect(resolved.parameters).toMatchObject({
      ...CONFIG.DEFAULT_MODEL_PARAMETERS,
      shouldUseInstrumenting: true,
    });
  });

  it("derives shouldUseInstrumenting=false for WLS unless explicitly overridden", () => {
    const resolved = resolveRunParameters("WLS", undefined);
    expect(resolved.parameters).toMatchObject({
      modelType: "WLS",
      shouldUseInstrumenting: false,
    });
  });

  it("keeps an explicit shouldUseInstrumenting override for WLS", () => {
    const resolved = resolveRunParameters("WLS", {
      shouldUseInstrumenting: true,
    });
    expect(resolved.parameters).toMatchObject({
      modelType: "WLS",
      shouldUseInstrumenting: true,
    });
  });

  it("derives shouldUseInstrumenting=true for MAIVE/WAIVE", () => {
    const resolved = resolveRunParameters("WAIVE", undefined);
    expect(resolved.parameters).toMatchObject({
      modelType: "WAIVE",
      shouldUseInstrumenting: true,
    });
  });

  it("merges explicit parameter overrides over the defaults", () => {
    const resolved = resolveRunParameters("MAIVE", { winsorize: 5 });
    expect(resolved.parameters).toMatchObject({
      modelType: "MAIVE",
      winsorize: 5,
      maiveMethod: CONFIG.DEFAULT_MODEL_PARAMETERS.maiveMethod,
    });
  });

  it("routes modelType RTMA to the RTMA defaults, ignoring MAIVE parameter fields", () => {
    const resolved = resolveRunParameters("RTMA", undefined);
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
    const resolved = resolveRunParameters("RTMA", {
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
});
