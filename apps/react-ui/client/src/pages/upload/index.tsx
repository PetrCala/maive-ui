"use client";

import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import Head from "next/head";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { FileRejection } from "react-dropzone";
import { useDropzone } from "react-dropzone";
import { FaFileCsv, FaFileExcel, FaFileAlt } from "react-icons/fa";
import { DataPreview } from "@src/components/DataPreview";
import { DataProcessingService } from "@src/services/dataProcessingService";
import ActionButton from "@src/components/Buttons/ActionButton";
import { GoBackButton } from "@src/components/Buttons";
import Alert from "@src/components/Alert";
import RowInfoComponent from "@src/components/RowInfoComponent";
import CONST from "@src/CONST";
import TEXT from "@src/lib/text";
import MDXContent from "@src/context/MDXContent";
import CONFIG from "@src/CONFIG";
import { getRandomMockCsvFile } from "@src/utils/mockCsvFiles";
import { generateMockCSVFile } from "@src/utils/mockData";
import { useEnterKeyAction } from "@src/hooks/useEnterKeyAction";
import { useGlobalAlert } from "@src/components/GlobalAlertProvider";
import { parseLocalizedNumber } from "@utils/dataUtils";
import { dataCache, useDataStore } from "@store/dataStore";
import type { ColumnMapping, UploadedData } from "@store/dataStore";
import type { AlertType, DataArray } from "@src/types";

const REQUIRED_FIELDS: Array<keyof ColumnMapping> = ["effect", "se", "nObs"];

type MappingState = {
  effect: string | null;
  se: string | null;
  nObs: string | null;
  studyId: string | null;
};

type ValidationMessage = {
  type: AlertType;
  message: string;
};

type ValidationResult = {
  isValid: boolean;
  messages: ValidationMessage[];
  containsInfo?: boolean;
};

const INITIAL_MAPPING: MappingState = {
  effect: null,
  se: null,
  nObs: null,
  studyId: null,
};

const NORMALIZATION_RULES: Record<keyof MappingState, RegExp[]> = {
  effect: [/^effect$/, /^effect[_\s-]?size$/, /^estimate$/, /coef/, /beta/],
  se: [/^se$/, /standard[_\s-]?error/, /^stderr$/, /^std[_\s-]?err/],
  nObs: [/^n$/, /^n[_\s-]?obs$/, /^n[_\s-]?size$/, /sample/, /participants/],
  studyId: [/study/, /id$/],
};

const normalizeColumnName = (name: string): string => name.trim().toLowerCase();

