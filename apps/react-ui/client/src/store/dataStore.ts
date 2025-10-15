import type { DataArray, SubsampleFilterState } from "@src/types";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ColumnMapping = {
  effect: string;
  se: string;
  nObs: string;
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

  // Actions
  setUploadedData: (data: UploadedData) => void;
  clearUploadedData: () => void;
  setDataId: (id: string) => void;
  getUploadedData: () => UploadedData | null;
};

export const useDataStore = create<DataStore>()(
  persist(
    (set, get) => ({
      // Initial state
      uploadedData: null,
      dataId: null,

      // Actions
      setUploadedData: (data: UploadedData) => {
        set({ uploadedData: data, dataId: data.id });
      },

      clearUploadedData: () => {
        set({ uploadedData: null, dataId: null });
      },

      setDataId: (id: string) => {
        set({ dataId: id });
      },

      getUploadedData: () => {
        return get().uploadedData;
      },
    }),
    {
      name: "maive-data-storage",
      // Only persist the dataId, not the actual data to avoid localStorage size limits
      partialize: (state) => ({ dataId: state.dataId }),
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
