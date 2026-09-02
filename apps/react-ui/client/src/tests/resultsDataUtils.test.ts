import { describe, it, expect } from "vitest";
import { generateResultsData } from "@src/utils/resultsDataUtils";
import type { ModelParameters, ModelResults } from "@src/types/api";
import TEXT from "@src/lib/text";

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
  effectEstimate: 0.3,
  standardError: 0.05,
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
  firstStageFStatistic: 42.1,
  hausmanTest: {
    statistic: 5.2,
    criticalValue: 3.8415,
    rejectsNull: true,
  },
  seInstrumented: [0.05, 0.06],
  funnelPlot: "",
  funnelPlotWidth: 400,
  funnelPlotHeight: 300,
  bootCI: "NA",
  bootSE: "NA",
  warnings: [],
};

const findItem = (
  data: ReturnType<typeof generateResultsData>,
  label: string,
) => data.coreResults.find((item) => item.label === label);

const effectSignificanceLabel =
  TEXT.results.effectEstimate.metrics.significance.label;
const biasSignificanceLabel =
  TEXT.results.publicationBias.metrics.significance.label;
const hausmanLabel = TEXT.results.diagnosticTests.metrics.hausmanTest.label;

describe("generateResultsData significance verdicts", () => {
  it("renders boolean verdicts as Yes/No with a colour", () => {
    const data = generateResultsData(results, parameters);

    const effect = findItem(data, effectSignificanceLabel);
    expect(effect?.value).toBe("Yes");
    expect(effect?.highlightColor).toBe("text-green-600");

    const bias = findItem(data, biasSignificanceLabel);
    expect(bias?.value).toBe("Yes");
    expect(bias?.highlightColor).toBe("text-green-600");

    const noData = generateResultsData(
      {
        ...results,
        isSignificant: false,
        publicationBias: { ...results.publicationBias, isSignificant: false },
      },
      parameters,
    );
    expect(findItem(noData, effectSignificanceLabel)?.value).toBe("No");
    expect(findItem(noData, effectSignificanceLabel)?.highlightColor).toBe(
      "text-red-600",
    );
    expect(findItem(noData, biasSignificanceLabel)?.value).toBe("No");
  });

  it("renders an undefined verdict as NA with no colour, not as a red No", () => {
    const data = generateResultsData(
      {
        ...results,
        standardError: 1.2e-17,
        isSignificant: null,
        publicationBias: { ...results.publicationBias, isSignificant: null },
        hausmanTest: {
          statistic: Number.NaN,
          criticalValue: 3.8415,
          rejectsNull: null,
        },
      },
      parameters,
    );

    const effect = findItem(data, effectSignificanceLabel);
    expect(effect?.value).toBe("NA");
    expect(effect?.highlightColor).toBeUndefined();

    const bias = findItem(data, biasSignificanceLabel);
    expect(bias?.value).toBe("NA");
    expect(bias?.highlightColor).toBeUndefined();

    const hausman = findItem(data, hausmanLabel);
    expect(hausman?.value).toBe("NA");
    expect(hausman?.highlightColor).toBeUndefined();
    expect(hausman?.extraText).toBeUndefined();
  });

  it("treats a null Hausman verdict as undefined even with a finite statistic", () => {
    const data = generateResultsData(
      {
        ...results,
        hausmanTest: {
          statistic: 5.2,
          criticalValue: 3.8415,
          rejectsNull: null,
        },
      },
      parameters,
    );

    const hausman = findItem(data, hausmanLabel);
    expect(hausman?.value).toBe(5.2);
    expect(hausman?.highlightColor).toBeUndefined();
    expect(hausman?.extraText).toBeUndefined();
  });
});
