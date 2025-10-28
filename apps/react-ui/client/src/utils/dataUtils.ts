import TEXT, { getResultsText } from "@src/lib/text";
import type { DataArray, ModelResults, ModelParameters } from "@src/types";
import CONST from "@src/CONST";
import type { DataInfo } from "@src/types/data";
import {
  convertToExportFormat,
  generateResultsData,
} from "@src/utils/resultsDataUtils";
import { parse, type ParseResult } from "papaparse";
import * as XLSX from "xlsx";

/**
 * Parses a localized numeric string, supporting decimal commas and various thousands separators
 */
export const parseLocalizedNumber = (value: unknown): number | null => {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  if (trimmed === "") {
    return null;
  }

  const normalized = trimmed.replace(/\u00a0/g, "").replace(/\s+/g, "");

  const europeanPattern = /^-?\d{1,3}(?:\.\d{3})*,\d+$/;
  const commaDecimalPattern = /^-?\d+,\d+$/;
  const usThousandsPattern = /^-?\d{1,3}(?:,\d{3})*(?:\.\d+)?$/;

  let sanitized = normalized;

  if (europeanPattern.test(normalized)) {
    sanitized = normalized.replace(/\./g, "").replace(",", ".");
  } else if (
    commaDecimalPattern.test(normalized) &&
    !normalized.includes(".")
  ) {
    sanitized = normalized.replace(",", ".");
  } else if (usThousandsPattern.test(normalized)) {
    sanitized = normalized.replace(/,/g, "");
  }

  const parsed = Number(sanitized);
  return Number.isNaN(parsed) ? null : parsed;
};

type ParsedTabularData = {
  records: DataArray;
  columnNames: string[];
  hasHeaders: boolean;
};

const isCsvFile = (file: File): boolean =>
  file.type === "text/csv" || file.name.toLowerCase().endsWith(".csv");

const readFileAsDataURL = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(reader.result as string);
    };
    reader.onerror = () => {
      reject(new Error("Failed to read file"));
    };
    reader.readAsDataURL(file);
  });
};

const readFileAsText = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(reader.result as string);
    };
    reader.onerror = () => {
      reject(new Error("Failed to read file"));
    };
    reader.readAsText(file);
  });
};

const readFileAsArrayBuffer = (file: File): Promise<ArrayBuffer> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(reader.result as ArrayBuffer);
    };
    reader.onerror = () => {
      reject(new Error("Failed to read file"));
    };
    reader.readAsArrayBuffer(file);
  });
};

const isLikelyNumeric = (value: unknown): boolean => {
  return parseLocalizedNumber(value) !== null;
};

const detectHeaders = (rows: unknown[][]): boolean => {
  if (rows.length < 2) {
    return false;
  }

  const [firstRow, secondRow] = rows;

  // Count numeric vs non-numeric values (excluding empty cells)
  const firstRowNumericCount = firstRow.filter(
    (cell) =>
      cell !== undefined &&
      cell !== null &&
      cell !== "" &&
      isLikelyNumeric(cell),
  ).length;
  const firstRowNonNumericCount = firstRow.filter(
    (cell) =>
      cell !== undefined &&
      cell !== null &&
      cell !== "" &&
      !isLikelyNumeric(cell),
  ).length;
  const secondRowNumericCount = secondRow.filter(
    (cell) =>
      cell !== undefined &&
      cell !== null &&
      cell !== "" &&
      isLikelyNumeric(cell),
  ).length;

  // Strategy 1: Classic case - first row mostly non-numeric, second row mostly numeric
  const classicHeaderPattern =
    firstRowNonNumericCount > firstRow.length / 2 &&
    secondRowNumericCount > secondRow.length / 2;

  // Strategy 2: First row has NO numeric values but second row has SOME
  // This handles cases where headers are all strings but data is mixed
  const allStringHeaderPattern =
    firstRowNumericCount === 0 &&
    firstRowNonNumericCount > 0 &&
    secondRowNumericCount > 0;

  // Strategy 3: First row predominantly non-numeric (>60%) and second row has at least some numeric values (>20%)
  // This handles mixed data rows (both numeric and string columns)
  const mixedDataPattern =
    firstRowNonNumericCount > firstRow.length * 0.6 &&
    secondRowNumericCount > secondRow.length * 0.2;

  return classicHeaderPattern || allStringHeaderPattern || mixedDataPattern;
};

