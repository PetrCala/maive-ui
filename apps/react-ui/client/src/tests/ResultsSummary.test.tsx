import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ResultsSummary from "@components/ResultsSummary";
import type { ModelParameters, ModelResults } from "@src/types/api";

const parameters: ModelParameters = {
  modelType: "MAIVE",
  includeStudyDummies: true,
  includeStudyClustering: true,
  standardErrorTreatment: "clustered_cr2",
  computeAndersonRubin: false,
  maiveMethod: "PET-PEESE",
  weight: "equal_weights",
  shouldUseInstrumenting: true,
  useLogFirstStage: false,
  winsorize: 0,
  favorPositive: true,
};

const results: ModelResults = {
  effectEstimate: 0.00046,
  standardError: 0.0000231,
  isSignificant: true,
  andersonRubinCI: "NA",
  publicationBias: {
    eggerCoef: 1.2,
    eggerSE: 0.4,
    isSignificant: true,
    eggerBootCI: "NA",
    eggerAndersonRubinCI: "NA",
    pValue: 0.01,
  },
  firstStageFStatistic: 3746.02,
  hausmanTest: {
    statistic: 0.0007,
    criticalValue: 3.8415,
    rejectsNull: false,
  },
  seInstrumented: [0.0004, 0.0003],
  funnelPlot: "",
  funnelPlotWidth: 400,
  funnelPlotHeight: 300,
  bootCI: "NA",
  bootSE: "NA",
  instrument_strength: "strong",
};

const smallSampleWarning =
  "Sample size (8) is small for IV estimation. Results may be unreliable.";

describe("ResultsSummary warnings", () => {
  it("surfaces backend warnings ahead of the results", () => {
    render(
      <ResultsSummary
        results={{ ...results, warnings: [smallSampleWarning] }}
        parameters={parameters}
      />,
    );

    expect(screen.getByText(smallSampleWarning)).toBeInTheDocument();
  });

  it("surfaces warnings in the vertical modal layout too", () => {
    render(
      <ResultsSummary
        results={{ ...results, warnings: [smallSampleWarning] }}
        parameters={parameters}
        layout="vertical"
        columns={1}
      />,
    );

    expect(screen.getByText(smallSampleWarning)).toBeInTheDocument();
  });

  it("shows nothing extra for a clean run or a run stored before warnings existed", () => {
    const { unmount } = render(
      <ResultsSummary
        results={{ ...results, warnings: [] }}
        parameters={parameters}
      />,
    );
    expect(screen.queryByText(/small for IV/)).not.toBeInTheDocument();
    unmount();

    render(<ResultsSummary results={results} parameters={parameters} />);
    expect(screen.queryByText(/small for IV/)).not.toBeInTheDocument();
  });

  it("renders an undefined significance verdict as NA", () => {
    render(
      <ResultsSummary
        results={{ ...results, standardError: 1.2e-17, isSignificant: null }}
        parameters={parameters}
      />,
    );

    expect(screen.getAllByText("NA").length).toBeGreaterThan(0);
    expect(screen.queryByText("No")).not.toBeInTheDocument();
  });
});
