import type { RunStatus } from "@src/types/api";
import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * A lightweight record of a submitted async run, tracked per-browser.
 * The heavy result payload is NOT stored here — it lives in DynamoDB (48h TTL)
 * and is fetched by jobId when a run is opened. (Durable client-side result
 * caching via IndexedDB is a Phase 2 enhancement.)
 */
export type RunEntry = {
  jobId: string;
  modelType: string;
  dataId: string | null;
  // JSON-stringified ModelParameters, so a run can be reopened with full
  // fidelity (the results page reads `parameters` from the URL).
  parameters: string;
  submittedAt: number; // epoch ms
  status: RunStatus;
};

type RunsStore = {
  // State
  runsList: RunEntry[];

  // Actions
  addRun: (entry: RunEntry) => void;
  updateRunStatus: (jobId: string, status: RunStatus) => void;
  removeRun: (jobId: string) => void;
  clearRuns: () => void;
};

// Cap the locally-tracked history so localStorage never grows unbounded.
const MAX_RUNS = 50;

export const useRunsStore = create<RunsStore>()(
  persist(
    (set) => ({
      // Initial state
      runsList: [],

      // Actions
      addRun: (entry: RunEntry) => {
        set((state) => ({
          runsList: [
            entry,
            ...state.runsList.filter((run) => run.jobId !== entry.jobId),
          ].slice(0, MAX_RUNS),
        }));
      },

      updateRunStatus: (jobId: string, status: RunStatus) => {
        set((state) => ({
          runsList: state.runsList.map((run) =>
            run.jobId === jobId ? { ...run, status } : run,
          ),
        }));
      },

      removeRun: (jobId: string) => {
        set((state) => ({
          runsList: state.runsList.filter((run) => run.jobId !== jobId),
        }));
      },

      clearRuns: () => {
        set({ runsList: [] });
      },
    }),
    {
      name: "maive-runs-list",
      // Persist the lightweight list only (result payloads stay server-side).
      partialize: (state) => ({ runsList: state.runsList }),
    },
  ),
);
