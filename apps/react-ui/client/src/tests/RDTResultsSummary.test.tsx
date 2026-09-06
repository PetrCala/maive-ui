import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import RDTResultsSummary from "@components/RDTResultsSummary";
import TEXT from "@src/lib/text";
import type { RDTFit, RDTResults } from "@src/types/api";

const fit = (jump: number, cutoff: number): RDTFit => ({
  jump,
  jumpSE: 0.1,
  jumpCI: [jump - 0.2, jump + 0.2],
  pValue: 0.3,
  bandwidth: 0.7,
  cutoff,
  nLeft: 20,
  nRight: 25,
  studies: 18,
});

const baseResults: RDTResults = {
  model: "RDT",
  jump: -0.125,
  jumpSE: 0.117,
  jumpCI: [-0.36, 0.11],
  pValue: 0.294,
  df: 14.8,
  cutoff: 1.96,
  bandwidth: 0.7,
  windowT: [0.978, 3.929],
  nLeft: 44,
  nRight: 52,
  studies: 30,
  hasStudyColumn: true,
  k: 150,
  droppedRows: 0,
  minDetectableJump: 0.3276,
  firstStage: { slope: -0.5, rSquared: 0.747 },
  sensitivity: { half: fit(-0.1, 1.96), double: fit(-0.14, 1.96) },
  placebo: { below: fit(0.05, 0.84), above: fit(-0.02, 2.59) },
  warnings: [],
  plot: "data:image/png;base64,xxx",
  plotWidth: 840,
  plotHeight: 660,
};

const alertTexts = (): string[] =>
  screen.queryAllByRole("alert").map((alert) => alert.textContent ?? "");

describe("RDTResultsSummary", () => {
  it("shows the headline jump with its interval and the sign convention", () => {
    render(<RDTResultsSummary results={baseResults} />);
    expect(screen.getByText(TEXT.rdt.results.jump.label)).toBeInTheDocument();
    expect(screen.getByText("-0.125 [-0.360, 0.110]")).toBeInTheDocument();
    expect(
      screen.getByText(/negative = estimates just past the threshold/),
    ).toBeInTheDocument();
  });

  it("keeps the minimum detectable jump line so a null is not read as clean data", () => {
    render(<RDTResultsSummary results={baseResults} />);
    expect(
      screen.getByText(TEXT.rdt.results.detectable.label),
    ).toBeInTheDocument();
    expect(screen.getByText("0.328")).toBeInTheDocument();
    expect(
      screen.getByText(/below the detectable size, a null result says nothing/),
    ).toBeInTheDocument();
  });

  it("describes the estimation window with counts, studies and dropped rows", () => {
    render(<RDTResultsSummary results={baseResults} />);
    expect(
      screen.getByText(
        /\|t\| from 0\.98 to 3\.93 \(bandwidth 0\.70 log points\)/,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /44 below and 52 above the cutoff inside it, 30 studies; 150 rows used, 0 dropped/,
      ),
    ).toBeInTheDocument();
  });

  it("renders the three checks with their notes", () => {
    render(<RDTResultsSummary results={baseResults} />);
    expect(screen.getByText(/slope -0\.500, R² 0\.747/)).toBeInTheDocument();
    expect(
      screen.getByText(/h\/2: -0\.100 \[-0\.300, 0\.100\]; 2h: -0\.140/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /at \|t\| = 0\.84: 0\.050 .*; at \|t\| = 2\.59: -0\.020/,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(TEXT.rdt.results.checks.sensitivity.note),
    ).toBeInTheDocument();
    expect(
      screen.getByText(TEXT.rdt.results.checks.placebo.note),
    ).toBeInTheDocument();
  });

  it("shows both mandatory interpretation paragraphs verbatim", () => {
    render(<RDTResultsSummary results={baseResults} />);
    expect(
      screen.getByText(TEXT.rdt.results.interpretation),
    ).toBeInTheDocument();
    expect(screen.getByText(TEXT.rdt.results.caution)).toBeInTheDocument();
    expect(TEXT.rdt.results.interpretation).toMatch(
      /Selection on significance alone cannot produce it/,
    );
    expect(TEXT.rdt.results.caution).toMatch(
      /RDT is experimental and reports no corrected effect/,
    );
  });

  it("warns when the first stage leaves no residual variation", () => {
    render(
      <RDTResultsSummary
        results={{
          ...baseResults,
          firstStage: { slope: -0.5, rSquared: 0.9999 },
        }}
      />,
    );
    expect(
      alertTexts().filter((text) => /R-squared above 0\.99/.test(text)),
    ).toHaveLength(1);
  });

  it("does not show the first-stage warning at an ordinary R-squared", () => {
    render(<RDTResultsSummary results={baseResults} />);
    expect(
      alertTexts().filter((text) => /R-squared above 0\.99/.test(text)),
    ).toHaveLength(0);
  });

  it("surfaces backend warnings as alerts", () => {
    render(
      <RDTResultsSummary
        results={{
          ...baseResults,
          hasStudyColumn: false,
          warnings: [
            "The data has no study column, so standard errors are clustered by estimate.",
          ],
        }}
      />,
    );
    expect(
      alertTexts().filter((text) => /no study column/.test(text)),
    ).toHaveLength(1);
    expect(screen.getByText(/30 estimates as clusters/)).toBeInTheDocument();
  });

  it("reports a check fit that could not be computed instead of a number", () => {
    render(
      <RDTResultsSummary
        results={{
          ...baseResults,
          placebo: {
            below: { unavailable: "Too few estimates on one side" },
            above: fit(-0.02, 2.59),
          },
        }}
      />,
    );
    expect(
      screen.getByText(
        /at \|t\| = median below: not available \(Too few estimates on one side\)/,
      ),
    ).toBeInTheDocument();
  });
});
