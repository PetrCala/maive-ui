/**
 * Validation utilities for reproducibility export
 */

import type { ModelParameters, ModelResults } from "@src/types/api";
import type { DataArray } from "@src/types";

/**
 * Validates that required data is available for export
 *
 * @param data - User's uploaded data
 * @param parameters - Analysis parameters
 * @param results - Analysis results
 * @throws Error if data is invalid or missing
 */
export function validateExportData(
  data: DataArray | null,
  parameters: ModelParameters | null,
  results: ModelResults | null,
): void {
  if (!data || !Array.isArray(data) || data.length === 0) {
    throw new Error(
      "No data available for export. Please run an analysis first.",
    );
  }

  if (!parameters) {
    throw new Error(
      "Analysis parameters not available. Please run an analysis first.",
    );
  }

  if (!results) {
    throw new Error(
      "Analysis results not available. Please run an analysis first.",
    );
  }

  // Validate data structure
  const firstRow: Record<string, unknown> | undefined = data[0];
  if (!firstRow || typeof firstRow !== "object") {
    throw new Error("Invalid data structure. Each row must be an object.");
  }

  // Validate minimum number of columns (at least bs, sebs, Ns)
  const columns: string[] = Object.keys(firstRow);
  if (columns.length < 3) {
    throw new Error(
      "Data must have at least 3 columns (effect sizes, standard errors, sample sizes).",
    );
  }
}

/**
 * Estimates the size of the reproducibility package before generation
 *
 * This is useful for showing progress or warning users about large packages.
 *
 * @param data - User's uploaded data
 * @param results - Analysis results
 * @returns Estimated size in bytes
 */
export function estimatePackageSize(
  data: DataArray,
  results: ModelResults,
): number {
  // Rough estimates based on typical file sizes
  const dataSize = Array.isArray(data) ? data.length * 50 : 0; // ~50 bytes per row in CSV
  const rCodeSize = 50000; // ~50 KB for R source files
  const resultsSize = JSON.stringify(results).length;
  const docsSize = 15000; // ~15 KB for README and manifest
  const overhead = 5000; // ZIP overhead

  const totalUncompressed =
    dataSize + rCodeSize + resultsSize + docsSize + overhead;

  // ZIP compression typically achieves ~40% reduction for text files
  return Math.floor(totalUncompressed * 0.6);
}
