/**
 * CSV conversion utilities for reproducibility packages
 */

import type { DataArray } from "@src/types/data";

/**
 * Converts data array to CSV format
 *
 * @param data - Array of data objects to convert
 * @returns CSV string with headers and data rows
 * @throws Error if data is empty or invalid
 */
export function convertDataToCSV(data: DataArray): string {
  if (!data || !Array.isArray(data) || data.length === 0) {
    throw new Error("Cannot export empty dataset");
  }

  // Get column names from first row
  const firstRow = data[0];
  if (!firstRow || typeof firstRow !== "object") {
    throw new Error("Invalid data format: first row is not an object");
  }

  const columns = Object.keys(firstRow);

  // Create CSV header
  const header = columns.join(",");

  // Create CSV rows
  const rows = data.map((row) => {
    return columns
      .map((col) => {
        const value = row[col];
        // Handle different value types
        if (value === null || value === undefined) {
          return "";
        }
        // Quote strings that contain commas or quotes
        if (
          typeof value === "string" &&
          (value.includes(",") || value.includes('"'))
        ) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return String(value);
      })
      .join(",");
  });

  return [header, ...rows].join("\n");
}
