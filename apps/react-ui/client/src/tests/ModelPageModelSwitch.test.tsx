import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ModelPage from "@src/pages/model";
import { GlobalAlertProvider } from "@src/components/GlobalAlertProvider";
import { ParameterAlertProvider } from "@src/components/ParameterAlertProvider";
import CONFIG from "@src/CONFIG";
import CONST from "@src/CONST";
import TEXT from "@src/lib/text";
import { dataCache, useDataStore } from "@store/dataStore";
import type { UploadedData } from "@store/dataStore";
import type { DataArray, ModelParameters } from "@src/types";

const DATA_ID = "model-switch-test";

// The page reads its dataId from next/navigation; the global setup returns an
// empty query, so override it here. The instance must be stable: the page
// reloads its data whenever searchParams changes identity. The GoBackButton
// uses the Pages-Router useRouter (next/router), which the global setup does
// not cover.
const { searchParams } = vi.hoisted(() => ({
  searchParams: new URLSearchParams({ dataId: "model-switch-test" }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => searchParams,
}));
vi.mock("next/router", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("@src/utils/dataCacheDb", () => ({
  getUploadedData: vi.fn(() => Promise.resolve(undefined)),
  putUploadedData: vi.fn(() => Promise.resolve()),
  deleteUploadedData: vi.fn(() => Promise.resolve()),
}));

const { MAIVE, WLS } = CONST.MODEL_TYPES;
const { PET_PEESE, EK } = CONST.MAIVE_METHODS;
const WEIGHTS = CONST.WEIGHT_OPTIONS;

const seedDataset = (): void => {
  const rawData: DataArray = Array.from({ length: 12 }, (_, index) => ({
    effect: 0.3 + index * 0.01,
    se: 0.1 + index * 0.02,
    n_obs: 100 + index * 10,
  }));
  const uploaded: UploadedData = {
    id: DATA_ID,
    filename: "switch.csv",
    data: rawData,
    rawData,
    columnNames: ["effect", "se", "n_obs"],
    hasHeaders: true,
    base64Data: "",
    uploadedAt: new Date(),
  };
  dataCache.set(DATA_ID, uploaded);
};

// Coming back to the page (browser Back from results) remounts it from the
// parameters stored for the dataset.
const seedSavedParameters = (saved: Partial<ModelParameters>): void => {
  useDataStore.getState().setModelParameters(DATA_ID, {
    ...CONFIG.DEFAULT_MODEL_PARAMETERS,
    ...saved,
  } as ModelParameters);
};

const renderPage = () =>
  render(
    <GlobalAlertProvider>
      <ParameterAlertProvider>
        <ModelPage />
      </ParameterAlertProvider>
    </GlobalAlertProvider>,
  );

// Option labels are not tied to their controls (and the method label changes
// with the model), so find each select by the values it offers.
const CONTROL_VALUES = {
  modelType: CONST.MODEL_TYPES.WLS,
  maiveMethod: CONST.MAIVE_METHODS.EK,
  weight: CONST.WEIGHT_OPTIONS.STUDY_WEIGHTS.VALUE,
} as const;
type Control = keyof typeof CONTROL_VALUES;

const selectFor = (control: Control): HTMLSelectElement => {
  const select = screen
    .getAllByRole<HTMLSelectElement>("combobox")
    .find((element) =>
      Array.from(element.options).some(
        (option) => option.value === CONTROL_VALUES[control],
      ),
    );
  if (!select) {
    throw new Error(`No select for ${control}`);
  }
  return select;
};

const choose = (control: Control, value: string): void => {
  fireEvent.change(selectFor(control), { target: { value } });
};

// The section opens on its own when advanced values differ from the defaults,
// so only click it when it is still closed.
const openAdvancedOptions = (): void => {
  const toggle = screen.getByRole("button", {
    name: TEXT.model.advancedOptions.title,
  });
  if (toggle.getAttribute("aria-expanded") !== "true") {
    fireEvent.click(toggle);
  }
};

const savedParameters = () => useDataStore.getState().modelParameters;

const waitForModelType = async (modelType: string): Promise<void> => {
  await waitFor(() => {
    expect(selectFor("modelType").value).toBe(modelType);
  });
};

describe("ModelPage model switch (#583)", () => {
  beforeEach(() => {
    dataCache.clear();
    useDataStore.setState({
      modelParameters: null,
      modelParametersDataId: null,
    });
    seedDataset();
  });

  it("resets method and weighting on WLS to MAIVE after browser Back", async () => {
    seedSavedParameters({
      modelType: WLS,
      shouldUseInstrumenting: false,
      maiveMethod: EK,
      weight: WEIGHTS.STANDARD_WEIGHTS.VALUE,
      useLogFirstStage: false,
    });
    renderPage();
    await waitForModelType(WLS);

    choose("modelType", MAIVE);

    await waitFor(() => {
      expect(savedParameters()).toMatchObject({
        modelType: MAIVE,
        maiveMethod: PET_PEESE,
        weight: WEIGHTS.EQUAL_WEIGHTS.VALUE,
      });
    });
    openAdvancedOptions();
    expect(selectFor("maiveMethod").value).toBe(PET_PEESE);
    expect(selectFor("weight").value).toBe(WEIGHTS.EQUAL_WEIGHTS.VALUE);
    // Standard Weights hid the Anderson-Rubin row; it is back for MAIVE.
    expect(
      screen.getByText(TEXT.model.computeAndersonRubin.label, {
        selector: "label",
      }),
    ).toBeInTheDocument();
  });

  it("resets the method picked in WLS when switching to MAIVE before a run", async () => {
    renderPage();
    await waitForModelType(MAIVE);

    choose("modelType", WLS);
    openAdvancedOptions();
    choose("maiveMethod", EK);
    await waitFor(() => {
      expect(savedParameters()).toMatchObject({
        modelType: WLS,
        maiveMethod: EK,
      });
    });

    choose("modelType", MAIVE);

    await waitFor(() => {
      expect(savedParameters()).toMatchObject({
        modelType: MAIVE,
        maiveMethod: PET_PEESE,
        weight: WEIGHTS.EQUAL_WEIGHTS.VALUE,
      });
    });
  });

  it("resets the method picked in MAIVE when switching to WLS", async () => {
    seedSavedParameters({ modelType: MAIVE, maiveMethod: EK });
    renderPage();
    await waitForModelType(MAIVE);

    choose("modelType", WLS);

    await waitFor(() => {
      expect(savedParameters()).toMatchObject({
        modelType: WLS,
        maiveMethod: PET_PEESE,
        weight: WEIGHTS.STANDARD_WEIGHTS.VALUE,
      });
    });
  });

  it("returns to the last MAIVE weighting after a round trip through WLS", async () => {
    seedSavedParameters({
      modelType: MAIVE,
      weight: WEIGHTS.ADJUSTED_WEIGHTS.VALUE,
    });
    renderPage();
    await waitForModelType(MAIVE);

    choose("modelType", WLS);
    await waitFor(() => {
      expect(savedParameters()?.weight).toBe(WEIGHTS.STANDARD_WEIGHTS.VALUE);
    });

    choose("modelType", MAIVE);

    await waitFor(() => {
      expect(savedParameters()).toMatchObject({
        modelType: MAIVE,
        weight: WEIGHTS.ADJUSTED_WEIGHTS.VALUE,
      });
    });
  });

  it("keeps a weighting chosen deliberately in WLS", async () => {
    seedSavedParameters({
      modelType: WLS,
      shouldUseInstrumenting: false,
      weight: WEIGHTS.STUDY_WEIGHTS.VALUE,
      useLogFirstStage: false,
    });
    renderPage();
    await waitForModelType(WLS);

    choose("modelType", MAIVE);

    await waitFor(() => {
      expect(savedParameters()).toMatchObject({
        modelType: MAIVE,
        weight: WEIGHTS.STUDY_WEIGHTS.VALUE,
      });
    });
  });

  it("still sets Standard Weights on MAIVE to WLS after browser Back into WLS", async () => {
    seedSavedParameters({
      modelType: WLS,
      shouldUseInstrumenting: false,
      weight: WEIGHTS.STANDARD_WEIGHTS.VALUE,
      useLogFirstStage: false,
    });
    renderPage();
    await waitForModelType(WLS);

    choose("modelType", MAIVE);
    await waitFor(() => {
      expect(savedParameters()?.weight).toBe(WEIGHTS.EQUAL_WEIGHTS.VALUE);
    });

    choose("modelType", WLS);

    await waitFor(() => {
      expect(savedParameters()).toMatchObject({
        modelType: WLS,
        weight: WEIGHTS.STANDARD_WEIGHTS.VALUE,
      });
    });
  });
});
