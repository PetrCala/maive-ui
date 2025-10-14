"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { parseLocalizedNumber } from "@utils/dataUtils";
import { DataProcessingService } from "@src/services/dataProcessingService";
import { useEnterKeyAction } from "@src/hooks/useEnterKeyAction";
import type {
  FilterJoiner,
  FilterOperator,
  SubsampleFilterCondition,
} from "@src/types";
import { FILTER_OPERATOR_OPTIONS } from "@src/utils/filterUtils";

const REQUIRED_FIELDS: Array<keyof ColumnMapping> = ["effect", "se", "nObs"];

type MappingState = {
  effect: string | null;
  se: string | null;
  nObs: string | null;
  studyId: string | null;
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

type ValidationMessage = {
  type: AlertType;
  message: string;
};

type NormalizedRow = {
  effect: number | null;
  se: number | null;
  n_obs: number | null;
  study_id?: unknown;
  [key: string]: unknown;
};

type ColumnKey = keyof Pick<NormalizedRow, "effect" | "se" | "n_obs">;

type RowIssue = {
  rowIndex: number;
  columns: ColumnKey[];
};

type NormalizationIssues = {
  rowsWithMissing: RowIssue[];
  rowsWithInfinite: RowIssue[];
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
  return mappedColumn ? `${fieldLabel} (${mappedColumn})` : fieldLabel;
};

const formatRawValue = (value: unknown): string => {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
};

const formatNumberValue = (value: number): string => {
  return Number.isNaN(value)
    ? "Invalid"
    : value % 1 === 0
      ? value.toString()
      : // Truncate to 3 decimal places
        value.toString().replace(/(\.\d{1,3})\d*$/, "$1");
};

const formatNormalizedValue = (value: unknown): string => {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "number") {
    return formatNumberValue(value);
  }

  return String(value);
};

const FINITE_COLUMNS: ColumnKey[] = ["effect", "se", "n_obs"];

type FilterConditionState = {
  column: string;
  operator: FilterOperator;
  value: string;
};

const createEmptyCondition = (): FilterConditionState => ({
  column: "",
  operator: "equals",
  value: "",
});

const toNumericValue = (value: unknown): number | null => {
  if (typeof value === "number" && !Number.isNaN(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value.trim());
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  return null;
};

const toComparableString = (value: unknown): string | null => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string") {
    return value.trim().toLowerCase();
  }

  if (typeof value === "number" && !Number.isNaN(value)) {
    return value.toString();
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  return String(value).trim().toLowerCase();
};

const evaluateFilterCondition = (
  row: NormalizedRow,
  condition: SubsampleFilterCondition,
): boolean => {
  const rowValue = row[condition.column];

  if (rowValue === null || rowValue === undefined) {
    return false;
  }

  const rowNumber = toNumericValue(rowValue);
  const conditionNumber = toNumericValue(condition.value);
  const hasNumericComparison =
    rowNumber !== null && conditionNumber !== null;

  switch (condition.operator) {
    case "equals":
      if (hasNumericComparison) {
        return rowNumber === conditionNumber;
      }
      return (
        toComparableString(rowValue) ===
        toComparableString(condition.value)
      );
    case "notEquals":
      if (hasNumericComparison) {
        return rowNumber !== conditionNumber;
      }
      return (
        toComparableString(rowValue) !==
        toComparableString(condition.value)
      );
    case "greaterThan":
      return hasNumericComparison ? rowNumber > conditionNumber : false;
    case "greaterThanOrEqual":
      return hasNumericComparison ? rowNumber >= conditionNumber : false;
    case "lessThan":
      return hasNumericComparison ? rowNumber < conditionNumber : false;
    case "lessThanOrEqual":
      return hasNumericComparison ? rowNumber <= conditionNumber : false;
    default:
      return false;
  }
};

