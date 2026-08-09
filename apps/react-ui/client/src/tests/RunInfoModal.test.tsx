import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import RunInfoModal from "@components/Modals/RunInfoModal";
import TEXT from "@src/lib/text";
import type {
  ModelParameters,
  ModelResults,
  RTMADiagnostics,
  RTMAResults,
} from "@src/types/api";

const maiveParameters: ModelParameters = {
  modelType: "MAIVE",
  includeStudyDummies: false,
  includeStudyClustering: false,
  standardErrorTreatment: "clustered_cr2",
  computeAndersonRubin: false,
  maiveMethod: "PET-PEESE",
  weight: "equal_weights",
  shouldUseInstrumenting: true,
  useLogFirstStage: false,
  winsorize: 0,
  favorPositive: true,
};

const rtmaParameters: ModelParameters = {
  ...maiveParameters,
  modelType: "RTMA",
};

const modelResults: ModelResults = {
  effectEstimate: 0.42,
  standardError: 0.11,
  isSignificant: true,
  andersonRubinCI: "NA",
  publicationBias: {
    eggerCoef: 0.3,
    eggerSE: 0.1,
    isSignificant: true,
    eggerBootCI: "NA",
    eggerAndersonRubinCI: "NA",
  },
  firstStageFStatistic: 22.5,
  hausmanTest: {
    statistic: 1.2,
    criticalValue: 3.84,
    rejectsNull: false,
  },
  seInstrumented: [0.1, 0.2],
  funnelPlot: "data:image/png;base64,xxx",
  funnelPlotWidth: 600,
  funnelPlotHeight: 400,
  bootCI: "NA",
  bootSE: "NA",
};

/** A run stored before the backend started pinning and reporting a seed */
const withoutSeed = (results: RTMAResults): RTMAResults => {
  const legacy = { ...results };
  delete legacy.seed;
  return legacy;
};

/** A run stored before the backend started reporting convergence diagnostics */
const withoutDiagnostics = (results: RTMAResults): RTMAResults => {
  const legacy = { ...results };
  delete legacy.diagnostics;
  return legacy;
};

const healthyDiagnostics: RTMADiagnostics = {
  optimConverged: true,
  rHat: { mu: 1.0028, tau: 1.0012 },
  nEff: { mu: 1419.93, tau: 1548.37 },
  divergences: 0,
};

const rtmaResults: RTMAResults = {
  mu: 0.12,
  muCI: [0.07, 0.31],
  tau: 0.03,
  tauCI: [0.01, 0.16],
  zScorePlot: "data:image/png;base64,xxx",
  zScorePlotWidth: 600,
  zScorePlotHeight: 400,
  nonaffirmativeCount: 26,
  nonaffirmativeProportion: 0.65,
  warnings: [],
  seed: 4242,
  diagnostics: healthyDiagnostics,
};

/**
 * Read the value shown next to a run-detail label.
 *
 * Values like "Yes" also appear in the Run Settings grid below, so a bare
 * getByText would be ambiguous; this pins the assertion to the labelled row.
 */
const detailValue = (label: string): string =>
  screen
    .getByText(`${label}:`)
    .parentElement?.textContent?.replace(`${label}:`, "")
    .trim() ?? "";

const renderModal = (
  parameters: ModelParameters,
  results?: RTMAResults | null,
) =>
  render(
    <RunInfoModal
      isOpen={true}
      onClose={() => {}}
      parameters={parameters}
      results={modelResults}
      rtmaResults={results}
      onExportButtonClick={() => {}}
      resultsText={TEXT.results}
    />,
  );

describe("RunInfoModal", () => {
  it("reports the seed an RTMA run was sampled under", () => {
    renderModal(rtmaParameters, rtmaResults);

    expect(screen.getByText("Sampler Seed:")).toBeInTheDocument();
    expect(screen.getByText("4242")).toBeInTheDocument();
  });

  it("says so when an RTMA run predates seeded sampling", () => {
    renderModal(rtmaParameters, withoutSeed(rtmaResults));

    expect(screen.getByText("Sampler Seed:")).toBeInTheDocument();
    expect(screen.getByText("Not recorded")).toBeInTheDocument();
  });

  it("shows no seed for models that do not sample", () => {
    renderModal(maiveParameters, null);

    expect(screen.queryByText("Sampler Seed:")).not.toBeInTheDocument();
  });

  it("reports the convergence diagnostics behind an RTMA fit", () => {
    renderModal(rtmaParameters, rtmaResults);

    expect(detailValue("Mode Optimisation")).toBe("Yes");
    expect(detailValue("R-hat (μ / τ)")).toBe("1.003 / 1.001");
    expect(detailValue("Effective Draws (μ / τ)")).toBe("1,420 / 1,548");
    expect(detailValue("Divergent Transitions")).toBe("0");
  });

  it("says a failed optimisation failed rather than hiding it", () => {
    renderModal(rtmaParameters, {
      ...rtmaResults,
      diagnostics: { ...healthyDiagnostics, optimConverged: false },
    });

    expect(detailValue("Mode Optimisation")).toBe("No");
  });

  it("says so when an RTMA run predates convergence diagnostics", () => {
    renderModal(rtmaParameters, withoutDiagnostics(rtmaResults));

    // Absence must not read as "converged fine".
    expect(detailValue("Convergence Diagnostics")).toBe("Not recorded");
    expect(screen.queryByText("Mode Optimisation:")).not.toBeInTheDocument();
  });

  it("shows no diagnostics for models that do not sample", () => {
    renderModal(maiveParameters, null);

    expect(screen.queryByText("Mode Optimisation:")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Convergence Diagnostics:"),
    ).not.toBeInTheDocument();
  });
});