const buildRecordsFromRows = (
  rows: unknown[][],
  columnNames: string[],
): DataArray => {
  return rows.map((row) => {
    const record: Record<string, unknown> = {};
    columnNames.forEach((columnName, index) => {
      record[columnName] = row[index] ?? null;
    });
    return record;
  });
};

const generateColumnNames = (count: number, headers?: unknown[]): string[] => {
  if (headers && headers.length > 0) {
    return headers.map((header, index) => {
      const headerValue = header ?? `Column ${index + 1}`;
      return String(headerValue).trim() || `Column ${index + 1}`;
    });
  }

  return Array.from({ length: count }, (_, index) => `Column ${index + 1}`);
};

const sanitizeRows = (rows: unknown[][]): unknown[][] => {
  const meaningfulRows = rows.filter((row) =>
    row.some((cell) => cell !== null && cell !== undefined && cell !== ""),
  );

  const maxColumns = meaningfulRows.reduce((max, row) => {
    return Math.max(max, row.length);
  }, 0);

  return meaningfulRows.map((row) => {
    const normalizedRow = [...row];
    if (normalizedRow.length < maxColumns) {
      const fillCount = maxColumns - normalizedRow.length;
      return [
        ...normalizedRow,
        ...Array.from({ length: fillCount }, () => null),
      ];
    }
    return normalizedRow;
  });
};

const parseCsvText = (text: string): ParsedTabularData => {
  const parsedResult: ParseResult<string[]> = parse<string[]>(text, {
    skipEmptyLines: "greedy",
    transform: (value: string) => value.trim(),
    delimitersToGuess: [",", ";", "\t", "|"],
  });

  const rows = sanitizeRows(parsedResult.data);

  if (rows.length === 0) {
    return { records: [], columnNames: [], hasHeaders: false };
  }

  const hasHeaders = detectHeaders(rows);
  const columnNames = hasHeaders
    ? generateColumnNames(rows[0]?.length ?? 0, rows[0])
    : generateColumnNames(rows[0]?.length ?? 0);

  const dataRows = hasHeaders ? rows.slice(1) : rows;

  return {
    records: buildRecordsFromRows(dataRows, columnNames),
    columnNames,
    hasHeaders,
  };
};

