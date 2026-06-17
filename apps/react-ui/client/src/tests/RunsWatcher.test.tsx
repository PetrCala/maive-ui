import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import RunsWatcher from "@src/components/RunsWatcher";
import { GlobalAlertProvider } from "@src/components/GlobalAlertProvider";
import { useRunsStore } from "@src/store/runsStore";
import { modelService } from "@src/api/services/modelService";

vi.mock("@src/utils/notifications", () => ({
  notifyRunComplete: vi.fn(() => true),
  requestNotificationPermission: vi.fn(),
}));

const addRun = (jobId: string, status: "queued" | "succeeded") => {
  useRunsStore.getState().addRun({
    jobId,
    modelType: "RTMA",
    dataId: "d1",
    filename: "study-data.csv",
    rowCount: 42,
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
});
