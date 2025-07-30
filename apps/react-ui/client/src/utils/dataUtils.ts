import * as XLSX from "xlsx";

// Generate a unique ID for uploaded data
export const generateDataId = (): string => {
  return `data_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Process uploaded file and return structured data
export const processUploadedFile = async (
  file: File,
): Promise<{
  data: any[];
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

        // Convert to structured data
        const headers = (jsonData as any[])[0] ?? [];
        const records = (jsonData as any[])
          .slice(1) // skip header row
          .map((row) =>
            headers.reduce(
              (obj: Record<string, any>, h: string, idx: number) => {
                obj[h] = row[idx]; // map cell → corresponding header
                return obj;
              },
              {} as Record<string, any>,
            ),
          );

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
 * Export data with instrumented standard errors
 * @param originalData - The original data
 * @param seInstrumented - The instrumented standard errors
 * @param filename - The filename
 * @param shouldAddSalt - Whether to add a salt to the filename, making it unique
 */
export const exportDataWithInstrumentedSE = (
  originalData: any[],
  seInstrumented: number[],
  filename: string,
  shouldAddSalt: boolean = true,
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
            const value = row[header];
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

// Helper function to trigger file download
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
 * Download an image from a data URI as a JPG file
 * @param dataUri - The data URI of the image (e.g., "data:image/png;base64,...")
 * @param filename - The filename for the downloaded file (without extension)
 */
export const downloadImageAsJpg = (dataUri: string, filename: string): void => {
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
