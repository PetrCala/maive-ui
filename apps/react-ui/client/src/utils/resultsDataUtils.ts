"use client";

import type { ModelResults, ModelParameters } from "@src/types";
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
export const generateResultsData = (
  results: ModelResults,
  parameters?: ModelParameters,
  runDuration?: number,
  runTimestamp?: Date,
  dataInfo?: {
    filename: string;
    rowCount: number;
    hasStudyId: boolean;
  },
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
      label: TEXT.results.effectEstimate.metrics.estimate.label,
      value: results.effectEstimate,
      show: true,
      section: "effect",
    },
    {
      label: TEXT.results.effectEstimate.metrics.standardError.label,
      value: results.standardError,
      show: true,
      section: "effect",
    },
    {
      label: TEXT.results.effectEstimate.metrics.significance.label,
      value: results.isSignificant ? "Yes" : "No",
      show: true,
      highlightColor: results.isSignificant ? "text-green-600" : "text-red-600",
      section: "effect",
    },
    {
      label: TEXT.results.effectEstimate.metrics.andersonRubinCI.label,
      value:
        results.andersonRubinCI !== "NA"
          ? formatCI(results.andersonRubinCI)
          : "NA",
      show: results.andersonRubinCI !== "NA",
      section: "effect",
    },
    {
      label: TEXT.results.effectEstimate.metrics.bootCI.label,
      value: results.bootCI !== "NA" ? formatCI(results.bootCI[0]) : "NA",
      show: results.bootCI !== "NA",
      section: "effect",
    },
    {
      label: TEXT.results.publicationBias.metrics.pValue.label,
      value: results.publicationBias.pValue,
      show: true,
      section: "bias",
    },
    {
      label: TEXT.results.publicationBias.metrics.significance.label,
      value: results.publicationBias.isSignificant ? "Yes" : "No",
      show: true,
      highlightColor: results.publicationBias.isSignificant
        ? "text-green-600"
        : "text-red-600",
      section: "bias",
    },
    {
      label: TEXT.results.diagnosticTests.metrics.hausmanTest.label,
      value: results.hausmanTest.statistic,
      show: true,
      highlightColor: results.hausmanTest.rejectsNull
        ? "text-green-600"
        : "text-red-600",
      extraText: results.hausmanTest.rejectsNull
        ? " (Rejects Null)"
        : " (Fails to Reject Null)",
      section: "tests",
    },
    {
      label: TEXT.results.diagnosticTests.metrics.hausmanCriticalValue.label,
      value: results.hausmanTest.criticalValue,
      show: true,
      section: "tests",
    },
    {
      label: TEXT.results.diagnosticTests.metrics.firstStageFTest.label,
      value: results.firstStageFTest !== "NA" ? results.firstStageFTest : "NA",
      show: results.firstStageFTest !== "NA",
      highlightColor:
        results.firstStageFTest !== "NA" && results.firstStageFTest >= 10
          ? "text-green-600"
          : "text-red-600",
      extraText:
        results.firstStageFTest !== "NA" && results.firstStageFTest > 10
          ? " (Strong)"
          : "",
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
