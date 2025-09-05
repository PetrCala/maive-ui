"use client";

import type { ModelResults, ModelParameters } from "@src/types";

export type ResultItem = {
  label: string;
  value: string | number;
  show: boolean;
  isSignificant?: boolean;
  isSignificantType?: "positive" | "negative";
};

export type ResultsData = {
  coreResults: ResultItem[];
  conditionalResults: ResultItem[];
  bootstrapResults: ResultItem[];
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
      label: "Effect Estimate",
      value: results.effectEstimate,
      show: true,
    },
    {
      label: "Standard Error",
      value: results.standardError,
      show: true,
    },
    {
      label: "Significant",
      value: results.isSignificant ? "Yes" : "No",
      show: true,
      isSignificant: results.isSignificant,
    },
    {
      label: "Publication Bias p-value",
      value: results.publicationBias.pValue,
      show: true,
    },
    {
      label: "Publication Bias Significant",
      value: results.publicationBias.isSignificant ? "Yes" : "No",
      show: true,
      isSignificant: results.publicationBias.isSignificant,
    },
  ];

  // Conditional results
  const conditionalResults: ResultItem[] = [
    {
      label: "Anderson-Rubin CI",
      value:
        results.andersonRubinCI !== "NA"
          ? formatCI(results.andersonRubinCI)
          : "NA",
      show: results.andersonRubinCI !== "NA",
    },
    {
      label: "First Stage F-test",
      value: results.firstStageFTest !== "NA" ? results.firstStageFTest : "NA",
      show: results.firstStageFTest !== "NA",
    },
    {
      label: "Hausman Test Statistic",
      value: results.hausmanTest.statistic,
      show: true,
    },
    {
      label: "Hausman Critical Value",
      value: results.hausmanTest.criticalValue,
      show: true,
    },
    {
      label: "Hausman Rejects Null",
      value: results.hausmanTest.rejectsNull ? "Yes" : "No",
      show: true,
      isSignificant: results.hausmanTest.rejectsNull,
    },
  ];

  // Bootstrap results
  const bootstrapResults: ResultItem[] = [
    {
      label: "Bootstrap CI (Effect)",
      value: results.bootCI !== "NA" ? formatCI(results.bootCI[0]) : "NA",
      show: results.bootCI !== "NA",
    },
    {
      label: "Bootstrap CI (SE)",
      value: results.bootCI !== "NA" ? formatCI(results.bootCI[1]) : "NA",
      show: results.bootCI !== "NA",
    },
    {
      label: "Bootstrap SE (Effect)",
      value: results.bootSE !== "NA" ? results.bootSE[0] : "NA",
      show: results.bootSE !== "NA",
    },
    {
      label: "Bootstrap SE (SE)",
      value: results.bootSE !== "NA" ? results.bootSE[1] : "NA",
      show: results.bootSE !== "NA",
    },
  ];

  // Run information
  const runInfo: ResultItem[] = [];

  if (runDuration !== undefined) {
    runInfo.push({
      label: "Run Duration (ms)",
      value: runDuration,
      show: true,
    });
  }

  if (runTimestamp) {
    runInfo.push({
      label: "Run Timestamp",
      value: runTimestamp.toISOString(),
      show: true,
    });
  }

  if (dataInfo) {
    runInfo.push(
      {
        label: "Data File",
        value: dataInfo.filename,
        show: true,
      },
      {
        label: "Observations",
        value: dataInfo.rowCount,
        show: true,
      },
      {
        label: "Has Study ID",
        value: dataInfo.hasStudyId ? "Yes" : "No",
        show: true,
      },
    );
  }

  return {
    coreResults,
    conditionalResults,
    bootstrapResults,
    runInfo,
  };
};

/**
 * Convert results data to export format (array of objects with Metric/Value)
 */
export const convertToExportFormat = (
  resultsData: ResultsData,
): Array<{ Metric: string; Value: string | number }> => {
  const allResults = [
    ...resultsData.coreResults,
    ...resultsData.conditionalResults,
    ...resultsData.bootstrapResults,
    ...resultsData.runInfo,
  ];

  return allResults
    .filter((result) => result.show)
    .map((result) => ({
      Metric: result.label,
      Value: result.value,
    }));
};
