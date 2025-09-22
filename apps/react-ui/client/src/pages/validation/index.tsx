"use client";

import { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import { useRouter, useSearchParams } from "next/navigation";

import { GoBackButton } from "@src/components/Buttons";
import ActionButton from "@src/components/Buttons/ActionButton";
import Alert from "@src/components/Alert";
import RowInfoComponent from "@src/components/RowInfoComponent";
import { DataPreview } from "@src/components/DataPreview";
import CONST from "@src/CONST";
import TEXT from "@src/lib/text";
import CONFIG from "@src/CONFIG";
import { useGlobalAlert } from "@src/components/GlobalAlertProvider";
import { dataCache, useDataStore } from "@store/dataStore";
import type { ColumnMapping, UploadedData } from "@store/dataStore";
import type { AlertType, DataArray } from "@src/types";

const REQUIRED_FIELDS: Array<keyof ColumnMapping> = ["effect", "se", "nObs"];

type ValidationMessage = {
  type: AlertType;
  message: string;
};

type ValidationResult = {
  isValid: boolean;
  messages: ValidationMessage[];
  containsInfo?: boolean;
};

const describeField = (
  fieldLabel: string,
  mappedColumn?: string | null,
): string => {
  return mappedColumn ? `${fieldLabel} – ${mappedColumn}` : fieldLabel;
};

const formatNormalizedValue = (value: unknown): string => {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "number") {
    return Number.isNaN(value) ? "Invalid" : value.toString();
  }

  return String(value);
};

const validateData = (
  fullData: DataArray,
  mapping: ColumnMapping,
): ValidationResult => {
  const messages: ValidationMessage[] = [];

  if (fullData.length < 4) {
    messages.push({
      type: CONST.ALERT_TYPES.ERROR,
      message:
        "The file must contain at least 4 rows of data (excluding headers if present).",
    });
  }

  const effectField = describeField(
    TEXT.mapping.fieldLabels.effect,
    mapping.effect,
  );
  const seField = describeField(TEXT.mapping.fieldLabels.se, mapping.se);
  const nObsField = describeField(TEXT.mapping.fieldLabels.nObs, mapping.nObs);
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
        type: CONST.ALERT_TYPES.ERROR,
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
        type: CONST.ALERT_TYPES.ERROR,
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
      type: CONST.ALERT_TYPES.ERROR,
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
      type: CONST.ALERT_TYPES.ERROR,
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
      type: CONST.ALERT_TYPES.WARNING,
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
        type: CONST.ALERT_TYPES.ERROR,
        message:
          "The number of rows must be larger than the number of unique study IDs plus 3.",
      });
    }
  }

  if (fullData.length > 2000) {
    messages.push({
      type: CONST.ALERT_TYPES.WARNING,
      message: "Large dataset detected. Processing may take longer than usual.",
    });
  }

  const hasErrors = messages.some(
    (msg) => msg.type === CONST.ALERT_TYPES.ERROR,
  );
  if (!hasErrors) {
    messages.push({
      type: CONST.ALERT_TYPES.SUCCESS,
      message: "Your data is valid and ready for analysis!",
    });
  }

  return {
    isValid: !hasErrors,
    messages,
    containsInfo: messages.some((msg) => msg.type === CONST.ALERT_TYPES.INFO),
  };
};