const formatRawValue = (value: unknown): string => {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
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

const describeField = (
  fieldLabel: string,
  mappedColumn?: string | null,
): string => {
  return mappedColumn ? `${fieldLabel} – ${mappedColumn}` : fieldLabel;
};

const autoMapColumns = (
  columns: string[],
): { mapping: MappingState; applied: boolean } => {
  const usedColumns = new Set<string>();
  const mapping: MappingState = { ...INITIAL_MAPPING };

  (Object.keys(NORMALIZATION_RULES) as Array<keyof MappingState>).forEach(
    (field) => {
      NORMALIZATION_RULES[field].some((pattern) => {
        const match = columns.find((column) => {
          if (usedColumns.has(column)) {
            return false;
          }

          const normalized = normalizeColumnName(column);
          return pattern.test(normalized);
        });

        if (match) {
          mapping[field] = match;
          usedColumns.add(match);
          return true;
        }

        return false;
      });
    },
  );

  const requiredMapped = REQUIRED_FIELDS.every(
    (field) => mapping[field] !== null,
  );

  if (!requiredMapped && columns.length >= 3 && columns.length <= 4) {
    mapping.effect = columns[0] ?? null;
    mapping.se = columns[1] ?? null;
    mapping.nObs = columns[2] ?? null;
    mapping.studyId = columns[3] ?? null;
  }

  const hasAnyMapping = Object.values(mapping).some((value) => value !== null);

  return { mapping, applied: hasAnyMapping };
};

const convertToNormalizedRow = (
  row: Record<string, unknown>,
  mapping: MappingState,
): Record<string, unknown> => {
  const getValue = (column: string | null) => {
    if (!column) {
      return null;
    }

    const rawValue = row[column];

    if (rawValue === undefined || rawValue === null) {
      return null;
    }

    if (typeof rawValue === "string") {
      const trimmed = rawValue.trim();
      return trimmed === "" ? null : trimmed;
    }

    return rawValue;
  };

  const normalizeNumericValue = (column: string | null) => {
    const value = getValue(column);
    if (value === null || value === undefined || value === "") {
      return null;
    }

    const parsed = parseLocalizedNumber(value);
    return parsed ?? Number.NaN;
  };

  const normalized: Record<string, unknown> = {
    effect: normalizeNumericValue(mapping.effect),
    se: normalizeNumericValue(mapping.se),
    n_obs: normalizeNumericValue(mapping.nObs),
  };

  if (mapping.studyId) {
    normalized.study_id = getValue(mapping.studyId);
  }

  return normalized;
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

export default function UploadPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadedData, setUploadedData] = useState<UploadedData | null>(null);
  const [mapping, setMapping] = useState<MappingState>(INITIAL_MAPPING);
  const [autoMappingApplied, setAutoMappingApplied] = useState(false);
  const [normalizedData, setNormalizedData] = useState<DataArray>([]);
  const [validationResult, setValidationResult] =
    useState<ValidationResult | null>(null);

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const dataId = searchParams?.get("dataId") ?? null;

  const { showAlert } = useGlobalAlert();

  const onDrop = (acceptedFiles: File[]) => {
    if (acceptedFiles[0]) {
      setSelectedFile(acceptedFiles[0]);
    }
  };

  const onDropRejected = (rejectedFiles: FileRejection[]) => {
    const rejectedFile = rejectedFiles[0];
    if (
      rejectedFile.errors.some(
        (error: { code: string }) => error.code === "file-too-large",
      )
    ) {
      alert("File is too large. Maximum file size is 10MB.");
    } else if (
      rejectedFile.errors.some(
        (error: { code: string }) => error.code === "file-invalid-type",
      )
    ) {
      alert("Invalid file type. Please upload a CSV, XLS, or XLSX file.");
    } else {
      alert("File upload failed. Please try again.");
    }
  };

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    onDropRejected,
    accept: {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      "text/csv": [".csv"],
      // eslint-disable-next-line @typescript-eslint/naming-convention
      "application/vnd.ms-excel": [".xls"],
      // eslint-disable-next-line @typescript-eslint/naming-convention
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
        ".xlsx",
      ],
    },
    multiple: false,
    noClick: true,
    noKeyboard: true,
    maxSize: 10 * 1024 * 1024,
  });

  const handleGenerateMockData = () => {
    try {
      const mockFile = generateMockCSVFile();
      setSelectedFile(mockFile);
    } catch (error) {
      console.error("Error generating mock data:", error);
    }
  };

  const handleLoadRandomMockCsv = () => {
    try {
      const randomFile = getRandomMockCsvFile();
      const blob = new Blob([randomFile.content], { type: "text/csv" });
      const file = new File([blob], randomFile.filename, { type: "text/csv" });
      setSelectedFile(file);
    } catch (error) {
      console.error("Error loading random mock CSV:", error);
      handleGenerateMockData();
    }
  };

  const uploadButtonRef = useRef<HTMLButtonElement>(null);
  useEnterKeyAction(() => {
    const button = uploadButtonRef.current;

    if (button && !button.disabled) {
      button.click();
    }
  });

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      void (async () => {
        event.preventDefault();
        if (!selectedFile) {
          return;
        }

        setIsProcessing(true);
        try {
          const newDataId =
            await DataProcessingService.processAndStoreFile(selectedFile);
          const url = new URL(window.location.href);
          url.searchParams.set("dataId", newDataId);
          router.replace(`${pathname}?${url.searchParams.toString()}`);
        } catch (error) {
          console.error("Error processing file:", error);
          alert(
            "Failed to process the uploaded file. Please ensure it's a valid Excel or CSV file.",
          );
        } finally {
          setIsProcessing(false);
        }
      })();
    },
    [selectedFile, router, pathname],
  );

  const getFileIconComponent = (filename: string, size = 24) => {
    if (filename.endsWith(".csv")) {
      return <FaFileCsv className="text-primary" size={size} />;
    } else if (filename.endsWith(".xls") || filename.endsWith(".xlsx")) {
      return <FaFileExcel className="text-green-600" size={size} />;
    } else {
      return <FaFileAlt className="text-muted" size={size} />;
    }
  };

  const availableColumns = useMemo(() => {
    if (!uploadedData) {
      return [] as string[];
    }

    if (uploadedData.columnNames?.length) {
      return uploadedData.columnNames;
    }

    const firstRow = uploadedData.rawData[0] ?? {};
    return Object.keys(firstRow);
  }, [uploadedData]);

  const rawPreviewRows = useMemo(() => {
    if (!uploadedData) {
      return [] as string[][];
    }

    return uploadedData.rawData
      .slice(0, 5)
      .map((row) =>
        availableColumns.map((header) => formatRawValue(row[header])),
      );
  }, [availableColumns, uploadedData]);

  const mappedPreviewHeaders = useMemo(() => {
    if (!mapping.effect || !mapping.se || !mapping.nObs) {
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
  }, [mapping.effect, mapping.se, mapping.nObs, mapping.studyId]);

  const mappedPreviewRows = useMemo(() => {
    if (!normalizedData.length || mappedPreviewHeaders.length === 0) {
      return [] as string[][];
    }

    return normalizedData.slice(0, 5).map((row) => {
      const values: unknown[] = [row.effect, row.se, row.n_obs];

      if (mapping.studyId) {
        values.push(row.study_id);
      }

      return values.map((value) => formatNormalizedValue(value));
    });
  }, [normalizedData, mapping.studyId, mappedPreviewHeaders.length]);

  const usedColumns = useMemo(() => {
    return new Set(
      Object.entries(mapping)
        .map(([, value]) => value)
        .filter((value): value is string => !!value),
    );
  }, [mapping]);

  const mappingComplete = useMemo(() => {
    return REQUIRED_FIELDS.every((field) => mapping[field]);
  }, [mapping]);

  const handleMappingChange = (field: keyof MappingState, value: string) => {
    setMapping((prev) => ({
      ...prev,
      [field]: value || null,
    }));
    setAutoMappingApplied(false);
  };

  const handleContinue = () => {
    if (!mappingComplete) {
      showAlert(TEXT.mapping.validationIncomplete, "error");
      return;
    }

    if (!validationResult?.isValid || !dataId) {
      showAlert(
        "Please resolve the validation errors before continuing.",
        "error",
      );
      return;
    }

    router.push(`/model?dataId=${dataId}`);
  };

  useEffect(() => {
    if (!dataId) {
      setUploadedData(null);
      setMapping(INITIAL_MAPPING);
      setAutoMappingApplied(false);
      setNormalizedData([]);
      setValidationResult(null);
      return;
    }

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
        setMapping(INITIAL_MAPPING);
        setAutoMappingApplied(false);
        setNormalizedData([]);
        setValidationResult(null);
        router.replace(pathname ?? "/upload");
        return;
      }

      setUploadedData(data);

      if (data.columnMapping) {
        setMapping({
          effect: data.columnMapping.effect,
          se: data.columnMapping.se,
          nObs: data.columnMapping.nObs,
          studyId: data.columnMapping.studyId ?? null,
        });
        setAutoMappingApplied(false);
      } else {
        const columns = data.columnNames?.length
          ? data.columnNames
          : Object.keys(data.rawData[0] ?? {});
        const { mapping: guessedMapping, applied } = autoMapColumns(columns);
        setMapping(guessedMapping);
        setAutoMappingApplied(applied);
      }
    } catch (error) {
      console.error("Failed to load uploaded data:", error);
    }
  }, [dataId, pathname, router, showAlert]);

  useEffect(() => {
    if (!uploadedData || !dataId) {
      setNormalizedData([]);
      setValidationResult(null);
      return;
    }

    if (!mapping.effect || !mapping.se || !mapping.nObs) {
      setNormalizedData([]);
      setValidationResult(null);
      return;
    }

    try {
      const normalizedRows = uploadedData.rawData.map((row) =>
        convertToNormalizedRow(row, mapping),
      );

      const mappingConfig: ColumnMapping = {
        effect: mapping.effect,
        se: mapping.se,
        nObs: mapping.nObs,
        studyId: mapping.studyId ?? null,
      };

      DataProcessingService.applyColumnMapping(
        dataId,
        mappingConfig,
        normalizedRows,
      );

      setNormalizedData(normalizedRows);
      setValidationResult(validateData(normalizedRows, mappingConfig));
    } catch (error) {
      console.error("Failed to apply column mapping:", error);
      setValidationResult({
        isValid: false,
        messages: [
          {
            type: CONST.ALERT_TYPES.ERROR,
            message: "We couldn't apply the column mapping. Please try again.",
          },
        ],
      });
    }
  }, [uploadedData, dataId, mapping]);

  return (
    <>
      <Head>
        <title>{`${CONST.APP_DISPLAY_NAME} - Upload Data`}</title>
      </Head>
      <main className="content-page-container">
        <div className="max-w-4xl w-full px-2 sm:px-0">
          <GoBackButton href="/" text="Back to Home" />
          <div className="card p-6 sm:p-8">
            <h1 className="text-2xl sm:text-3xl font-bold mb-6 text-primary">
              {TEXT.upload.title}
            </h1>
            <div className="mb-6">
              <p className="text-secondary mb-2">{TEXT.upload.description}</p>
              <ul className="custom-bullet-list text-secondary">
                {Object.values(TEXT.upload.requirements).map(
                  (requirement, index) => (
                    <li key={index}>
                      <span className="bullet">•</span>
                      <div className="content">
                        <MDXContent
                          source={requirement}
                          className="list-item"
                        />
                      </div>
                    </li>
                  ),
                )}
              </ul>
            </div>

            <form
              onSubmit={(e) => {
                void handleSubmit(e);
              }}
              className="space-y-6"
            >
              <div className="space-y-2">
                <label className="block text-sm font-medium text-secondary">
                  Upload your data file
                </label>
                <div className="mt-1 flex flex-col gap-4 sm:flex-row">
                  <div className="flex-grow">
                    <div
                      {...getRootProps()}
                      className="flex w-full flex-col gap-4 sm:flex-row sm:items-center border-2 border-dashed border-focus rounded-lg p-6 min-h-[60px] transition-colors duration-200 surface-secondary hover:border-primary-600 focus:border-primary-600 cursor-pointer select-none"
                    >
                      <input {...getInputProps()} />
                      <div className="flex-1 flex flex-col items-start justify-center text-center sm:text-left">
                        <p className="text-primary text-base font-medium">
                          {isDragActive
                            ? "Drop the file here..."
                            : "Drag and drop your file here"}
                        </p>
                        <p className="text-xs text-muted mt-2">
                          Max size: 10MB &nbsp;|&nbsp; .csv, .xls, .xlsx
                        </p>
                      </div>
                      <ActionButton
                        onClick={open}
                        variant="secondary"
                        size="md"
                        className="w-full sm:w-auto sm:ml-8 sm:self-center rounded-full shadow-md"
                        style={{ minWidth: 120 }}
                      >
                        Choose File
                      </ActionButton>
                    </div>
                    {selectedFile && (
                      <div className="mt-2 w-full border-2 border-secondary rounded-xl px-6 py-4 text-base flex flex-col gap-3 sm:flex-row sm:items-center shadow-lg font-semibold surface-secondary">
                        <span className="text-2xl flex-shrink-0 sm:mr-4">
                          {getFileIconComponent(selectedFile.name)}
                        </span>
                        <span
                          className="text-primary font-medium truncate max-w-full sm:max-w-xs"
                          title={selectedFile.name}
                        >
                          {selectedFile.name}
                        </span>
                        <span className="text-muted font-normal text-sm sm:ml-auto sm:self-auto self-start">
                          {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {!selectedFile && CONFIG.SHOULD_SUGGEST_MOCK_DATA_USE && (
                <div className="flex justify-center sm:justify-end">
                  <div className="flex flex-col items-center gap-1 text-sm text-muted sm:flex-row sm:gap-2 sm:text-left">
                    <span className="text-center sm:text-left">
                      Don&apos;t have your data ready yet?
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        void handleLoadRandomMockCsv();
                      }}
                      className="text-sm font-bold text-primary hover:text-primary/80 transition-colors duration-200 cursor-pointer underline hover:no-underline"
                    >
                      Use mock data!
                    </button>
                  </div>
                </div>
              )}

              <ActionButton
                ref={uploadButtonRef}
                onClick={(event) => {
                  void handleSubmit(event as React.FormEvent<HTMLFormElement>);
                }}
                variant="primary"
                className="w-full"
                disabled={!selectedFile || isProcessing}
              >
                {isProcessing ? "Processing..." : "Upload and Process"}
              </ActionButton>
            </form>
          </div>

          {uploadedData && (
            <div className="space-y-6 mt-6">
              <div className="card p-6 sm:p-8 space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-primary mb-2">
                    {TEXT.mapping.title}
                  </h2>
                  <p className="text-secondary mb-2">
                    {TEXT.mapping.description}
                  </p>
                  <p className="text-muted text-sm">
                    {TEXT.mapping.helperText}
                  </p>
                </div>

                {autoMappingApplied && (
                  <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-4 text-sm text-blue-900 dark:text-blue-100">
                    {TEXT.mapping.autoMappingNotice}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(
                    Object.keys(TEXT.mapping.fieldLabels) as Array<
                      keyof typeof TEXT.mapping.fieldLabels
                    >
                  ).map((fieldKey) => {
                    const label = TEXT.mapping.fieldLabels[fieldKey];
                    const isRequired = REQUIRED_FIELDS.includes(
                      fieldKey as keyof ColumnMapping,
                    );

                    return (
                      <div key={fieldKey} className="flex flex-col">
                        <label className="text-sm font-medium text-secondary mb-2">
                          {label}
                          {isRequired ? (
                            <span className="text-red-500">*</span>
                          ) : null}
                        </label>
                        <select
                          className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900/40 text-gray-900 dark:text-gray-100 p-2 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
                          value={mapping[fieldKey] ?? ""}
                          onChange={(event) =>
                            handleMappingChange(fieldKey, event.target.value)
                          }
                        >
                          <option value="">
                            {isRequired ? "Select a column" : "Leave unmapped"}
                          </option>
                          {availableColumns.map((column) => (
                            <option
                              key={column}
                              value={column}
                              disabled={
                                mapping[fieldKey] !== column &&
                                usedColumns.has(column)
                              }
                            >
                              {column}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>

                <DataPreview
                  title={TEXT.mapping.rawPreviewTitle}
                  headers={availableColumns}
                  rows={rawPreviewRows}
                />

                <div className="space-y-4">
                  <DataPreview
                    title={TEXT.mapping.mappedPreviewTitle}
                    description={TEXT.mapping.mappedPreviewDescription}
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
                </div>
              </div>

              <div className="card p-6 sm:p-8 space-y-4">
                <div>
                  <h2 className="text-2xl font-bold text-primary mb-2">
                    {TEXT.mapping.validationTitle}
                  </h2>
                  <p className="text-secondary">
                    {TEXT.mapping.validationDescription}
                  </p>
                </div>

                {!mappingComplete ? (
                  <Alert
                    type={CONST.ALERT_TYPES.INFO}
                    message={TEXT.mapping.validationIncomplete}
                  />
                ) : (
                  <div className="space-y-3">
                    {validationResult?.messages.map((item, index) => (
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
                  {TEXT.mapping.continueButton}
                </ActionButton>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
