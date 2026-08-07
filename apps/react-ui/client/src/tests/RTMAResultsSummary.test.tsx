import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import RTMAResultsSummary from "@components/RTMAResultsSummary";
import type { RTMAResults } from "@src/types/api";

const baseResults: RTMAResults = {
  mu: 5.171,
  muCI: [4.5, 5.9],
  tau: 1.2,
  tauCI: [0.9, 1.6],
  zScorePlot: "data:image/png;base64,xxx",
  zScorePlotWidth: 600,
  zScorePlotHeight: 400,
  nonaffirmativeCount: 67,
  nonaffirmativeProportion: 0.905,
  warnings: [],
};

const fullResults: RTMAResults = {
  ...baseResults,
  muMedian: 5.233,
  tauMedian: 1.25,
  unadjustedMean: 3.081,
  ciLevel: 0.95,
  k: 74,
  affirmativeCount: 7,
  droppedRows: 2,
};

describe("RTMAResultsSummary", () => {
  it("shows the unadjusted mean next to the corrected effect", () => {
    render(<RTMAResultsSummary results={fullResults} />);

    expect(screen.getByText("Corrected Effect (μ)")).toBeInTheDocument();
    expect(screen.getByText("Unadjusted Mean")).toBeInTheDocument();
    expect(screen.getByText("3.081")).toBeInTheDocument();
  });

  it("labels the nonaffirmative count as not affirmative, not non-significant", () => {
    render(<RTMAResultsSummary results={fullResults} />);

    expect(screen.getByText("Not Affirmative Estimates")).toBeInTheDocument();
    expect(screen.getByText("67 (90.5%)")).toBeInTheDocument();
    expect(screen.queryByText(/Non-significant/)).not.toBeInTheDocument();
  });

  it("shows posterior medians alongside the modes", () => {
    render(<RTMAResultsSummary results={fullResults} />);

    expect(screen.getByText("median 5.233")).toBeInTheDocument();
    expect(screen.getByText("median 1.250")).toBeInTheDocument();
  });

  it("reports k, the affirmative share, and dropped rows", () => {
    render(<RTMAResultsSummary results={fullResults} />);

    expect(screen.getByText("Estimates Used (k)")).toBeInTheDocument();
    expect(screen.getByText("74")).toBeInTheDocument();
    expect(screen.getByText("7 affirmative")).toBeInTheDocument();
    expect(
      screen.getByText(
        /2 uploaded rows were dropped before fitting because of a missing or non-positive standard error\./,
      ),
    ).toBeInTheDocument();
  });

  it("renders legacy stored results without the newer fields", () => {
    render(<RTMAResultsSummary results={baseResults} />);

    expect(screen.getByText("Corrected Effect (μ)")).toBeInTheDocument();
    expect(screen.getByText("Not Affirmative Estimates")).toBeInTheDocument();
    expect(screen.queryByText("Unadjusted Mean")).not.toBeInTheDocument();
    expect(screen.queryByText("Estimates Used (k)")).not.toBeInTheDocument();
    expect(
      screen.queryByText(/dropped before fitting/),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/median/)).not.toBeInTheDocument();
  });

  it("still surfaces backend warnings", () => {
    render(
      <RTMAResultsSummary
        results={{ ...fullResults, warnings: ["Favored direction check"] }}
      />,
    );

    expect(screen.getByText("Favored direction check")).toBeInTheDocument();
  });
});
