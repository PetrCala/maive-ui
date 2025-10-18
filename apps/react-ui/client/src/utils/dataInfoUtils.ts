"use client";

import { dataCache } from "@store/dataStore";
import type { UploadedData } from "@store/dataStore";
import { hasStudyIdColumn } from "./dataUtils";
import type { DataInfo } from "@src/types/data";
import {
  formatFilterRowSummary,
  formatFilterSummary,
  normalizeFilterState,
} from "@src/utils/subsampleFilterUtils";

const buildDataInfoFromUploadedData = (
  data: UploadedData,
): DataInfo => {
  const hasStudyId = hasStudyIdColumn(data.data);
  let studyCount: number | undefined;
  let medianObservationsPerStudy: number | undefined;

  if (hasStudyId && data.data.length > 0) {
    // Find the study ID column
    const headers = Object.keys(data.data[0]);
    const studyIdColumn =
      headers.find((header: string) => /\bstudy[\s_-]?id\b/i.test(header)) ??
      (headers.length === 4 ? headers[3] : undefined);

    if (studyIdColumn) {
      // Count unique studies
      const uniqueStudies = new Set(
        data.data.map((row) => row[studyIdColumn]?.toString()),
      );
      studyCount = uniqueStudies.size;

      // Calculate median observations per study
      const observationsPerStudy = new Map<string, number>();
      data.data.forEach((row) => {
        const studyId = row[studyIdColumn]?.toString();
        if (studyId) {
          observationsPerStudy.set(
            studyId,
            (observationsPerStudy.get(studyId) ?? 0) + 1,
          );
        }
      });

      const observationCounts = Array.from(observationsPerStudy.values()).sort(
        (a, b) => a - b,
      );
      if (observationCounts.length > 0) {
        const mid = Math.floor(observationCounts.length / 2);
        medianObservationsPerStudy =
          observationCounts.length % 2 === 0
            ? (observationCounts[mid - 1] + observationCounts[mid]) / 2
            : observationCounts[mid];
      }
    }
  }

  const filename = data.filename ?? "Unknown";
  const rowCount = data.data.length ?? 0;

  const normalizedFilter = normalizeFilterState(data.subsampleFilter);
  const filterSummary = normalizedFilter?.isEnabled
    ? formatFilterSummary(normalizedFilter)
    : "";
  const filterRowSummary = normalizedFilter?.isEnabled
    ? formatFilterRowSummary(normalizedFilter)
    : "";

  return {
    filename,
    rowCount,
    hasStudyId,
    studyCount,
    medianObservationsPerStudy,
    subsampleFilter:
      normalizedFilter?.isEnabled && filterSummary
        ? {
            summary: filterSummary,
            rowSummary: filterRowSummary || undefined,
            matchedRowCount: normalizedFilter.matchedRowCount,
            totalRowCount: normalizedFilter.totalRowCount,
          }
        : undefined,
  };
};

/**
 * Generate data info from cached uploaded data by its identifier.
 */
export const generateDataInfo = (
  dataId: string | null,
): DataInfo | undefined => {
  if (!dataId) {
    return undefined;
  }

  const data = dataCache.get(dataId);
  if (!data) {
    return undefined;
  }

  return buildDataInfoFromUploadedData(data);
};

/**
 * Generate data info from an uploaded data reference without relying on cache lookups.
 * Useful when the caller already has the uploaded data (e.g., during export actions).
 */
export const deriveDataInfoFromUploadedData = (
  data: UploadedData | null | undefined,
): DataInfo | undefined => {
  if (!data) {
    return undefined;
  }

  return buildDataInfoFromUploadedData(data);
};
