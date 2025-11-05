/**
 * Main orchestrator for generating reproducibility packages
 *
 * This module brings together all the utilities to create a complete
 * ZIP package containing everything needed to reproduce a MAIVE analysis.
 */

import JSZip from "jszip";
import type { ModelParameters, ModelResults } from "@src/types/api";
import type { VersionInfo, WinsorizeInfo } from "@src/types/reproducibility";
import type { DataArray } from "@src/types/data";
import { getCachedReproducibilityBundle } from "./githubCodeFetcher";
import { generateWrapperScript } from "./rWrapperGenerator";
import { generateReadme, generateVersionManifest } from "./readmeGenerator";

/**
 * Converts data array to CSV format
 */
function convertDataToCSV(data: DataArray): string {
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

/**
 * Generates a reproducibility package as a ZIP blob
 *
 * @param data - User's uploaded data
 * @param parameters - Analysis parameters
 * @param results - Analysis results from the web app
 * @param versionInfo - Version information
 * @param winsorizeInfo - Optional winsorization details
 * @returns ZIP file as a Blob
 */
export async function generateReproducibleBundle(
  data: DataArray,
  parameters: ModelParameters,
  results: ModelResults,
  versionInfo: VersionInfo,
  winsorizeInfo?: WinsorizeInfo,
): Promise<Blob> {
  console.log("Generating reproducibility package...");

  // Create a new ZIP file
  const zip = new JSZip();

  // 1. Fetch R source code from GitHub
  console.log("Fetching R source code from GitHub...");
  const rCodeBundle = await getCachedReproducibilityBundle(
    versionInfo.gitCommitHash,
  );

  // 2. Generate wrapper script
  console.log("Generating wrapper R script...");
  const wrapperScript = generateWrapperScript(
    versionInfo,
    parameters,
    results,
    data.length,
    winsorizeInfo,
  );

  // 3. Convert data to CSV
  console.log("Converting data to CSV...");
  const dataCsv = convertDataToCSV(data);

  // 4. Generate README
  console.log("Generating README...");
  const readme = generateReadme(versionInfo, parameters, data.length);

  // 5. Generate version manifest
  console.log("Generating version manifest...");
  const versionManifest = generateVersionManifest(versionInfo, parameters);

  // 6. Prepare parameters JSON
  const parametersJson = JSON.stringify(parameters, null, 2);

  // 7. Prepare expected results JSON
  const expectedResultsJson = JSON.stringify(results, null, 2);

  // 8. Add all files to ZIP
  console.log("Bundling files into ZIP...");

  // Main wrapper script
  zip.file("run_analysis.R", wrapperScript);

  // R source code from backend
  zip.file("maive_model.R", rCodeBundle.maiveModel);
  zip.file("funnel_plot.R", rCodeBundle.funnelPlot);
  if (rCodeBundle.hostHelpers) {
    zip.file("host.R", rCodeBundle.hostHelpers);
  }

  // Data and configuration
  zip.file("data.csv", dataCsv);
  zip.file("parameters.json", parametersJson);
  zip.file("expected_results.json", expectedResultsJson);

  // Documentation
  zip.file("README.md", readme);
  zip.file("version-manifest.txt", versionManifest);

  // 9. Generate ZIP blob
  console.log("Generating ZIP file...");
  const blob = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: {
      level: 9, // Maximum compression
    },
  });

  console.log("Reproducibility package generated successfully!");
  console.log(`Package size: ${(blob.size / 1024).toFixed(2)} KB`);

  return blob;
}

/**
 * Gets a filename for the reproducibility package
 */
export function getReproducibilityPackageFilename(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return `maive-analysis-${timestamp}.zip`;
}

/**
 * Validates that required data is available for export
 *
 * @throws Error if data is invalid or missing
 */
export function validateExportData(
  data: DataArray | null | undefined,
  parameters: ModelParameters | null | undefined,
  results: ModelResults | null | undefined,
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
  const firstRow = data[0];
  if (!firstRow || typeof firstRow !== "object") {
    throw new Error("Invalid data structure. Each row must be an object.");
  }

  // Validate minimum number of columns (at least bs, sebs, Ns)
  const columns = Object.keys(firstRow);
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
