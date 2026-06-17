import { describe, it, expect, beforeEach } from "vitest";
import { useRunsStore, migrateRunsState } from "@src/store/runsStore";

const makeEntry = (jobId: string, submittedAt: number) => ({
  jobId,
  modelType: "RTMA",
  dataId: "data_1",
  filename: "study-data.csv",
  rowCount: 42,
  parameters: "{}",
  submittedAt,
  status: "queued" as const,
});

describe("runsStore", () => {
  beforeEach(() => {
    useRunsStore.getState().clearRuns();
  });

  it("adds runs newest-first", () => {
    useRunsStore.getState().addRun(makeEntry("a", 1));
    useRunsStore.getState().addRun(makeEntry("b", 2));
    expect(useRunsStore.getState().runsList.map((r) => r.jobId)).toEqual([
      "b",
      "a",
    ]);
  });

  it("dedupes by jobId and moves the entry to the front", () => {
    useRunsStore.getState().addRun(makeEntry("a", 1));
    useRunsStore.getState().addRun(makeEntry("b", 2));
    useRunsStore.getState().addRun(makeEntry("a", 3));
    const { runsList } = useRunsStore.getState();
    expect(runsList).toHaveLength(2);
    expect(runsList[0].jobId).toBe("a");
  });

  it("updates a run's status", () => {
    useRunsStore.getState().addRun(makeEntry("a", 1));
    useRunsStore.getState().updateRunStatus("a", "succeeded");
    expect(useRunsStore.getState().runsList[0].status).toBe("succeeded");
  });

  it("removes a run", () => {
    useRunsStore.getState().addRun(makeEntry("a", 1));
    useRunsStore.getState().removeRun("a");
    expect(useRunsStore.getState().runsList).toHaveLength(0);
  });
});

describe("migrateRunsState", () => {
  it("backfills filename/rowCount on pre-v1 entries", () => {
    const legacy = {
      runsList: [
        {
          jobId: "a",
          modelType: "MAIVE",
          dataId: "data_1",
          parameters: "{}",
          submittedAt: 1,
          status: "succeeded",
        },
      ],
    };
    const migrated = migrateRunsState(legacy, 0);
    expect(migrated.runsList?.[0]).toMatchObject({
      filename: "Unknown dataset",
      rowCount: 0,
    });
  });

  it("leaves existing filename/rowCount untouched", () => {
    const current = { runsList: [makeEntry("a", 1)] };
    const migrated = migrateRunsState(current, 1);
    expect(migrated.runsList?.[0]).toMatchObject({
      filename: "study-data.csv",
      rowCount: 42,
    });
  });

  it("returns an empty list when nothing was persisted", () => {
    expect(migrateRunsState(undefined, 0)).toEqual({ runsList: [] });
  });
});
