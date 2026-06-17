import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import RunsPage from "@src/pages/runs";
import { useRunsStore } from "@src/store/runsStore";

// The empty-state GoBackButton uses the Pages-Router useRouter (next/router),
// which the global setup (next/navigation only) does not cover.
vi.mock("next/router", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const addRun = (jobId: string, filename: string) => {
  useRunsStore.getState().addRun({
    jobId,
    modelType: "MAIVE",
    dataId: "d1",
    filename,
    rowCount: 120,
    parameters: "{}",
    submittedAt: Date.now(),
    status: "queued",
  });
};

describe("RunsPage", () => {
  beforeEach(() => {
    useRunsStore.getState().clearRuns();
  });

  it("shows the dataset filename and the device-local note", () => {
    addRun("job-1", "my-study.csv");
    render(<RunsPage />);

    expect(screen.getByText("my-study.csv")).toBeInTheDocument();
    expect(screen.getByText(/saved on this device/i)).toBeInTheDocument();
    // Model type is demoted to a secondary tag, not the primary label.
    expect(screen.getByText("MAIVE")).toBeInTheDocument();
  });

  it("renders an empty state with no device note", () => {
    render(<RunsPage />);
    expect(screen.getByText(/you have no runs yet/i)).toBeInTheDocument();
    expect(screen.queryByText(/saved on this device/i)).not.toBeInTheDocument();
  });

  it("only clears runs after confirming in the dialog", () => {
    addRun("job-1", "my-study.csv");
    render(<RunsPage />);

    // Opening the confirm dialog must not clear anything yet.
    fireEvent.click(screen.getByRole("button", { name: "Clear all" }));
    expect(useRunsStore.getState().runsList).toHaveLength(1);

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/can't be undone/i)).toBeInTheDocument();

    // Confirming inside the dialog clears the list.
    fireEvent.click(within(dialog).getByRole("button", { name: "Clear all" }));
    expect(useRunsStore.getState().runsList).toHaveLength(0);
  });
});
