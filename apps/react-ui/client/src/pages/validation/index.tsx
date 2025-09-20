"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Head from "next/head";
import { useRouter } from "next/navigation";
import type { ColumnMapping, UploadedData } from "@store/dataStore";
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
import TEXT from "@src/lib/text";

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

  const describeField = (
    fieldLabel: string,
    mappedColumn?: string | null,
  ): string => {
    return mappedColumn ? `${fieldLabel} (${mappedColumn})` : fieldLabel;
  };

  const validateData = (
    fullData: DataArray,
    mapping: ColumnMapping,
  ): ValidationResult => {
    const messages: ValidationMessage[] = [];

    if (fullData.length < 4) {
      messages.push({
        type: "error",
        message:
          "The file must contain at least 4 rows of data (excluding headers if present).",
      });
    }

    const effectField = describeField(
      TEXT.mapping.fieldLabels.effect,
      mapping.effect,
    );
    const seField = describeField(TEXT.mapping.fieldLabels.se, mapping.se);
    const nObsField = describeField(
      TEXT.mapping.fieldLabels.nObs,
      mapping.nObs,
    );
    const studyIdField = describeField(
      TEXT.mapping.fieldLabels.studyId,
      mapping.studyId ?? undefined,
    );

    const columnChecks = [
      {
        key: "effect" as const,
        errorMsg: `The ${effectField} column contains non-numeric values. All effect estimates must be numbers.`,
      },
      {
        key: "se" as const,
        errorMsg: `The ${seField} column contains non-numeric values. All standard errors must be numbers.`,
      },
      {
        key: "n_obs" as const,
        errorMsg: `The ${nObsField} column contains non-numeric values. All sample sizes must be numbers.`,
      },
    ];

    columnChecks.forEach((col) => {
      const hasNonNumeric = fullData.some((row) => {
        const value = row[col.key];
        if (value === undefined || value === null) {
          return false;
        }
        if (typeof value === "number") {
          return Number.isNaN(value);
        }
        return Number.isNaN(Number(value));
      });

      if (hasNonNumeric) {
        messages.push({
          type: "error",
          message: col.errorMsg,
        });
      }
    });

    if (mapping.studyId) {
      const hasInvalidStudyId = fullData.some((row) => {
        const value = row.study_id;
        return value === undefined || value === null || value === "";
      });

      if (hasInvalidStudyId) {
        messages.push({
          type: "error",
          message: `The ${studyIdField} column contains empty values. Study IDs can be strings or numbers.`,
        });
      }
    }

    const nonPositiveIndexes: number[] = [];
    fullData.forEach((row, index) => {
      const value = row.n_obs;
      if (value === undefined || value === null) {
        return;
      }

      const numericValue = typeof value === "number" ? value : Number(value);
      if (
        !Number.isNaN(numericValue) &&
        (numericValue <= 0 || !Number.isInteger(numericValue))
      ) {
        nonPositiveIndexes.push(index + 1);
      }
    });

    if (nonPositiveIndexes.length > 0) {
      const maxIndexes = 3;
      const displayIndexes = nonPositiveIndexes.slice(0, maxIndexes);
      const hasMore = nonPositiveIndexes.length > maxIndexes;
      const indexesText = displayIndexes.join(", ") + (hasMore ? "..." : "");

      messages.push({
        type: "error",
        message: `The ${nObsField} column must contain only positive integers (greater than 0). Found invalid values at row(s): ${indexesText}. Please check your data.`,
      });
    }

    const hasNegativeSE = fullData.some((row) => {
      const value = row.se;
      if (value === undefined || value === null) {
        return false;
      }
      const numericValue = typeof value === "number" ? value : Number(value);
      return !Number.isNaN(numericValue) && numericValue < 0;
    });

    if (hasNegativeSE) {
      messages.push({
        type: "error",
        message: "Standard errors cannot be negative. Please check your data.",
      });
    }

    const hasMissingValues = fullData.some((row) => {
      return ["effect", "se", "n_obs"].some((key) => {
        const value = row[key];
        return value === undefined || value === null || value === "";
      });
    });

    if (hasMissingValues) {
      messages.push({
        type: "warning",
        message:
          "The data contains missing values. These will be excluded from the analysis.",
      });
    }

    if (mapping.studyId) {
      const uniqueStudyIds = new Set(
        fullData
          .map((row) => row.study_id)
          .filter((value) => value !== undefined && value !== null),
      ).size;

      if (!(fullData.length >= uniqueStudyIds + 3)) {
        messages.push({
          type: "error",
          message:
            "The number of rows must be larger than the number of unique study IDs plus 3.",
        });
      }
    }

    if (fullData.length > 2000) {
      messages.push({
        type: "warning",
        message:
          "Large dataset detected. Processing may take longer than usual.",
      });
    }

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

      if (!data.columnMapping) {
        showAlert(TEXT.mapping.validationRedirectError, "info");
        router.push(`/upload/mapping?dataId=${dataId}`);
        return;
      }

      setUploadedData(data);

      const previewHeaders = [
        describeField(
          TEXT.mapping.fieldLabels.effect,
          data.columnMapping.effect,
        ),
        describeField(TEXT.mapping.fieldLabels.se, data.columnMapping.se),
        describeField(TEXT.mapping.fieldLabels.nObs, data.columnMapping.nObs),
      ];

      if (data.columnMapping.studyId) {
        previewHeaders.push(
          describeField(
            TEXT.mapping.fieldLabels.studyId,
            data.columnMapping.studyId,
          ),
        );
      }

      const previewRows = data.data.slice(0, 4).map((row) => {
        const values = [row.effect, row.se, row.n_obs];

        if (data.columnMapping?.studyId) {
          values.push(row.study_id);
        }

        return values.map((value) =>
          value === undefined || value === null ? "" : String(value),
        );
      });

      setPreview([previewHeaders, ...previewRows]);

      const validation = validateData(data.data, data.columnMapping);
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
