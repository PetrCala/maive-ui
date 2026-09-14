import { describe, it, expect } from "vitest";
import CONFIG from "@src/CONFIG";
import CONST from "@src/CONST";
import type { ModelParameters } from "@src/types";
import { detectIndirectChanges } from "@src/utils/parameterChangeTracking";

const WEIGHTS = CONST.WEIGHT_OPTIONS;

const params = (overrides: Partial<ModelParameters>): ModelParameters =>
  ({ ...CONFIG.DEFAULT_MODEL_PARAMETERS, ...overrides }) as ModelParameters;

const messageFor = (
  prev: ModelParameters,
  next: ModelParameters,
  param: keyof ModelParameters,
): string | undefined =>
  detectIndirectChanges(prev, next, "modelType").find(
    (change) => change.param === param,
  )?.message;

const wlsState = (overrides: Partial<ModelParameters> = {}) =>
  params({
    modelType: CONST.MODEL_TYPES.WLS,
    shouldUseInstrumenting: false,
    weight: WEIGHTS.STANDARD_WEIGHTS.VALUE,
    ...overrides,
  });

describe("model switch alert explanations (#583)", () => {
  it("explains a method reset on WLS to MAIVE", () => {
    expect(
      messageFor(
        wlsState({ maiveMethod: CONST.MAIVE_METHODS.EK }),
        params({ modelType: CONST.MODEL_TYPES.MAIVE }),
        "maiveMethod",
      ),
    ).toBe(
      "**MAIVE Method** set to **PET-PEESE** because **MAIVE** starts from its default method",
    );
  });

  it("explains a method reset on MAIVE to WLS", () => {
    expect(
      messageFor(
        params({ maiveMethod: CONST.MAIVE_METHODS.EK }),
        wlsState(),
        "maiveMethod",
      ),
    ).toBe(
      "**MAIVE Method** set to **PET-PEESE** because **WLS** starts from its default method",
    );
  });

  it("keeps the WAIVE explanation for its forced method", () => {
    expect(
      messageFor(
        params({ maiveMethod: CONST.MAIVE_METHODS.EK }),
        params({ modelType: CONST.MODEL_TYPES.WAIVE }),
        "maiveMethod",
      ),
    ).toBe(
      "**MAIVE Method** set to **PET-PEESE** because **WAIVE** only supports **PET-PEESE**",
    );
  });

  it("explains the weighting restored on WLS to MAIVE", () => {
    expect(
      messageFor(
        wlsState(),
        params({ modelType: CONST.MODEL_TYPES.MAIVE }),
        "weight",
      ),
    ).toBe(
      "**Weighting** set to **Equal Weights** because **MAIVE** returns to its own weighting",
    );
  });

  it("explains Standard Weights on MAIVE to WLS", () => {
    expect(messageFor(params({}), wlsState(), "weight")).toBe(
      "**Weighting** set to **Standard Weights** because **WLS** starts from **Standard Weights**",
    );
  });

  it("still blames instrumenting when Adjusted Weights is dropped", () => {
    expect(
      messageFor(
        params({ weight: WEIGHTS.ADJUSTED_WEIGHTS.VALUE }),
        wlsState(),
        "weight",
      ),
    ).toBe(
      "**Weighting** set to **Standard Weights** because **Adjusted Weights** requires instrumenting",
    );
  });
});
