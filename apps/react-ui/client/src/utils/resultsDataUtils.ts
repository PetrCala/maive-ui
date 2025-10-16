"use client";

import type { ModelResults, ModelParameters } from "@src/types";
import type { DataInfo } from "@src/types/data";
import TEXT from "@src/lib/text";
import CONST from "@src/CONST";

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

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const isBoolean = (value: unknown): value is boolean => typeof value === "boolean";

const formatValue = (value: unknown, decimals = 4): string => {
  if (!isFiniteNumber(value)) {
    return "NA";
  }

  return value.toFixed(decimals);
};

const formatCI = (ci: unknown, decimals = 4): string => {
  if (!Array.isArray(ci) || ci.length !== 2) {
    return "NA";
  }

  const [lower, upper] = ci as [unknown, unknown];

  if (!isFiniteNumber(lower) || !isFiniteNumber(upper)) {
    return "NA";
  }

  return `[${formatValue(lower, decimals)}, ${formatValue(upper, decimals)}]`;
};

const hasValidCI = (ci: unknown): ci is [number, number] =>
  Array.isArray(ci) &&
  ci.length === 2 &&
  ci.every((value) => isFiniteNumber(value));

const hasValidBootCI = (
  ci: unknown,
): ci is [[number, number], [number, number]] =>
  Array.isArray(ci) &&
  ci.length === 2 &&
  ci.every((entry) => hasValidCI(entry));

export const generateResultsData = (
  results: ModelResults,
  parameters?: ModelParameters,
  runDuration?: number,
  runTimestamp?: Date,
  dataInfo?: DataInfo,
  resultsText: ResultsTextContent = TEXT.results,
): ResultsData => {
  const andersonRubinCI =
    results.andersonRubinCI !== "NA" && hasValidCI(results.andersonRubinCI)
      ? results.andersonRubinCI
      : null;
  const bootCI =
    results.bootCI !== "NA" && hasValidBootCI(results.bootCI)
      ? results.bootCI
      : null;
  const eggerBootCI =
    results.publicationBias.eggerBootCI !== "NA" &&
    hasValidCI(results.publicationBias.eggerBootCI)
      ? results.publicationBias.eggerBootCI
      : null;
  const eggerAndersonRubinCI =
    results.publicationBias.eggerAndersonRubinCI !== "NA" &&
    hasValidCI(results.publicationBias.eggerAndersonRubinCI)
      ? results.publicationBias.eggerAndersonRubinCI
      : null;

  const isInstrumented = parameters?.shouldUseInstrumenting ?? true;
  const hasFixedIntercept = parameters?.includeStudyDummies ?? false;
  const isWaiveModel =
    (parameters?.modelType ?? CONST.MODEL_TYPES.MAIVE) ===
    CONST.MODEL_TYPES.WAIVE;
  const shouldShowHausman =
    isInstrumented && !hasFixedIntercept && !isWaiveModel;
  const firstStageMode = results.firstStage?.mode ?? "levels";
  const firstStageDescription = results.firstStage?.description ?? null;
  const shouldShowBootstrapResults =
    parameters?.standardErrorTreatment === undefined ||
    parameters.standardErrorTreatment === "bootstrap";
  const defaultSpecification =
    firstStageMode === "log"
      ? "log(SE²) ~ log N; Duan smearing applied"
      : "SE² ~ 1/N";
  const specificationValue = firstStageDescription ?? defaultSpecification;
  const firstStageLabelDefault =
    firstStageMode === "log"
      ? resultsText.diagnosticTests.metrics.firstStageFTestLog.label
      : resultsText.diagnosticTests.metrics.firstStageFTest.label;
  const firstStageFStatisticLabel =
    results.firstStage?.fStatisticLabel ?? firstStageLabelDefault;
  const hausmanStatisticValue = isFiniteNumber(results.hausmanTest.statistic)
    ? results.hausmanTest.statistic
    : "NA";
  const hausmanCriticalValue = isFiniteNumber(results.hausmanTest.criticalValue)
    ? results.hausmanTest.criticalValue
    : "NA";
  const hausmanRejectsNull =
    hausmanStatisticValue !== "NA" && isBoolean(results.hausmanTest.rejectsNull)
      ? results.hausmanTest.rejectsNull
      : null;
  const firstStageFTestValue =
    results.firstStageFTest !== "NA" && isFiniteNumber(results.firstStageFTest)
      ? results.firstStageFTest
      : "NA";
  const firstStageFTestNumericValue =
    typeof firstStageFTestValue === "number" ? firstStageFTestValue : null;
  const hasFirstStageFTestResult = firstStageFTestNumericValue !== null;
  const isFirstStageFTestStrong =
    firstStageFTestNumericValue !== null && firstStageFTestNumericValue >= 10;

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
      value: bootCI ? formatCI(bootCI[0]) : "NA",
      show: shouldShowBootstrapResults && Boolean(bootCI),
      section: "effect",
    },
    {
      label: resultsText.effectEstimate.metrics.andersonRubinCI.label,
      value: andersonRubinCI ? formatCI(andersonRubinCI) : "NA",
      show: Boolean(andersonRubinCI),
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
      label: resultsText.publicationBias.metrics.significance.label,
      value: results.publicationBias.isSignificant ? "Yes" : "No",
      show: true,
      highlightColor: results.publicationBias.isSignificant
        ? "text-green-600"
        : "text-red-600",
      section: "bias",
    },
    {
      label: resultsText.publicationBias.metrics.eggerBootCI.label,
      value: eggerBootCI ? formatCI(eggerBootCI) : "NA",
      show: shouldShowBootstrapResults && Boolean(eggerBootCI),
      section: "bias",
    },
    {
      label: resultsText.publicationBias.metrics.eggerAndersonRubinCI.label,
      value: eggerAndersonRubinCI ? formatCI(eggerAndersonRubinCI) : "NA",
      show: Boolean(eggerAndersonRubinCI),
      section: "bias",
    },
    {
      label: resultsText.diagnosticTests.metrics.hausmanTest.label,
      value: hausmanStatisticValue,
      show: shouldShowHausman,
      highlightColor:
        hausmanRejectsNull === null
          ? undefined
          : hausmanRejectsNull
            ? "text-green-600"
            : "text-red-600",
      extraText:
        hausmanRejectsNull === null
          ? undefined
          : hausmanRejectsNull
            ? " (Rejects Null)"
            : " (Fails to Reject Null)",
      section: "tests",
    },
    {
      label: resultsText.diagnosticTests.metrics.hausmanCriticalValue.label,
      value: hausmanCriticalValue,
      show: shouldShowHausman,
      section: "tests",
    },
    {
      label: resultsText.diagnosticTests.metrics.firstStageSpecification.label,
      value: specificationValue,
      show: isInstrumented,
      section: "tests",
    },
    {
      label: firstStageFStatisticLabel,
      value: firstStageFTestValue,
      show: isInstrumented && hasFirstStageFTestResult,
      highlightColor:
        hasFirstStageFTestResult
          ? isFirstStageFTestStrong
            ? "text-green-600"
            : "text-red-600"
          : undefined,
      extraText:
        hasFirstStageFTestResult
          ? isFirstStageFTestStrong
            ? " (Strong)"
            : " (Weak)"
          : undefined,
      section: "tests",
    },
  ];

  // Run information
  const runInfo: ResultItem[] = [];

  if (isWaiveModel) {
    runInfo.push({
      label: TEXT.waive.runInfoLabel,
      value: TEXT.waive.runInfoValue,
      show: true,
      section: "runInfo",
    });
  }

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
