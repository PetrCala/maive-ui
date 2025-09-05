import type { DataArray, ModelResults, ModelParameters } from "@src/types";
import * as XLSX from "xlsx";

// Generate a unique ID for uploaded data
export const generateDataId = (): string => {
  return `data_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Process uploaded file and return structured data
export const processUploadedFile = async (
  file: File,
): Promise<{
  data: DataArray;
  base64Data: string;
}> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      try {
        const base64Data = reader.result as string;

        // Remove the data URL prefix
        const base64Content = base64Data.split(",")[1];
        const binaryData = atob(base64Content);
        const bytes = new Uint8Array(binaryData.length);

        for (let i = 0; i < binaryData.length; i++) {
          bytes[i] = binaryData.charCodeAt(i);
        }

        // Read the Excel/CSV file
        const workbook = XLSX.read(bytes, { type: "array" });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

        // Check if first row looks like headers (contains non-numeric values)
        const firstRow = (jsonData as unknown[][])[0] ?? [];
        const secondRow = (jsonData as unknown[][])[1] ?? [];

        // More robust header detection: check if first row contains mostly non-numeric values
        // and second row contains mostly numeric values
        const firstRowNonNumericCount = firstRow.filter(
          (cell) => cell !== undefined && cell !== null && isNaN(Number(cell)),
        ).length;
        const secondRowNumericCount = secondRow.filter(
          (cell) => cell !== undefined && cell !== null && !isNaN(Number(cell)),
        ).length;

        const hasHeaders =
          firstRowNonNumericCount > firstRow.length / 2 &&
          secondRowNumericCount > secondRow.length / 2;

        let dataRows: unknown[][];
        let columnNames: string[];

        if (hasHeaders) {
          // Use the first row as headers
          columnNames = (firstRow as unknown as string[]).map((header) =>
            String(header || ""),
          );
          dataRows = (jsonData as unknown[][]).slice(1); // skip header row
        } else {
          // No headers detected, use positional column names and treat all rows as data
          columnNames = ["effect", "se", "n_obs"];
          if (firstRow.length === 4) {
            columnNames.push("study_id");
          }
          // Include ALL rows as data when no headers are detected
          dataRows = jsonData as unknown[][];
        }

        // Convert to structured data using column order
        const records = dataRows.map((row) => {
          const obj: Record<string, unknown> = {};
          columnNames.forEach((columnName, index) => {
            // When no headers, row is an array, so we access by index
            obj[columnName] = row[index];
          });
          return obj;
        });

        resolve({
          data: records,
          base64Data: base64Data,
        });
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error("Failed to read file"));
    };

    reader.readAsDataURL(file);
  });
};

/**
 * Checks if the uploaded data has a study ID column
 */
export function hasStudyIdColumn(
  data: Array<Record<string, unknown>> | undefined,
): boolean {
  if (!data?.[0]) {
    return false;
  }

  const headers = Object.keys(data[0]);
  return headers.some((header: string) => /\bstudy[\s_-]?id\b/i.test(header));
}

/**
 * A helper function to download a file
 * @param blob - The blob to download
 * @param filename - The filename to download
 */
const downloadFile = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Export data with instrumented standard errors
 * @param originalData - The original data
 * @param seInstrumented - The instrumented standard errors
 * @param filename - The filename
 * @param shouldAddSalt - Whether to add a salt to the filename, making it unique
 */
export const exportDataWithInstrumentedSE = (
  originalData: DataArray,
  seInstrumented: number[],
  filename: string,
  shouldAddSalt = true,
): void => {
  if (originalData.length !== seInstrumented.length) {
    throw new Error(
      "Original data and instrumented SE must have the same length",
    );
  }

  // Create a copy of the original data and add the instrumented SE column
  const exportData = originalData.map((row, index) => ({
    ...row,
    se_instrumented: seInstrumented[index] || null,
  }));

  // Determine the file extension and MIME type based on original format
  let fileExtension: string;
  let mimeType: string;

  if (filename.toLowerCase().endsWith(".xlsx")) {
    fileExtension = "xlsx";
    mimeType =
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  } else if (filename.toLowerCase().endsWith(".xls")) {
    fileExtension = "xls";
    mimeType = "application/vnd.ms-excel";
  } else {
    // Default to CSV
    fileExtension = "csv";
    mimeType = "text/csv";
  }

  // Generate new filename
  const baseName = filename.replace(/\.[^/.]+$/, ""); // Remove extension
  const now = new Date();
  const salt = shouldAddSalt
    ? `_${now.toISOString().replace(/[-:T]/g, "").slice(0, 13)}` // e.g., "_20240611_1530" (YYYYMMDDHHmm)
    : "";
  const newFilename = `${baseName}_with_instrumented_se${salt}.${fileExtension}`;

  if (fileExtension === "csv") {
    // Export as CSV
    const headers = Object.keys(exportData[0] || {});
    const csvContent = [
      headers.join(","),
      ...exportData.map((row) =>
        headers
          .map((header) => {
            const value = row[header as keyof typeof row] as
              | number
              | string
              | null;
            // Handle values that need quotes (contain commas, quotes, or newlines)
            if (
              typeof value === "string" &&
              (value.includes(",") ||
                value.includes('"') ||
                value.includes("\n"))
            ) {
              return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
          })
          .join(","),
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: mimeType });
    downloadFile(blob, newFilename);
  } else {
    // Export as Excel
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(exportData);

    XLSX.utils.book_append_sheet(workbook, worksheet, "Data");
    XLSX.writeFile(workbook, newFilename);
  }
};

/**
 * Export comprehensive results to Excel with three sheets
 * @param originalData - The original data
 * @param results - The model results
 * @param parameters - The model parameters
 * @param seInstrumented - The instrumented standard errors
 * @param filename - The filename
 * @param runDuration - The run duration in milliseconds
 * @param runTimestamp - The run timestamp
 * @param dataInfo - Information about the data file
 */
export const exportComprehensiveResults = (
  originalData: DataArray,
  results: ModelResults,
  parameters: ModelParameters,
  seInstrumented: number[],
  filename: string,
  runDuration?: number,
  runTimestamp?: Date,
  dataInfo?: {
    filename: string;
    rowCount: number;
    hasStudyId: boolean;
  },
): void => {
  const workbook = XLSX.utils.book_new();

  // Sheet 1: Results Summary
  const resultsSummary = [
    { Metric: "Effect Estimate", Value: results.effectEstimate },
    { Metric: "Standard Error", Value: results.standardError },
    { Metric: "Significant", Value: results.isSignificant ? "Yes" : "No" },
    {
      Metric: "Publication Bias p-value",
      Value: results.publicationBias.pValue,
    },
    {
      Metric: "Publication Bias Significant",
      Value: results.publicationBias.isSignificant ? "Yes" : "No",
    },
  ];

  // Add conditional results
  if (results.andersonRubinCI !== "NA") {
    resultsSummary.push(
      { Metric: "Anderson-Rubin CI Lower", Value: results.andersonRubinCI[0] },
      { Metric: "Anderson-Rubin CI Upper", Value: results.andersonRubinCI[1] },
    );
  }

  if (results.firstStageFTest !== "NA") {
    resultsSummary.push({
      Metric: "First Stage F-test",
      Value: results.firstStageFTest,
    });
  }

  resultsSummary.push(
    { Metric: "Hausman Test Statistic", Value: results.hausmanTest.statistic },
    {
      Metric: "Hausman Critical Value",
      Value: results.hausmanTest.criticalValue,
    },
    {
      Metric: "Hausman Rejects Null",
      Value: results.hausmanTest.rejectsNull ? "Yes" : "No",
    },
  );

  if (results.bootCI !== "NA") {
    resultsSummary.push(
      { Metric: "Bootstrap CI Effect Lower", Value: results.bootCI[0][0] },
      { Metric: "Bootstrap CI Effect Upper", Value: results.bootCI[0][1] },
      { Metric: "Bootstrap CI SE Lower", Value: results.bootCI[1][0] },
      { Metric: "Bootstrap CI SE Upper", Value: results.bootCI[1][1] },
    );
  }

  if (results.bootSE !== "NA") {
    resultsSummary.push(
      { Metric: "Bootstrap SE Effect", Value: results.bootSE[0] },
      { Metric: "Bootstrap SE SE", Value: results.bootSE[1] },
    );
  }

  // Add run information
  if (runDuration !== undefined) {
    resultsSummary.push({ Metric: "Run Duration (ms)", Value: runDuration });
  }
  if (runTimestamp) {
    resultsSummary.push({
      Metric: "Run Timestamp",
      Value: runTimestamp.toISOString(),
    });
  }
  if (dataInfo) {
    resultsSummary.push(
      { Metric: "Data File", Value: dataInfo.filename },
      { Metric: "Observations", Value: dataInfo.rowCount },
      { Metric: "Has Study ID", Value: dataInfo.hasStudyId ? "Yes" : "No" },
    );
  }

  const resultsSheet = XLSX.utils.json_to_sheet(resultsSummary);
  XLSX.utils.book_append_sheet(workbook, resultsSheet, "Results Summary");

  // Sheet 2: Run Settings (Model Parameters)
  const runSettings = Object.entries(parameters).map(([key, value]) => ({
    Parameter: key,
    Value: typeof value === "boolean" ? (value ? "Yes" : "No") : String(value),
  }));

  const settingsSheet = XLSX.utils.json_to_sheet(runSettings);
  XLSX.utils.book_append_sheet(workbook, settingsSheet, "Run Settings");

  // Sheet 3: MAIVE Adjusted SEs
  const exportData = originalData.map((row, index) => ({
    ...row,
    se_instrumented: seInstrumented[index] || null,
  }));

  const dataSheet = XLSX.utils.json_to_sheet(exportData);
  XLSX.utils.book_append_sheet(workbook, dataSheet, "Data with Adjusted SEs");

  // Generate filename
  const baseName = filename.replace(/\.[^/.]+$/, ""); // Remove extension
  const now = new Date();
  const salt = `_${now.toISOString().replace(/[-:T]/g, "").slice(0, 13)}`; // e.g., "_20240611_1530"
  const newFilename = `${baseName}_comprehensive_results${salt}.xlsx`;

  XLSX.writeFile(workbook, newFilename);
};

/**
 * Download an image from a data URI as a JPG file
 * @param dataUri - The data URI of the image (e.g., "data:image/png;base64,...")
 * @param filename - The filename for the downloaded file (without extension)
 * @param addCitation - Whether to add a citation to the image
 */
export const downloadImageAsJpg = (
  dataUri: string,
  filename: string,
  addCitation?: boolean,
): void => {
  // Create a canvas to convert the image to JPG
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Could not get canvas context");
  }

  // Create an image element
  const img = new Image();

  img.onload = () => {
    // Set canvas dimensions to match the image
    canvas.width = img.width;
    canvas.height = img.height;

    // Draw the image on the canvas
    ctx.drawImage(img, 0, 0);

    if (addCitation) {
      // Add citation text to the top of the image
      ctx.fillStyle = "#6B7280"; // Gray color for citation
      ctx.font = "12px Arial";
      ctx.textAlign = "center";

      // Add citation text at the top
      const citationText =
        "Citation: Irsova et al., Nature Communications, 2025";
      const textWidth = ctx.measureText(citationText).width;
      const padding = 20;

      // Add background rectangle for citation
      ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
      ctx.fillRect(
        (canvas.width - textWidth) / 2 - padding,
        10,
        textWidth + padding * 2,
        30,
      );

      // Add citation text
      ctx.fillStyle = "#374151";
      ctx.fillText(citationText, canvas.width / 2, 30);
    }

    // Convert to JPG blob
    canvas.toBlob(
      (blob) => {
        if (blob) {
          const jpgFilename = `${filename}.jpg`;
          downloadFile(blob, jpgFilename);
        } else {
          throw new Error("Failed to convert image to JPG");
        }
      },
      "image/jpeg",
      0.9,
    ); // 0.9 quality for good balance
  };

  img.onerror = () => {
    throw new Error("Failed to load image from data URI");
  };

  // Set the source to trigger loading
  img.src = dataUri;
};
