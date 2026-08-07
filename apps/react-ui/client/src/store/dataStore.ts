import type {
  DataArray,
  ModelParameters,
  SubsampleFilterState,
} from "@src/types";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ColumnMapping = {
  effect: string;
  se: string;
  // Optional: a two-column (effect, se) dataset has no sample sizes and can
  // still run RTMA, which does not use them.
  nObs: string | null;
  studyId?: string | null;
};

export type UploadedData = {
  id: string;
  filename: string;
  data: DataArray;
  rawData: DataArray;
  columnNames: string[];
  hasHeaders: boolean;
  base64Data: string;
  uploadedAt: Date;
  columnMapping?: ColumnMapping;
  subsampleFilter?: SubsampleFilterState | null;
};

type DataStore = {
  // State
  uploadedData: UploadedData | null;
  dataId: string | null;
  // Last parameters used on the model page, kept so every return path
  // (results, validation, failed or expired runs) can restore them instead
  // of resetting the form to defaults. Only valid for modelParametersDataId.
  modelParameters: ModelParameters | null;
  modelParametersDataId: string | null;

  // Actions
  setUploadedData: (data: UploadedData) => void;
  clearUploadedData: () => void;
  setDataId: (id: string) => void;
  getUploadedData: () => UploadedData | null;
  setModelParameters: (dataId: string, parameters: ModelParameters) => void;
};

export const useDataStore = create<DataStore>()(
  persist(
    (set, get) => ({
      // Initial state
      uploadedData: null,
      dataId: null,
      modelParameters: null,
      modelParametersDataId: null,

      // Actions
      setUploadedData: (data: UploadedData) => {
        set({ uploadedData: data, dataId: data.id });
      },

      clearUploadedData: () => {
        set({
          uploadedData: null,
          dataId: null,
          modelParameters: null,
          modelParametersDataId: null,
        });
      },

      setDataId: (id: string) => {
        set({ dataId: id });
      },

      getUploadedData: () => {
        return get().uploadedData;
      },

      setModelParameters: (dataId: string, parameters: ModelParameters) => {
        set({ modelParameters: parameters, modelParametersDataId: dataId });
      },
    }),
    {
      name: "maive-data-storage",
      // Only persist the dataId and model parameters, not the actual data,
      // to avoid localStorage size limits
      partialize: (state) => ({
        dataId: state.dataId,
        modelParameters: state.modelParameters,
        modelParametersDataId: state.modelParametersDataId,
      }),
    },
  ),
);

// In-memory storage for actual data (not persisted to localStorage)
class DataCache {
  private cache = new Map<string, UploadedData>();

  set(id: string, data: UploadedData) {
    this.cache.set(id, data);
  }

  get(id: string): UploadedData | undefined {
    return this.cache.get(id);
  }

  delete(id: string) {
    this.cache.delete(id);
  }

  clear() {
    this.cache.clear();
  }
}

export const dataCache = new DataCache();
