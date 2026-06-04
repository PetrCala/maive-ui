import { describe, it, expect, beforeEach } from "vitest";
import { useRunsStore } from "@src/store/runsStore";

const makeEntry = (jobId: string, submittedAt: number) => ({
  jobId,
  modelType: "RTMA",
  dataId: "data_1",
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
