/**
 * Reproducibility Package Generator
 *
 * This module provides functionality to export complete reproducibility packages
 * containing R code, data, and documentation needed to reproduce MAIVE analyses.
 *
 * @module reproducibility
 */

import JSZip from "jszip";
import type { ModelParameters, ModelResults } from "@src/types/api";
import type { VersionInfo, WinsorizeInfo } from "@src/types/reproducibility";
import type { DataArray } from "@src/types/data";

import { fetchRCodeBundle } from "./githubFetcher";
import { generateWrapperScript } from "./generators/wrapperScript";
import { generateReadme, generateVersionManifest } from "./generators/readme";
import { convertDataToCSV } from "./csvConverter";
import { validateExportData, estimatePackageSize } from "./validator";

/**
 * Generates a complete reproducibility package as a ZIP blob
 *
 * The package includes:
 * - R wrapper script (run_analysis.R)
 * - R backend source code from GitHub (maive_model.R, funnel_plot.R)
 * - User's data in CSV format
 * - Analysis parameters and expected results in JSON
 * - Comprehensive README and version manifest
 *
 * @param data - User's uploaded data
 * @param parameters - Analysis parameters used in the web app
 * @param results - Analysis results from the web app
 * @param versionInfo - Version information (UI, MAIVE package, git commit)
 * @param winsorizeInfo - Optional winsorization details
 * @returns ZIP file as a Blob, ready for download
 *
 * @example
 * ```typescript
 * const versionInfo = await fetch('/api/get-version-info').then(r => r.json());
 * const blob = await generateReproducibilityPackage(
 *   data,
 *   parameters,
 *   results,
 *   versionInfo
 * );
 * saveAs(blob, 'maive-analysis.zip');
 * ```
 */
export async function generateReproducibilityPackage(
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
  const rCodeBundle = await fetchRCodeBundle(versionInfo.gitCommitHash);

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
 *
 * @returns Filename with timestamp (e.g., "maive-analysis-2025-01-15T10-30-45.zip")
 */
export function getReproducibilityPackageFilename(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return `maive-analysis-${timestamp}.zip`;
}

// Re-export utilities for convenience
export { validateExportData, estimatePackageSize };
