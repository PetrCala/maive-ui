"use client";

import type { ModelResults, ModelParameters } from "@src/types";
import type { DataInfo } from "@src/types/data";
import TEXT from "@src/lib/text";

export type ResultItem = {
  label: string;
  value: string | number;
  show: boolean;
  isSignificant?: boolean;
  isSignificantType?: "positive" | "negative";
  section: "effect" | "bias" | "tests" | "runInfo";
  highlightColor?: string;
  extraText?: string;
  highlightCondition?: boolean;
};

export type ResultsData = {
  coreResults: ResultItem[];
  runInfo: ResultItem[];
};

/**
 * Generate results data for display and export purposes
 */
type ResultsTextContent = typeof TEXT.results;

export const generateResultsData = (
  results: ModelResults,
  parameters?: ModelParameters,
  runDuration?: number,
  runTimestamp?: Date,
  dataInfo?: DataInfo,
  resultsText: ResultsTextContent = TEXT.results,
): ResultsData => {
  const formatValue = (value: number, decimals = 4): string => {
    return value.toFixed(decimals);
  };

  const formatCI = (ci: [number, number]): string => {
    return `[${formatValue(ci[0])}, ${formatValue(ci[1])}]`;
  };

  // Core results
  const coreResults: ResultItem[] = [
    {
      label: resultsText.effectEstimate.metrics.estimate.label,
      value: results.effectEstimate,
      show: true,
      section: "effect",
    },
    {
      label: resultsText.effectEstimate.metrics.standardError.label,
      value: results.standardError,
      show: true,
      section: "effect",
    },
    {
      label: resultsText.effectEstimate.metrics.significance.label,
      value: results.isSignificant ? "Yes" : "No",
      show: true,
      highlightColor: results.isSignificant ? "text-green-600" : "text-red-600",
      section: "effect",
    },
    {
      label: resultsText.effectEstimate.metrics.bootCI.label,
      value: results.bootCI !== "NA" ? formatCI(results.bootCI[0]) : "NA",
      show: results.bootCI !== "NA",
      section: "effect",
    },
    {
      label: resultsText.effectEstimate.metrics.andersonRubinCI.label,
      value:
        results.andersonRubinCI !== "NA"
          ? formatCI(results.andersonRubinCI)
          : "NA",
      show: results.andersonRubinCI !== "NA",
      section: "effect",
    },
    {
      label: resultsText.publicationBias.metrics.eggerCoef.label,
      value: results.publicationBias.eggerCoef,
      show: true,
      section: "bias",
    },
    {
      label: resultsText.publicationBias.metrics.eggerSE.label,
      value: results.publicationBias.eggerSE,
      show: true,
      section: "bias",
    },
    {
      label: resultsText.publicationBias.metrics.pValue.label,
      value: results.publicationBias.pValue,
      show: true,
      section: "bias",
    },
    {
      label: resultsText.publicationBias.metrics.significance.label,
      value: results.publicationBias.isSignificant ? "Yes" : "No",
      show: true,
      highlightColor: results.publicationBias.isSignificant
        ? "text-green-600"
        : "text-red-600",
      section: "bias",
    },
    {
      label: resultsText.diagnosticTests.metrics.hausmanTest.label,
      value: results.hausmanTest.statistic,
      show: parameters?.shouldUseInstrumenting ?? true,
      highlightColor: results.hausmanTest.rejectsNull
        ? "text-green-600"
        : "text-red-600",
      extraText: results.hausmanTest.rejectsNull
        ? " (Rejects Null)"
        : " (Fails to Reject Null)",
      section: "tests",
    },
    {
      label: resultsText.diagnosticTests.metrics.hausmanCriticalValue.label,
      value: results.hausmanTest.criticalValue,
      show: parameters?.shouldUseInstrumenting ?? true,
      section: "tests",
    },
    {
      label: resultsText.diagnosticTests.metrics.firstStageFTest.label,
      value: results.firstStageFTest !== "NA" ? results.firstStageFTest : "NA",
      show:
        (parameters?.shouldUseInstrumenting ?? true) &&
        results.firstStageFTest !== "NA",
      highlightColor:
        results.firstStageFTest !== "NA" && results.firstStageFTest >= 10
          ? "text-green-600"
          : "text-red-600",
      extraText:
        results.firstStageFTest !== "NA" && results.firstStageFTest >= 10
          ? " (Strong)"
          : " (Weak)",
      section: "tests",
    },
  ];

  // Run information
  const runInfo: ResultItem[] = [];

  if (runDuration !== undefined) {
    runInfo.push({
      label: "Run Duration (ms)",
      value: runDuration,
      show: true,
      section: "runInfo",
    });
  }

  if (runTimestamp) {
    runInfo.push({
      label: "Run Timestamp",
      value: runTimestamp.toISOString(),
      show: true,
      section: "runInfo",
    });
  }

  if (dataInfo) {
    runInfo.push(
      {
        label: "Data File",
        value: dataInfo.filename,
        show: true,
        section: "runInfo",
      },
      {
        label: "Observations",
        value: dataInfo.rowCount,
        show: true,
        section: "runInfo",
      },
      {
        label: "Has Study ID",
        value: dataInfo.hasStudyId ? "Yes" : "No",
        show: true,
        section: "runInfo",
      },
    );

    if (dataInfo.studyCount !== undefined) {
      runInfo.push({
        label: "Number of Studies",
        value: dataInfo.studyCount,
        show: true,
        section: "runInfo",
      });
    }

    if (dataInfo.medianObservationsPerStudy !== undefined) {
      runInfo.push({
        label: "Median Observations per Study",
        value: dataInfo.medianObservationsPerStudy.toFixed(1),
        show: true,
        section: "runInfo",
      });
    }
  }

  return {
    coreResults,
    runInfo,
  };
};

/**
 * Convert results data to export format (array of objects with Metric/Value)
 */
export const convertToExportFormat = (
  resultsData: ResultsData,
): Array<{ Metric: string; Value: string | number }> => {
  const allResults = [...resultsData.coreResults, ...resultsData.runInfo];

  return allResults
    .filter((result) => result.show)
    .map((result) => ({
      Metric: result.label,
      Value: result.value,
    }));
};
