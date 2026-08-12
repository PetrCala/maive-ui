import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import RunsPage from "@src/pages/runs";
import { useRunsStore } from "@src/store/runsStore";
import type { RunStatus } from "@src/types/api";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams(),
}));

// The empty-state GoBackButton uses the Pages-Router useRouter (next/router),
// which the global setup (next/navigation only) does not cover.
vi.mock("next/router", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const addRun = (
  jobId: string,
  filename: string,
  status: RunStatus = "queued",
) => {
  useRunsStore.getState().addRun({
    jobId,
    modelType: "MAIVE",
    dataId: "d1",
    filename,
    rowCount: 120,
    parameters: "{}",
    submittedAt: Date.now(),
    status,
  });
};

const selectRun = (filename: string) =>
  fireEvent.click(
    screen.getByRole("checkbox", {
      name: `Select ${filename} for comparison`,
    }),
  );

describe("RunsPage", () => {
  beforeEach(() => {
    useRunsStore.getState().clearRuns();
    push.mockReset();
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

  describe("comparison selection", () => {
    it("offers a checkbox only for runs that can have a result", () => {
      addRun("job-1", "done.csv", "succeeded");
      addRun("job-2", "waiting.csv", "queued");
      addRun("job-3", "broken.csv", "failed");
      // Expired runs stay selectable: the result may still be cached locally.
      addRun("job-4", "old.csv", "expired");
      render(<RunsPage />);

      expect(screen.getAllByRole("checkbox")).toHaveLength(2);
      expect(
        screen.getByRole("checkbox", { name: /Select done\.csv/ }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("checkbox", { name: /Select old\.csv/ }),
      ).toBeInTheDocument();
    });

    it("hides the selection prompt when nothing is comparable", () => {
      addRun("job-1", "waiting.csv", "queued");
      render(<RunsPage />);

      expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
      expect(screen.queryByText(/side by side/i)).not.toBeInTheDocument();
    });

    it("needs two runs before comparing is allowed", () => {
      addRun("job-1", "a.csv", "succeeded");
      addRun("job-2", "b.csv", "succeeded");
      render(<RunsPage />);

      selectRun("a.csv");
      const compare = screen.getByRole("button", { name: "Compare selected" });
      expect(compare).toBeDisabled();

      selectRun("b.csv");
      expect(compare).toBeEnabled();
    });

    it("navigates to the compare page with the selected ids in tick order", () => {
      addRun("job-1", "a.csv", "succeeded");
      addRun("job-2", "b.csv", "succeeded");
      render(<RunsPage />);

      selectRun("b.csv");
      selectRun("a.csv");
      fireEvent.click(screen.getByRole("button", { name: "Compare selected" }));

      expect(push).toHaveBeenCalledWith("/compare?jobIds=job-2,job-1");
    });

    it("stops the selection at three runs", () => {
      ["a", "b", "c", "d"].forEach((name) =>
        addRun(`job-${name}`, `${name}.csv`, "succeeded"),
      );
      render(<RunsPage />);

      selectRun("a.csv");
      selectRun("b.csv");
      selectRun("c.csv");

      const fourth = screen.getByRole("checkbox", { name: /Select d\.csv/ });
      expect(fourth).toBeDisabled();
      // Already-selected boxes stay clickable, so a choice can be swapped out.
      expect(
        screen.getByRole("checkbox", { name: /Select a\.csv/ }),
      ).toBeEnabled();
    });

    it("clears the selection on request", () => {
      addRun("job-1", "a.csv", "succeeded");
      render(<RunsPage />);

      selectRun("a.csv");
      expect(screen.getByText(/1 of 3 selected/)).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Clear selection" }));
      expect(
        screen.getByRole("checkbox", { name: /Select a\.csv/ }),
      ).not.toBeChecked();
    });
  });
});
