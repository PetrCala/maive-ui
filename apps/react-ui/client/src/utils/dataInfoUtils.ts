"use client";

import { dataCache } from "@store/dataStore";
import { hasStudyIdColumn } from "./dataUtils";

export type DataInfo = {
  filename: string;
  rowCount: number;
  hasStudyId: boolean;
};

/**
 * Generate data info from dataId
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

  return {
    filename: data.filename ?? "Unknown",
    rowCount: data.data.length ?? 0,
    hasStudyId: hasStudyIdColumn(data.data),
  };
};
