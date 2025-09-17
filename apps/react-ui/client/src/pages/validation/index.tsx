"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Head from "next/head";
import { useRouter } from "next/navigation";
import type { UploadedData } from "@store/dataStore";
import { useDataStore, dataCache } from "@store/dataStore";
import Alert from "@src/components/Alert";
import CONST from "@src/CONST";
import { useGlobalAlert } from "@src/components/GlobalAlertProvider";
import ActionButton from "@src/components/Buttons/ActionButton";
import { GoBackButton } from "@src/components/Buttons";
import RowInfoComponent from "@src/components/RowInfoComponent";
import CONFIG from "@src/CONFIG";
import type { AlertType, DataArray } from "@src/types";
import { useEnterKeyAction } from "@src/hooks/useEnterKeyAction";

type ValidationMessage = {
  type: AlertType;
  message: string;
};

type ValidationResult = {
  isValid: boolean;
  messages: ValidationMessage[];
  containsInfo?: boolean;
};

export default function ValidationPage() {
  const searchParams = useSearchParams();
  const dataId = searchParams?.get("dataId");
  const [preview, setPreview] = useState<string[][]>([]);
  const [validationResult, setValidationResult] = useState<ValidationResult>({
    isValid: false,
    messages: [],
  });
  const [loading, setLoading] = useState(true);
  const [uploadedData, setUploadedData] = useState<UploadedData | null>(null);
  const router = useRouter();
  const { showAlert } = useGlobalAlert();

  const continueButtonRef = useRef<HTMLButtonElement>(null);

  useEnterKeyAction(() => {
    const button = continueButtonRef.current;

    if (button && !button.disabled) {
      button.click();
    }
  });

  const validateData = (
    previewData: string[][],
    fullData: DataArray,
  ): ValidationResult => {
    const messages: ValidationMessage[] = [];
    const headers = previewData[0] || [];
    const hasHeaders =
      headers.length > 0 &&
      headers.some(
        (header) =>
          header !== undefined && header !== null && isNaN(Number(header)),
      );

    // Check if file has data
    if (fullData.length < 4) {
      messages.push({
        type: "error",
        message:
          "The file must contain at least 4 rows of data (excluding headers if present).",
      });
    }

    // Check column count
    const columnCount = hasHeaders
      ? headers.length
      : ((fullData[0]?.length || 0) as number);
    if (columnCount < 3 || columnCount > 4) {
      messages.push({
        type: "error",
        message: `The file must have exactly 3 or 4 columns. Found ${columnCount} columns.`,
      });
    }

    // Determine column mapping based on order
    const columnMapping = {
      effect: 0,
      se: 1,
      n_obs: 2,
      study_id: columnCount === 4 ? 3 : undefined,
    };

    // Validate data types for each column
    const columnChecks = [
      {
        name: "effect",
        index: columnMapping.effect,
        errorMsg:
          "The 1st column (effect estimates) contains non-numeric values. All effect estimates must be numbers.",
      },
      {
        name: "se",
        index: columnMapping.se,
        errorMsg:
          "The 2nd column (standard errors) contains non-numeric values. All standard errors must be numbers.",
      },
      {
        name: "n_obs",
        index: columnMapping.n_obs,
        errorMsg:
          "The 3rd column (number of observations) contains non-numeric values. All number of observations must be numbers.",
      },
      {
        name: "study_id",
        index: columnMapping.study_id,
        errorMsg:
          "The 4th column (study ID) contains invalid values. Study IDs can be strings or numbers.",
        optional: true,
      },
    ];

    // Check data types for required columns
    columnChecks
      .filter((col) => !col.optional && col.index !== undefined)
      .forEach((col) => {
        const hasNonNumeric = fullData.some((row) => {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          const value = hasHeaders ? row[headers[col.index!]] : row[col.index!];
          return value !== undefined && value !== null && isNaN(Number(value));
        });
        if (hasNonNumeric) {
          messages.push({
            type: "error",
            message: col.errorMsg,
          });
        }
      });

    // Check optional study_id column if present
    const studyIdCol = columnChecks.find((col) => col.name === "study_id");
    if (studyIdCol?.index !== undefined) {
      // For study_id, we only check that values are not empty/null, not that they're numeric
      const hasInvalidValues = fullData.some((row) => {
        const value = hasHeaders
          ? // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            row[headers[studyIdCol.index!]]
          : // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            row[studyIdCol.index!];
        return value === undefined || value === null || value === "";
      });
      if (hasInvalidValues) {
        messages.push({
          type: "error",
          message: studyIdCol.errorMsg,
        });
      }
    }

    // Check for non-positive number of observations
    const nObsColIndex = columnMapping.n_obs;
    if (nObsColIndex !== undefined) {
      const nonPositiveIndexes: number[] = [];
      fullData.forEach((row, index) => {
        const value = hasHeaders
          ? Number(row[headers[nObsColIndex]])
          : Number(row[nObsColIndex]);
        if (!isNaN(value) && (value <= 0 || !Number.isInteger(value))) {
          nonPositiveIndexes.push(index + 1); // Convert to 1-based indexing for user display
        }
      });

      if (nonPositiveIndexes.length > 0) {
        const maxIndexes = 3;
        const displayIndexes = nonPositiveIndexes.slice(0, maxIndexes);
        const hasMore = nonPositiveIndexes.length > maxIndexes;
        const indexesText = displayIndexes.join(", ") + (hasMore ? "..." : "");

        messages.push({
          type: "error",
          message: `The number of observations column must contain only positive integers (greater than 0). Found invalid values at row(s): ${indexesText}. Please check your data.`,
        });
      }
    }

    // Check for negative standard errors
    const seColIndex = columnMapping.se;
    if (seColIndex !== undefined) {
      const hasNegativeSE = fullData.some((row) => {
        const value = hasHeaders
          ? Number(row[headers[seColIndex]])
          : Number(row[seColIndex]);
        return !isNaN(value) && value < 0;
      });

      if (hasNegativeSE) {
        messages.push({
          type: "error",
          message:
            "Standard errors cannot be negative. Please check your data.",
        });
      }
    }

    // Check for missing values
    const hasMissingValues = fullData.some((row) => {
      if (hasHeaders) {
        return Object.values(row).some(
          (cell: unknown) => cell === undefined || cell === null || cell === "",
        );
      } else {
        // For files without headers, check the first 3 columns (required)
        for (let i = 0; i < 3; i++) {
          if (row[i] === undefined || row[i] === null || row[i] === "") {
            return true;
          }
        }
        // Check 4th column if present
        if (
          columnCount === 4 &&
          (row[3] === undefined || row[3] === null || row[3] === "")
        ) {
          return true;
        }
        return false;
      }
    });

    if (hasMissingValues) {
      messages.push({
        type: "warning",
        message:
          "The data contains missing values. These will be excluded from the analysis.",
      });
    }

    // Check study_id constraint if present
    if (columnMapping.study_id !== undefined) {
      const uniqueStudyIds = new Set(
        fullData.map((row) =>
          hasHeaders
            ? // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              row[headers[columnMapping.study_id!]]
            : // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              row[columnMapping.study_id!],
        ),
      ).size;
      if (!(fullData.length >= uniqueStudyIds + 3)) {
        messages.push({
          type: "error",
          message:
            "The number of rows must be larger than the number of unique study IDs plus 3.",
        });
      }
    }

    // Check for reasonable data size
    if (fullData.length > 2000) {
      messages.push({
        type: "warning",
        message:
          "Large dataset detected. Processing may take longer than usual.",
      });
    }

    // If no errors, add success message
    const hasErrors = messages.some((msg) => msg.type === "error");
    if (!hasErrors) {
      messages.push({
        type: "success",
        message: "Your data is valid and ready for analysis!",
      });
    }

    return {
      isValid: !hasErrors,
      messages,
      containsInfo: messages.some((msg) => msg.type === CONST.ALERT_TYPES.INFO),
    };
  };

  const loadDataFromStore = () => {
    try {
      // Try to get data from cache first
      let data: UploadedData | undefined = dataCache.get(dataId ?? "");

      // If not in cache, try to get from store
      if (!data) {
        const storeData = useDataStore.getState().uploadedData;
        if (storeData && storeData.id === dataId) {
          data = storeData;
          // Also put it back in cache
          dataCache.set(dataId, data);
        }
      }

      if (!data) {
        throw new Error("Data not found");
      }

      setUploadedData(data);

      // Convert data to preview format
      const headers = Object.keys(data.data[0] || {});
      const hasHeaders =
        headers.length > 0 &&
        headers.some(
          (header) =>
            header !== undefined && header !== null && isNaN(Number(header)),
        );

      let previewData: string[][];

      if (hasHeaders) {
        // File has headers, use them
        previewData = [
          headers,
          ...data.data
            .slice(0, 4)
            .map((row: unknown) =>
              headers.map((header) =>
                String((row as Record<string, unknown>)[header] || ""),
              ),
            ),
        ];
      } else {
        // File has no headers, use positional column names
        const columnNames = ["effect", "se", "n_obs"];
        if (data.data[0] && Object.keys(data.data[0]).length === 4) {
          columnNames.push("study_id");
        }

        previewData = [
          columnNames,
          ...data.data
            .slice(0, 4)
            .map((row: unknown) =>
              columnNames.map((columnName) =>
                String((row as Record<string, unknown>)[columnName] || ""),
              ),
            ),
        ];
      }

      setPreview(previewData);

      // Validate the data
      const validation = validateData(previewData, data.data);
      setValidationResult(validation);
    } catch (error) {
      console.error("Error loading data:", error);
      setValidationResult({
        isValid: false,
        messages: [
          {
            type: "error",
            message:
              "Failed to load the uploaded data. Please try uploading again.",
          },
        ],
      });
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = () => {
    if (validationResult.isValid && uploadedData) {
      router.push(`/model?dataId=${dataId}`);
    }
  };

  useEffect(() => {
    if (dataId) {
      loadDataFromStore();
    } else {
      showAlert("No data selected", "error");
      router.push("/upload");
    }
  }, [dataId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <Head>
        <title>{`${CONST.APP_DISPLAY_NAME} - Data Validation`}</title>
      </Head>
      <main className="content-page-container">
        {!dataId ? (
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">No data selected</h1>
            <GoBackButton
              href="/upload"
              text="Go back to upload"
              variant="simple"
            />
          </div>
        ) : !!loading ? (
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-300">
              Validating your data...
            </p>
          </div>
        ) : (
          <div className="max-w-4xl w-full">
            <GoBackButton href="/upload" text="Back to Upload" />
            <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 mb-8">
              <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">
                Data Validation: {uploadedData?.filename}
              </h1>

              {/* File Preview */}
              <div className="mb-8">
                <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
                  File Preview
                </h2>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        {preview[0]?.map((header, index) => (
                          <th
                            key={index}
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                          >
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {preview.slice(1).map((row, rowIndex) => (
                        <tr key={rowIndex}>
                          {row.map((cell, cellIndex) => (
                            <td
                              key={cellIndex}
                              className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300"
                            >
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!!CONFIG?.SHOULD_SHOW_DF_ROWS_INFO && (
                  <RowInfoComponent
                    rowCount={uploadedData?.data?.length ?? 0}
                    showFirstRows={(uploadedData?.data?.length ?? 0) > 4}
                    rowCountToShow={4}
                  />
                )}
              </div>

              {/* Validation Messages */}
              <div>
                <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
                  Validation Results
                </h2>
                <div className="space-y-3">
                  {validationResult.messages.map((message, index) => (
                    <Alert
                      key={index}
                      message={message.message}
                      type={message.type}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end items-center space-x-4">
              {(!validationResult.isValid || validationResult.containsInfo) && (
                <ActionButton
                  onClick={() => {
                    window.location.href = "/upload";
                  }}
                  variant="secondary"
                >
                  Reupload Your Data
                </ActionButton>
              )}
              <ActionButton
                ref={continueButtonRef}
                onClick={handleContinue}
                disabled={!validationResult.isValid}
                variant="primary"
              >
                Continue to Model
              </ActionButton>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
