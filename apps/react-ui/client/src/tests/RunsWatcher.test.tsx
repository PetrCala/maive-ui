import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import RunsWatcher from "@src/components/RunsWatcher";
import { GlobalAlertProvider } from "@src/components/GlobalAlertProvider";
import { useRunsStore } from "@src/store/runsStore";
import { modelService } from "@src/api/services/modelService";
import { notifyRunComplete } from "@src/utils/notifications";
import CONST from "@src/CONST";

vi.mock("@src/utils/notifications", () => ({
  notifyRunComplete: vi.fn(() => true),
  requestNotificationPermission: vi.fn(),
}));

const addRun = (jobId: string, status: "queued" | "succeeded") => {
  useRunsStore.getState().addRun({
    jobId,
    modelType: "RTMA",
    dataId: "d1",
    parameters: "{}",
    submittedAt: Date.now(),
    status,
  });
};

const renderWatcher = () =>
  render(
    <GlobalAlertProvider>
      <RunsWatcher />
    </GlobalAlertProvider>,
  );

describe("RunsWatcher", () => {
  beforeEach(() => {
    useRunsStore.getState().clearRuns();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("polls pending runs and reflects their terminal status in the store", async () => {
    addRun("job-1", "queued");
    const getRuns = vi
      .spyOn(modelService, "getRuns")
      .mockResolvedValue([{ jobId: "job-1", status: "succeeded" }]);

    renderWatcher();

    await waitFor(() => expect(getRuns).toHaveBeenCalledWith(["job-1"]));
    await waitFor(() =>
      expect(useRunsStore.getState().runsList[0].status).toBe("succeeded"),
    );
  });

  it("does not poll when every run is already terminal", async () => {
    addRun("done-1", "succeeded");
    const getRuns = vi.spyOn(modelService, "getRuns").mockResolvedValue([]);

    renderWatcher();

    // Allow the effect to run; a terminal-only list must never be polled.
    await new Promise((resolve) => {
      setTimeout(resolve, 50);
    });
    expect(getRuns).not.toHaveBeenCalled();
  });

  it("flips a run gone from the backend and past the TTL to expired", async () => {
    // Submitted beyond the 48h TTL and absent from the batch response (its
    // record has expired) — the watcher marks it expired, without notifying.
    useRunsStore.getState().addRun({
      jobId: "old-1",
      modelType: "RTMA",
      dataId: "d1",
      parameters: "{}",
      submittedAt: Date.now() - (CONST.RUNS.TTL_MS + 60_000),
      status: "queued",
    });
    const getRuns = vi.spyOn(modelService, "getRuns").mockResolvedValue([]);

    renderWatcher();

    await waitFor(() => expect(getRuns).toHaveBeenCalledWith(["old-1"]));
    await waitFor(() =>
      expect(useRunsStore.getState().runsList[0].status).toBe("expired"),
    );
    expect(notifyRunComplete).not.toHaveBeenCalled();
  });

  it("keeps a recent run pending when it is briefly missing from the response", async () => {
    addRun("young-1", "queued"); // submittedAt = now, within the TTL window
    const getRuns = vi.spyOn(modelService, "getRuns").mockResolvedValue([]);

    renderWatcher();

    await waitFor(() => expect(getRuns).toHaveBeenCalledWith(["young-1"]));
    // A transient miss inside the TTL window must not be expired.
    await new Promise((resolve) => {
      setTimeout(resolve, 50);
    });
    expect(useRunsStore.getState().runsList[0].status).toBe("queued");
  });
});
