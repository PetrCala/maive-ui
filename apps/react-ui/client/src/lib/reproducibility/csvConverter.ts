/**
 * CSV conversion utilities for reproducibility packages
 */

import type { DataArray } from "@src/types";

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
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const firstRow: Record<string, unknown> | undefined = data[0];
  if (!firstRow || typeof firstRow !== "object") {
    throw new Error("Invalid data format: first row is not an object");
  }

  const columns: string[] = Object.keys(firstRow);

  // Create CSV header
  const header = columns.join(",");

  // Create CSV rows
  const rows = data.map((row: Record<string, unknown>) => {
    return columns
      .map((col: string) => {
        const value: unknown = row[col];
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
