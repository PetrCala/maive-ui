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
import type {
  RCodeBundle,
  VersionInfo,
  WinsorizeInfo,
} from "@src/types/reproducibility";
import type { DataArray } from "@src/types";

import { fetchRCodeBundle } from "./githubFetcher";
import {
  assertScriptParameters,
  assertScriptVersionInfo,
  generateWrapperScript,
  getRtmaSeed,
} from "./generators/wrapperScript";
import {
  generateReadme,
  generateVersionManifest,
  packagedRSourceFiles,
} from "./generators/readme";
import { convertDataToCSV } from "./csvConverter";
import { validateExportData, estimatePackageSize } from "./validator";

/**
 * Adds the backend R files the package's run_analysis.R sources, the same
 * list the README and the version manifest describe (packagedRSourceFiles).
 *
 * @throws Error when a file the script sources was not fetched
 */
export function addRSourceFiles(
  zip: JSZip,
  bundle: RCodeBundle,
  modelType: string,
): void {
  const contents = new Map<string, string | undefined>([
    ["maive_model.R", bundle.maiveModel],
    ["funnel_plot.R", bundle.funnelPlot],
    ["rtma_model.R", bundle.rtmaModel],
  ]);
  packagedRSourceFiles(modelType).forEach(({ file }) => {
    const content = contents.get(file);
    if (!content) {
      throw new Error(
        `Could not fetch ${file} from GitHub, and run_analysis.R sources it. Try the export again.`,
      );
    }
    zip.file(file, content);
  });
}

/**
 * Generates a complete reproducibility package as a ZIP blob
 *
 * The package includes:
 * - R wrapper script (run_analysis.R)
 * - The R backend files the script sources, from GitHub (maive_model.R and
 *   funnel_plot.R; RTMA packages also rtma_model.R)
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

  // Refuse a run the script generator cannot write for before spending a
  // round trip on GitHub, so the user sees the reason straight away (#576).
  assertScriptParameters(parameters);
  assertScriptVersionInfo(versionInfo, parameters.modelType);

  // Create a new ZIP file
  const zip = new JSZip();

  // 1. Fetch R source code from GitHub
  console.log("Fetching R source code from GitHub...");
  const rCodeBundle = await fetchRCodeBundle(versionInfo.gitRef);

  // Get data length with explicit type
  const dataLength: number = data.length;

  // 2. Generate wrapper script
  console.log("Generating wrapper R script...");
  const wrapperScript = generateWrapperScript(
    versionInfo,
    parameters,
    results,
    dataLength,
    winsorizeInfo,
  );

  // 3. Convert data to CSV
  console.log("Converting data to CSV...");
  const dataCsv = convertDataToCSV(data);

  // 4. Generate README
  console.log("Generating README...");
  const readme = generateReadme(
    versionInfo,
    parameters,
    dataLength,
    parameters.modelType === "RTMA" ? getRtmaSeed(results) : null,
  );

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

  // R source code from backend: what the script sources, nothing else
  addRSourceFiles(zip, rCodeBundle, parameters.modelType);

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
