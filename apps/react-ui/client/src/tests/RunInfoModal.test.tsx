import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import RunInfoModal from "@components/Modals/RunInfoModal";
import TEXT from "@src/lib/text";
import type {
  ModelParameters,
  ModelResults,
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
};

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
});