export default function ValidationPage() {
  const searchParams = useSearchParams();
  const dataId = searchParams?.get("dataId");
  const router = useRouter();
  const { showAlert } = useGlobalAlert();
  const [uploadedData, setUploadedData] = useState<UploadedData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!dataId) {
      setUploadedData(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      let data: UploadedData | undefined = dataCache.get(dataId);

      if (!data) {
        const storeData = useDataStore.getState().uploadedData;
        if (storeData && storeData.id === dataId) {
          data = storeData;
          dataCache.set(dataId, data);
        }
      }

      if (!data) {
        showAlert(TEXT.mapping.mappingError, "error");
        setUploadedData(null);
        return;
      }

      setUploadedData(data);
    } catch (error) {
      console.error("Failed to load uploaded data:", error);
      showAlert(TEXT.mapping.mappingError, "error");
      setUploadedData(null);
    } finally {
      setLoading(false);
    }
  }, [dataId, showAlert]);

  const mapping = uploadedData?.columnMapping ?? null;

  const mappingComplete = useMemo(() => {
    if (!mapping) {
      return false;
    }

    return REQUIRED_FIELDS.every((field) => Boolean(mapping[field]));
  }, [mapping]);

  const normalizedData = useMemo<DataArray>(() => {
    return uploadedData?.data ?? [];
  }, [uploadedData]);

  const mappedPreviewHeaders = useMemo(() => {
    if (!mappingComplete || !mapping) {
      return [] as string[];
    }

    const headers = [
      describeField(TEXT.mapping.fieldLabels.effect, mapping.effect),
      describeField(TEXT.mapping.fieldLabels.se, mapping.se),
      describeField(TEXT.mapping.fieldLabels.nObs, mapping.nObs),
    ];

    if (mapping.studyId) {
      headers.push(
        describeField(TEXT.mapping.fieldLabels.studyId, mapping.studyId),
      );
    }

    return headers;
  }, [mappingComplete, mapping]);

  const mappedPreviewRows = useMemo(() => {
    if (!mappingComplete || !mapping || !normalizedData.length) {
      return [] as string[][];
    }

    return normalizedData.slice(0, 5).map((row) => {
      const values: unknown[] = [row.effect, row.se, row.n_obs];

      if (mapping.studyId) {
        values.push(row.study_id);
      }

      return values.map((value) => formatNormalizedValue(value));
    });
  }, [mappingComplete, mapping, normalizedData]);

  const validationResult = useMemo<ValidationResult | null>(() => {
    if (!mappingComplete || !mapping) {
      return null;
    }

    const mappingConfig: ColumnMapping = {
      effect: mapping.effect,
      se: mapping.se,
      nObs: mapping.nObs,
      studyId: mapping.studyId ?? null,
    };

    return validateData(normalizedData, mappingConfig);
  }, [mappingComplete, mapping, normalizedData]);

  const handleContinue = () => {
    if (!mappingComplete) {
      showAlert(TEXT.mapping.validationIncomplete, "error");
      return;
    }

    if (!validationResult?.isValid) {
      showAlert(
        "Please resolve the validation errors before continuing.",
        "error",
      );
      return;
    }

    if (!dataId) {
      showAlert(TEXT.mapping.mappingError, "error");
      return;
    }

    router.push(`/model?dataId=${dataId}`);
  };

  const backLink = dataId ? `/upload?dataId=${dataId}` : "/upload";

  return (
    <>
      <Head>
        <title>{`${CONST.APP_DISPLAY_NAME} - Validation`}</title>
      </Head>
      <main className="content-page-container">
        <div className="max-w-4xl w-full px-2 sm:px-0">
          <GoBackButton href={backLink} text="Back to upload" />

          <div className="card p-6 sm:p-8 space-y-4">
            <h1 className="text-2xl sm:text-3xl font-bold text-primary">
              {TEXT.validation.title}
            </h1>
            <p className="text-secondary">{TEXT.validation.description}</p>
            <p className="text-muted text-sm">{TEXT.validation.helperText}</p>
          </div>

          {loading ? (
            <div className="card p-6 sm:p-8 mt-6 text-center">
              <p className="text-secondary">{TEXT.validation.loading}</p>
            </div>
          ) : !uploadedData ? (
            <div className="card p-6 sm:p-8 mt-6 space-y-4 text-center">
              <h2 className="text-xl font-semibold text-primary">
                {TEXT.validation.missingDataTitle}
              </h2>
              <p className="text-secondary">
                {TEXT.validation.missingDataMessage}
              </p>
              <ActionButton
                onClick={() => {
                  router.push("/upload");
                }}
                variant="primary"
                className="mx-auto w-full sm:w-auto"
              >
                Back to upload
              </ActionButton>
            </div>
          ) : (
            <div className="space-y-6 mt-6">
              <div className="card p-6 sm:p-8 space-y-4">
                <div>
                  <h2 className="text-2xl font-bold text-primary mb-2">
                    {TEXT.validation.previewTitle}
                  </h2>
                  <p className="text-secondary">
                    {TEXT.validation.previewDescription}
                  </p>
                </div>

                {!mappingComplete ? (
                  <Alert
                    type={CONST.ALERT_TYPES.INFO}
                    message={TEXT.mapping.validationIncomplete}
                  />
                ) : (
                  <>
                    <DataPreview
                      headers={mappedPreviewHeaders}
                      rows={mappedPreviewRows}
                      emptyMessage={TEXT.mapping.validationIncomplete}
                    />
                    {normalizedData.length > 0 &&
                      CONFIG.SHOULD_SHOW_DF_ROWS_INFO && (
                        <RowInfoComponent
                          rowCount={normalizedData.length}
                          showFirstRows={normalizedData.length > 5}
                          rowCountToShow={5}
                        />
                      )}
                  </>
                )}
              </div>

              <div className="card p-6 sm:p-8 space-y-4">
                <div>
                  <h2 className="text-2xl font-bold text-primary mb-2">
                    {TEXT.validation.resultsTitle}
                  </h2>
                  <p className="text-secondary">
                    {TEXT.validation.resultsDescription}
                  </p>
                </div>

                {!mappingComplete || !validationResult ? (
                  <Alert
                    type={CONST.ALERT_TYPES.INFO}
                    message={TEXT.mapping.validationIncomplete}
                  />
                ) : (
                  <div className="space-y-3">
                    {validationResult.messages.map((item, index) => (
                      <Alert
                        key={`${item.type}-${index}`}
                        type={item.type}
                        message={item.message}
                      />
                    ))}
                  </div>
                )}

                <ActionButton
                  onClick={handleContinue}
                  variant="primary"
                  className="w-full"
                  disabled={!validationResult?.isValid}
                >
                  {TEXT.validation.continueButton}
                </ActionButton>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