const convertToNormalizedRow = (
  row: Record<string, unknown>,
  mapping: MappingState,
): NormalizedRow => {
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

  const normalized: NormalizedRow = {
    ...row,
    effect: normalizeNumericValue(mapping.effect),
    se: normalizeNumericValue(mapping.se),
    n_obs: normalizeNumericValue(mapping.nObs),
  };

  if (mapping.studyId) {
    normalized.study_id = getValue(mapping.studyId);
  }

  return normalized;
};

const analyzeNormalizedRows = (
  rows: NormalizedRow[],
): { sanitizedRows: NormalizedRow[]; issues: NormalizationIssues } => {
  const rowsWithMissing: RowIssue[] = [];
  const rowsWithInfinite: RowIssue[] = [];
  const invalidRowIndexes = new Set<number>();

  rows.forEach((row, index) => {
    const missingColumns: ColumnKey[] = [];
    const infiniteColumns: ColumnKey[] = [];

    FINITE_COLUMNS.forEach((columnKey) => {
      const value = row[columnKey];

      if (value === null || value === undefined) {
        missingColumns.push(columnKey);
        invalidRowIndexes.add(index);
        return;
      }

      if (typeof value !== "number" || Number.isNaN(value)) {
        invalidRowIndexes.add(index);
        return;
      }

      if (!Number.isFinite(value)) {
        infiniteColumns.push(columnKey);
        invalidRowIndexes.add(index);
      }
    });

    if (missingColumns.length > 0) {
      rowsWithMissing.push({ rowIndex: index + 1, columns: missingColumns });
    }

    if (infiniteColumns.length > 0) {
      rowsWithInfinite.push({ rowIndex: index + 1, columns: infiniteColumns });
    }
  });

  const sanitizedRows = rows.filter(
    (_, index) => !invalidRowIndexes.has(index),
  );

  return {
    sanitizedRows,
    issues: {
      rowsWithMissing,
      rowsWithInfinite,
    },
  };
};

const createEmptyNormalizationIssues = (): NormalizationIssues => ({
  rowsWithMissing: [],
  rowsWithInfinite: [],
});

const formatRowIssuesMessage = (
  issues: RowIssue[],
  columnDescriptions: Record<ColumnKey, string>,
): string => {
  const maxRowsToDisplay = 5;
  const displayedRows = issues.slice(0, maxRowsToDisplay);
  const formattedRows = displayedRows.map(({ rowIndex, columns }) => {
    const columnList = columns
      .map((column) => columnDescriptions[column])
      .join(", ");
    return `Row ${rowIndex} (${columnList})`;
  });

  const remainingCount = issues.length - displayedRows.length;
  if (remainingCount > 0) {
    formattedRows.push(`...and ${remainingCount} more row(s)`);
  }

  return formattedRows.join("; ");
};

