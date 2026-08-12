import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import ComparePage from "@src/pages/compare";
import { useRunsStore } from "@src/store/runsStore";
import type { RTMAResults } from "@src/types/api";

const push = vi.fn();
let searchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => searchParams,
}));

// The empty-state GoBackButton uses the Pages-Router useRouter.
vi.mock("next/router", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const getResult = vi.fn();
const putResult = vi.fn();
vi.mock("@src/utils/runsCache", () => ({
  getResult: (jobId: string): unknown => getResult(jobId),
  putResult: (jobId: string, result: unknown): unknown =>
    putResult(jobId, result),
  deleteResult: vi.fn(),
  clearAllResults: vi.fn(),
}));

const getRun = vi.fn();
vi.mock("@api/services/modelService", () => ({
  modelService: {
    getRun: (jobId: string): unknown => getRun(jobId),
  },
}));

const rtmaResult = (mu: number): RTMAResults => ({
  mu,
  muCI: [mu - 0.5, mu + 0.5],
  tau: 1.2,
  tauCI: [0.9, 1.6],
  zScorePlot: "data:image/png;base64,xxx",
  zScorePlotWidth: 600,
  zScorePlotHeight: 400,
  nonaffirmativeCount: 67,
  nonaffirmativeProportion: 0.905,
  warnings: [],
});

const addRun = (jobId: string, filename: string, modelType = "RTMA") => {
  useRunsStore.getState().addRun({
    jobId,
    modelType,
    dataId: "d1",
    filename,
    rowCount: 120,
    parameters: JSON.stringify({ modelType }),
    submittedAt: Date.now(),
    status: "succeeded",
  });
};

describe("ComparePage", () => {
  beforeEach(() => {
    useRunsStore.getState().clearRuns();
    searchParams = new URLSearchParams();
    push.mockReset();
    getResult.mockReset();
    putResult.mockReset();
    getRun.mockReset();
  });

  it("prompts for a selection when fewer than two runs are requested", () => {
    searchParams = new URLSearchParams({ jobIds: "job-1" });
    getResult.mockResolvedValue(undefined);

    render(<ComparePage />);

    expect(screen.getByText(/pick at least 2 finished runs/i)).toBeVisible();
  });

  it("renders one card per run, reading results from the local cache", async () => {
    addRun("job-1", "study-a.csv");
    addRun("job-2", "study-b.csv");
    searchParams = new URLSearchParams({ jobIds: "job-1,job-2" });
    getResult.mockImplementation((jobId: string) =>
      Promise.resolve(rtmaResult(jobId === "job-1" ? 5 : 9)),
    );

    render(<ComparePage />);

    expect(await screen.findByText("study-a.csv")).toBeVisible();
    expect(screen.getByText("study-b.csv")).toBeVisible();
    // The two runs' distinct effect estimates both render, which is the whole
    // point of the page.
    await waitFor(() => {
      expect(screen.getByText(/5\.000 \[4\.500, 5\.500\]/)).toBeVisible();
      expect(screen.getByText(/9\.000 \[8\.500, 9\.500\]/)).toBeVisible();
    });
    // A cache hit must not go to the network.
    expect(getRun).not.toHaveBeenCalled();
  });

  it("falls back to the server on a cache miss and caches what it gets back", async () => {
    addRun("job-1", "study-a.csv");
    addRun("job-2", "study-b.csv");
    searchParams = new URLSearchParams({ jobIds: "job-1,job-2" });
    getResult.mockResolvedValue(undefined);
    getRun.mockImplementation((jobId: string) =>
      Promise.resolve({
        status: "succeeded",
        result: JSON.stringify(rtmaResult(jobId === "job-1" ? 5 : 9)),
      }),
    );

    render(<ComparePage />);

    await waitFor(() => {
      expect(screen.getByText(/5\.000 \[4\.500, 5\.500\]/)).toBeVisible();
    });
    expect(getRun).toHaveBeenCalledWith("job-1");
    expect(putResult).toHaveBeenCalledWith("job-1", expect.anything());
  });

  it("explains a missing result per card instead of failing the whole page", async () => {
    addRun("job-1", "study-a.csv");
    addRun("job-2", "study-b.csv");
    searchParams = new URLSearchParams({ jobIds: "job-1,job-2" });
    getResult.mockResolvedValue(undefined);
    getRun.mockImplementation((jobId: string) =>
      jobId === "job-1"
        ? Promise.resolve({
            status: "succeeded",
            result: JSON.stringify(rtmaResult(5)),
          })
        : Promise.reject(new Error("gone")),
    );

    render(<ComparePage />);

    // The healthy run still renders alongside the explanation for the other.
    await waitFor(() => {
      expect(screen.getByText(/5\.000 \[4\.500, 5\.500\]/)).toBeVisible();
    });
    expect(await screen.findByText(/48-hour server window/i)).toBeVisible();
  });

  it("warns when the selected runs are of different model types", async () => {
    addRun("job-1", "study-a.csv", "RTMA");
    addRun("job-2", "study-b.csv", "MAIVE");
    searchParams = new URLSearchParams({ jobIds: "job-1,job-2" });
    getResult.mockResolvedValue(undefined);
    getRun.mockResolvedValue({ status: "expired", result: null });

    render(<ComparePage />);

    expect(await screen.findByText(/different model types/i)).toBeVisible();
  });

  it("reads the ids from the URL when the router has not supplied them yet", async () => {
    // The pre-hydration render of a hard load: useSearchParams() is empty even
    // though the browser has the query. Falling back to window.location is what
    // stops the page painting "pick at least 2 runs" at someone who picked two.
    addRun("job-1", "study-a.csv");
    addRun("job-2", "study-b.csv");
    searchParams = new URLSearchParams();
    window.history.replaceState({}, "", "/compare?jobIds=job-1,job-2");
    getResult.mockResolvedValue(rtmaResult(5));

    render(<ComparePage />);

    expect(await screen.findByText("study-a.csv")).toBeVisible();
    expect(screen.getByText("study-b.csv")).toBeVisible();
    expect(
      screen.queryByText(/pick at least 2 finished runs/i),
    ).not.toBeInTheDocument();

    window.history.replaceState({}, "", "/");
  });

  it("ignores duplicate ids and caps the comparison at three runs", async () => {
    ["job-1", "job-2", "job-3", "job-4"].forEach((id, index) =>
      addRun(id, `study-${index}.csv`),
    );
    searchParams = new URLSearchParams({
      jobIds: "job-1,job-1,job-2,job-3,job-4",
    });
    getResult.mockResolvedValue(rtmaResult(5));

    render(<ComparePage />);

    await screen.findByText("study-0.csv");
    expect(screen.getAllByText("study-0.csv")).toHaveLength(1);
    // job-4 is past the cap, so its card is never rendered.
    expect(screen.queryByText("study-3.csv")).not.toBeInTheDocument();
  });
});
