import { describe, it, expect, beforeEach } from "vitest";
import { useDataStore } from "@src/store/dataStore";
import CONFIG from "@src/CONFIG";
import type { ModelParameters } from "@src/types";

const makeParameters = (
  overrides: Partial<ModelParameters> = {},
): ModelParameters => ({
  ...CONFIG.DEFAULT_MODEL_PARAMETERS,
  ...overrides,
});

describe("dataStore model parameters", () => {
  beforeEach(() => {
    useDataStore.getState().clearUploadedData();
  });

  it("stores the last-used parameters keyed to a dataId", () => {
    const parameters = makeParameters({
      modelType: "RTMA",
      favorPositive: false,
      winsorize: 2,
    });
    useDataStore.getState().setModelParameters("data_1", parameters);

    const state = useDataStore.getState();
    expect(state.modelParameters).toEqual(parameters);
    expect(state.modelParametersDataId).toBe("data_1");
  });

  it("overwrites the saved parameters when a different dataset saves", () => {
    useDataStore
      .getState()
      .setModelParameters("data_1", makeParameters({ favorPositive: false }));
    useDataStore
      .getState()
      .setModelParameters("data_2", makeParameters({ winsorize: 5 }));

    const state = useDataStore.getState();
    expect(state.modelParametersDataId).toBe("data_2");
    expect(state.modelParameters?.winsorize).toBe(5);
    expect(state.modelParameters?.favorPositive).toBe(
      CONFIG.DEFAULT_MODEL_PARAMETERS.favorPositive,
    );
  });

  it("clears saved parameters together with the uploaded data", () => {
    useDataStore.getState().setModelParameters("data_1", makeParameters());
    useDataStore.getState().clearUploadedData();

    const state = useDataStore.getState();
    expect(state.modelParameters).toBeNull();
    expect(state.modelParametersDataId).toBeNull();
  });
});