const parseWorkbook = (arrayBuffer: ArrayBuffer): ParsedTabularData => {
  const workbook = XLSX.read(arrayBuffer, { type: "array" });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawRows: unknown[][] = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, {
    header: 1,
    blankrows: false,
    defval: null,
  });

  const rows = sanitizeRows(rawRows);

  if (rows.length === 0) {
    return { records: [], columnNames: [], hasHeaders: false };
  }

  const hasHeaders = detectHeaders(rows);
  const columnNames = hasHeaders
    ? generateColumnNames(rows[0]?.length ?? 0, rows[0])
    : generateColumnNames(rows[0]?.length ?? 0);

  const dataRows = hasHeaders ? rows.slice(1) : rows;

  return {
    records: buildRecordsFromRows(dataRows, columnNames),
    columnNames,
    hasHeaders,
  };
};

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
  columnNames: string[];
  hasHeaders: boolean;
}> => {
  return new Promise((resolve, reject) => {
    void (async () => {
      try {
        const [base64Data, parsed] = await Promise.all([
          readFileAsDataURL(file),
          isCsvFile(file)
            ? readFileAsText(file).then((text) => parseCsvText(text))
            : readFileAsArrayBuffer(file).then((buffer) =>
                parseWorkbook(buffer),
              ),
        ]);

        resolve({
          data: parsed.records,
          base64Data,
          columnNames: parsed.columnNames,
          hasHeaders: parsed.hasHeaders,
        });
      } catch (error) {
        reject(error);
      }
    })();
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

  return (
    headers.some((header: string) => /\bstudy[\s_-]?id\b/i.test(header)) ||
    headers.length === 4
  );
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
  dataInfo?: DataInfo,
): void => {
  const workbook = XLSX.utils.book_new();

  const resultsText = getResultsText(
    parameters?.modelType ?? CONST.MODEL_TYPES.MAIVE,
    parameters?.shouldUseInstrumenting ?? true,
    parameters?.standardErrorTreatment ?? "not_clustered",
  );

  // Sheet 1: Results Summary
  const resultsSummary = convertToExportFormat(
    generateResultsData(
      results,
      parameters,
      runDuration,
      runTimestamp,
      dataInfo,
      resultsText,
    ),
  );

  const resultsSheet = XLSX.utils.json_to_sheet(resultsSummary);
  XLSX.utils.book_append_sheet(workbook, resultsSheet, "Results Summary");

  // Sheet 2: Run Settings (Model Parameters)
  const runSettings = Object.entries(parameters).map(([key, value]) => ({
    Parameter: key,
    Value: typeof value === "boolean" ? (value ? "Yes" : "No") : String(value),
  }));

  const settingsSheet = XLSX.utils.json_to_sheet(runSettings);
  XLSX.utils.book_append_sheet(workbook, settingsSheet, "Run Settings");

  const modelType = parameters.modelType ?? CONST.MODEL_TYPES.MAIVE;
  const isWaiveModel = modelType === CONST.MODEL_TYPES.WAIVE;
  const adjustedSeSheetName =
    modelType === CONST.MODEL_TYPES.WLS
      ? "WLS Standard SEs"
      : isWaiveModel
        ? "WAIVE Adjusted SEs"
        : "MAIVE Adjusted SEs";

  // Sheet 3: Adjusted SEs
  const exportData = originalData.map((row, index) => ({
    ...row,
    se_instrumented: seInstrumented[index] || null,
  }));

  const dataSheet = XLSX.utils.json_to_sheet(exportData);
  XLSX.utils.book_append_sheet(workbook, dataSheet, adjustedSeSheetName);

  // Generate filename
  const baseName = filename.replace(/\.[^/.]+$/, ""); // Remove extension
  const now = new Date();
  const salt = `_${now.toISOString().replace(/[-:T]/g, "").slice(0, 13)}`; // e.g., "_20240611_1530"
  const modelSlug = modelType.toLowerCase();
  const newFilename = `${baseName}_${modelSlug}_results${salt}.xlsx`;

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
      // Add citation text to the bottom-right corner of the image
      const citationText = TEXT.citation.shortText;
      ctx.font = "12px Arial";
      ctx.textAlign = "right";
      ctx.textBaseline = "bottom";

      const textMetrics = ctx.measureText(citationText);
      const textWidth = textMetrics.width;
      const textHeight =
        textMetrics.actualBoundingBoxAscent +
        textMetrics.actualBoundingBoxDescent;

      const margin = 16;
      const paddingX = 12;
      const paddingY = 8;
      const rectWidth = textWidth + paddingX * 2;
      const rectHeight = textHeight + paddingY * 2;
      const rectX = canvas.width - rectWidth - margin;
      const rectY = canvas.height - rectHeight - margin;

      ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
      ctx.fillRect(rectX, rectY, rectWidth, rectHeight);

      ctx.fillStyle = "#374151";
      const textX = canvas.width - margin - paddingX;
      const textY = canvas.height - margin - paddingY;
      ctx.fillText(citationText, textX, textY);
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