const validateData = (
  fullData: DataArray,
  mapping: ColumnMapping,
  issues?: NormalizationIssues,
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

  const columnDescriptions: Record<ColumnKey, string> = {
    effect: effectField,
    se: seField,
    n_obs: nObsField,
  };

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
    const indexesText = displayIndexes.join(", ") + (hasMore ? ",..." : "");

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

  if (issues?.rowsWithMissing.length) {
    const formatted = formatRowIssuesMessage(
      issues.rowsWithMissing,
      columnDescriptions,
    );
    messages.push({
      type: CONST.ALERT_TYPES.WARNING,
      message:
        formatted.length > 0
          ? `The data contains missing values in ${formatted}. These rows will be removed from the analysis.`
          : "The data contains missing values. These rows will be removed from the analysis.",
    });
  }

  if (issues?.rowsWithInfinite.length) {
    const formatted = formatRowIssuesMessage(
      issues.rowsWithInfinite,
      columnDescriptions,
    );
    messages.push({
      type: CONST.ALERT_TYPES.WARNING,
      message:
        formatted.length > 0
          ? `Rows with infinite values (${formatted}) were removed before running the analysis. Please replace these values if you want them included.`
          : "Rows with infinite values were removed before running the analysis. Please replace these values if you want them included.",
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
  const [mapping, setMapping] = useState<MappingState>(INITIAL_MAPPING);
  const [autoMappingApplied, setAutoMappingApplied] = useState(false);
  const [normalizedData, setNormalizedData] = useState<DataArray>([]);
  const [normalizationIssues, setNormalizationIssues] =
    useState<NormalizationIssues>(createEmptyNormalizationIssues);
  const [isFilterEnabled, setIsFilterEnabled] = useState(false);
  const [filterConditions, setFilterConditions] = useState<
    FilterConditionState[]
  >([createEmptyCondition(), createEmptyCondition()]);
  const [filterJoiner, setFilterJoiner] = useState<FilterJoiner>("AND");
  const continueButtonRef = useRef<HTMLButtonElement>(null);
  const filterInitializedRef = useRef(false);

  useEnterKeyAction(() => {
    const button = continueButtonRef.current;

    if (button && !button.disabled) {
      button.click();
    }
  });

  useEffect(() => {
    filterInitializedRef.current = false;
  }, [dataId]);

  useEffect(() => {
    if (!dataId) {
      setUploadedData(null);
      setMapping(INITIAL_MAPPING);
      setAutoMappingApplied(false);
      setNormalizedData([]);
      setNormalizationIssues(createEmptyNormalizationIssues());
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
        setMapping(INITIAL_MAPPING);
        setAutoMappingApplied(false);
        setNormalizedData([]);
        setNormalizationIssues(createEmptyNormalizationIssues());
        return;
      }

      const columns = data.columnNames?.length
        ? data.columnNames
        : Object.keys(data.rawData[0] ?? {});

      if (data.columnMapping) {
        setMapping({
          effect: data.columnMapping.effect,
          se: data.columnMapping.se,
          nObs: data.columnMapping.nObs,
          studyId: data.columnMapping.studyId ?? null,
        });
        setAutoMappingApplied(false);
      } else {
        const { mapping: guessedMapping, applied } = autoMapColumns(columns);
        setMapping(guessedMapping);
        setAutoMappingApplied(applied);
      }

      setUploadedData(data);
    } catch (error) {
      console.error("Failed to load uploaded data:", error);
      showAlert(TEXT.mapping.mappingError, "error");
      setUploadedData(null);
      setMapping(INITIAL_MAPPING);
      setAutoMappingApplied(false);
      setNormalizedData([]);
      setNormalizationIssues(createEmptyNormalizationIssues());
    } finally {
      setLoading(false);
    }
  }, [dataId, showAlert]);

  useEffect(() => {
    if (!uploadedData) {
      setIsFilterEnabled(false);
      setFilterJoiner("AND");
      setFilterConditions([createEmptyCondition(), createEmptyCondition()]);
      return;
    }

    if (filterInitializedRef.current) {
      return;
    }

    const savedFilter = uploadedData.subsampleFilter;

    if (savedFilter?.enabled) {
      setIsFilterEnabled(true);
      setFilterJoiner(savedFilter.joiner);

      const nextConditions: FilterConditionState[] = [
        createEmptyCondition(),
        createEmptyCondition(),
      ];

      savedFilter.conditions.slice(0, 2).forEach((condition, index) => {
        nextConditions[index] = {
          column: condition.column ?? "",
          operator: condition.operator ?? "equals",
          value: condition.value ?? "",
        };
      });

      setFilterConditions(nextConditions);
    } else {
      setIsFilterEnabled(false);
      setFilterJoiner("AND");
      setFilterConditions([createEmptyCondition(), createEmptyCondition()]);
    }

    filterInitializedRef.current = true;
  }, [uploadedData]);

  const mappingComplete = useMemo(() => {
    return REQUIRED_FIELDS.every((field) => Boolean(mapping[field]));
  }, [mapping]);

  const mappingConfig = useMemo<ColumnMapping | null>(() => {
    if (!mapping.effect || !mapping.se || !mapping.nObs) {
      return null;
    }

    return {
      effect: mapping.effect,
      se: mapping.se,
      nObs: mapping.nObs,
      studyId: mapping.studyId ?? null,
    };
  }, [mapping.effect, mapping.nObs, mapping.se, mapping.studyId]);

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
    if (!mappingComplete || !mapping.effect || !mapping.se || !mapping.nObs) {
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
  }, [
    mappingComplete,
    mapping.effect,
    mapping.nObs,
    mapping.se,
    mapping.studyId,
  ]);

  const mappedPreviewRows = useMemo(() => {
    if (!mappingComplete || !normalizedData.length) {
      return [] as string[][];
    }

    return filteredNormalizedData.slice(0, 5).map((row) => {
      const values: unknown[] = [row.effect, row.se, row.n_obs];

      if (mapping.studyId) {
        values.push(row.study_id);
      }

      return values.map((value) => formatNormalizedValue(value));
    });
  }, [
    filteredNormalizedData,
    mapping.studyId,
    mappingComplete,
    normalizedData.length,
  ]);

  const usedColumns = useMemo(() => {
    return new Set(
      Object.values(mapping).filter((value): value is string => Boolean(value)),
    );
  }, [mapping]);

  const activeFilterConditions = useMemo<SubsampleFilterCondition[]>(() => {
    if (!isFilterEnabled) {
      return [];
    }

    return filterConditions
      .map((condition) => ({
        column: condition.column,
        operator: condition.operator,
        value: condition.value.trim(),
      }))
      .filter((condition) => condition.column && condition.value !== "");
  }, [filterConditions, isFilterEnabled]);

  const filteredNormalizedData = useMemo(() => {
    if (!isFilterEnabled || !activeFilterConditions.length) {
      return normalizedData;
    }

    return normalizedData.filter((row) => {
      const evaluations = activeFilterConditions.map((condition) =>
        evaluateFilterCondition(row, condition),
      );

      if (activeFilterConditions.length === 1) {
        return evaluations[0] ?? false;
      }

      if (filterJoiner === "AND") {
        return evaluations.every(Boolean);
      }

      return evaluations.some(Boolean);
    });
  }, [
    activeFilterConditions,
    filterJoiner,
    isFilterEnabled,
    normalizedData,
  ]);

  const totalRowCount = normalizedData.length;
  const matchingRowCount = filteredNormalizedData.length;
  const matchingPercentage = totalRowCount
    ? (matchingRowCount / totalRowCount) * 100
    : 0;
  const formattedMatchingPercentage =
    matchingPercentage % 1 === 0
      ? matchingPercentage.toFixed(0)
      : matchingPercentage.toFixed(1);

  const rowsMatchingText = TEXT.validation.filter.rowsMatching
    .replace("{matching}", matchingRowCount.toLocaleString())
    .replace("{total}", totalRowCount.toLocaleString())
    .replace("{percentage}", formattedMatchingPercentage);

  const filterHasActiveConditions =
    isFilterEnabled && activeFilterConditions.length > 0;

  const filterProducesNoRows =
    filterHasActiveConditions && totalRowCount > 0 && matchingRowCount === 0;

  const previewEmptyMessage = filterHasActiveConditions
    ? TEXT.validation.filter.previewEmpty
    : TEXT.mapping.validationIncomplete;

  useEffect(() => {
    if (!uploadedData || !dataId) {
      setNormalizedData([]);
      setNormalizationIssues(createEmptyNormalizationIssues());
      return;
    }

    if (!mapping.effect || !mapping.se || !mapping.nObs) {
      setNormalizedData([]);
      setNormalizationIssues(createEmptyNormalizationIssues());
      return;
    }

    try {
      const normalizedRows = uploadedData.rawData.map((row) =>
        convertToNormalizedRow(row, mapping),
      );

      const { sanitizedRows, issues } = analyzeNormalizedRows(normalizedRows);

      setNormalizationIssues(issues);
      setNormalizedData(sanitizedRows);
    } catch (error) {
      console.error("Failed to apply column mapping:", error);
      showAlert(
        "We couldn't apply the column mapping. Please try again.",
        "error",
      );
      setNormalizationIssues(createEmptyNormalizationIssues());
    }
  }, [uploadedData, dataId, mapping, showAlert]);

  const validationResult = useMemo<ValidationResult | null>(() => {
    if (!mappingComplete || !mappingConfig) {
      return null;
    }
    return validateData(normalizedData, mappingConfig, normalizationIssues);
  }, [mappingComplete, mappingConfig, normalizedData, normalizationIssues]);

  useEffect(() => {
    if (!dataId || !mappingComplete || !mappingConfig) {
      return;
    }

    try {
      const subsampleFilter = isFilterEnabled
        ? {
            enabled: true,
            joiner: filterJoiner,
            conditions: activeFilterConditions,
            totalRowCount,
            matchingRowCount,
          }
        : null;

      DataProcessingService.applyColumnMapping(
        dataId,
        mappingConfig,
        filteredNormalizedData,
        {
          subsampleFilter,
        },
      );
    } catch (error) {
      console.error("Failed to update processed data:", error);
      showAlert(TEXT.validation.filter.updateError, "error");
    }
  }, [
    activeFilterConditions,
    dataId,
    filteredNormalizedData,
    filterJoiner,
    isFilterEnabled,
    mappingComplete,
    mappingConfig,
    matchingRowCount,
    showAlert,
    totalRowCount,
  ]);

  const updateFilterCondition = (
    index: number,
    updates: Partial<FilterConditionState>,
  ) => {
    setFilterConditions((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...updates };
      return next;
    });
  };

  const handleMappingChange = (field: keyof MappingState, value: string) => {
    setMapping((prev) => ({
      ...prev,
      [field]: value || null,
    }));
    setAutoMappingApplied(false);
  };

  const isContinueDisabled = !validationResult?.isValid || filterProducesNoRows;

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

    if (filterProducesNoRows) {
      showAlert(TEXT.validation.filter.noMatches, "error");
      return;
    }

    if (!dataId) {
      showAlert(TEXT.mapping.mappingError, "error");
      return;
    }

    router.push(`/model?dataId=${dataId}`);
  };

  const backLink = "/upload";

  return (
    <>
      <Head>
        <title>{`${CONST.APP_DISPLAY_NAME} - Validation`}</title>
      </Head>
      <main className="content-page-container">
        <div className="max-w-4xl w-full px-2 sm:px-0">
          <GoBackButton href={backLink} text="Back to Upload" />

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
                Back to Upload
              </ActionButton>
            </div>
          ) : (
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
                          value={mapping[fieldKey as keyof MappingState] ?? ""}
                          onChange={(event) =>
                            handleMappingChange(
                              fieldKey as keyof MappingState,
                              event.target.value,
                            )
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
                                mapping[fieldKey as keyof MappingState] !==
                                  column && usedColumns.has(column)
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

                {CONFIG.SHOULD_SHOW_RAW_DATA_PREVIEW && (
                  <DataPreview
                    title={TEXT.mapping.rawPreviewTitle}
                    headers={availableColumns}
                    rows={rawPreviewRows}
                  />
                )}

                <div className="space-y-4">
                  <DataPreview
                    title={TEXT.mapping.mappedPreviewTitle}
                    description={TEXT.mapping.mappedPreviewDescription}
                    headers={mappedPreviewHeaders}
                    rows={mappedPreviewRows}
                    emptyMessage={previewEmptyMessage}
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

              <div className="card p-6 sm:p-8 space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-primary mb-2">
                    {TEXT.validation.filter.title}
                  </h2>
                  <p className="text-secondary">
                    {TEXT.validation.filter.description}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-sm font-medium text-secondary">
                    {TEXT.validation.filter.prompt}
                  </p>
                  <div className="inline-flex overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
                    <button
                      type="button"
                      className={`px-4 py-2 text-sm font-medium transition-colors focus:outline-none ${
                        isFilterEnabled
                          ? "bg-primary text-white"
                          : "bg-white text-gray-700 dark:bg-gray-900/40 dark:text-gray-200"
                      }`}
                      onClick={() => setIsFilterEnabled(true)}
                      aria-pressed={isFilterEnabled}
                    >
                      {TEXT.validation.filter.yes}
                    </button>
                    <button
                      type="button"
                      className={`px-4 py-2 text-sm font-medium transition-colors focus:outline-none ${
                        !isFilterEnabled
                          ? "bg-primary text-white"
                          : "bg-white text-gray-700 dark:bg-gray-900/40 dark:text-gray-200"
                      }`}
                      onClick={() => setIsFilterEnabled(false)}
                      aria-pressed={!isFilterEnabled}
                    >
                      {TEXT.validation.filter.no}
                    </button>
                  </div>
                </div>

                {isFilterEnabled ? (
                  <div className="space-y-4">
                    {filterConditions.map((condition, index) => (
                      <div key={index} className="grid gap-4 sm:grid-cols-12">
                        <div className="sm:col-span-5">
                          <label className="mb-1 block text-sm font-medium text-secondary">
                            {index === 0
                              ? TEXT.validation.filter.conditionALabel
                              : TEXT.validation.filter.conditionBLabel}
                          </label>
                          <select
                            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900/40 text-gray-900 dark:text-gray-100 p-2 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
                            value={condition.column}
                            onChange={(event) =>
                              updateFilterCondition(index, {
                                column: event.target.value,
                              })
                            }
                          >
                            <option value="">
                              {TEXT.validation.filter.selectColumn}
                            </option>
                            {availableColumns.map((column) => (
                              <option key={column} value={column}>
                                {column}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="sm:col-span-3">
                          <label className="mb-1 block text-sm font-medium text-secondary">
                            {TEXT.validation.filter.operatorLabel}
                          </label>
                          <select
                            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900/40 text-gray-900 dark:text-gray-100 p-2 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
                            value={condition.operator}
                            onChange={(event) =>
                              updateFilterCondition(index, {
                                operator: event.target.value as FilterOperator,
                              })
                            }
                          >
                            {FILTER_OPERATOR_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="sm:col-span-4">
                          <label className="mb-1 block text-sm font-medium text-secondary">
                            {TEXT.validation.filter.valueLabel}
                          </label>
                          <input
                            type="text"
                            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900/40 text-gray-900 dark:text-gray-100 p-2 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
                            value={condition.value}
                            onChange={(event) =>
                              updateFilterCondition(index, {
                                value: event.target.value,
                              })
                            }
                          />
                        </div>
                      </div>
                    ))}

                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="sm:w-48">
                        <label className="mb-1 block text-sm font-medium text-secondary">
                          {TEXT.validation.filter.joinerLabel}
                        </label>
                        <select
                          className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900/40 text-gray-900 dark:text-gray-100 p-2 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
                          value={filterJoiner}
                          onChange={(event) =>
                            setFilterJoiner(event.target.value as FilterJoiner)
                          }
                        >
                          <option value="AND">
                            {TEXT.validation.filter.joinerAnd}
                          </option>
                          <option value="OR">
                            {TEXT.validation.filter.joinerOr}
                          </option>
                        </select>
                      </div>
                      {totalRowCount > 0 && (
                        <p className="text-sm text-secondary">{rowsMatchingText}</p>
                      )}
                    </div>

                    {filterProducesNoRows && (
                      <Alert
                        type={CONST.ALERT_TYPES.ERROR}
                        message={TEXT.validation.filter.noMatches}
                      />
                    )}
                  </div>
                ) : (
                  totalRowCount > 0 && (
                    <p className="text-sm text-secondary">{rowsMatchingText}</p>
                  )
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
                  ref={continueButtonRef}
                  onClick={handleContinue}
                  variant="primary"
                  className="w-full"
                  disabled={isContinueDisabled}
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
