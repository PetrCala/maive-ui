import type {
  DataArray,
  SubsampleFilterCondition,
  SubsampleFilterJoiner,
  SubsampleFilterOperator,
  SubsampleFilterState,
} from "@src/types";

const parseNumeric = (value: unknown): number | null => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "number") {
    return Number.isNaN(value) ? null : value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") {
      return null;
    }

    const parsed = Number(trimmed);
    return Number.isNaN(parsed) ? null : parsed;
  }

  return null;
};

const normalizeString = (value: unknown): string | null => {
  if (value === null || value === undefined) {
    return null;
  }

  return String(value).trim().toLowerCase();
};

export const SUBSAMPLE_FILTER_OPERATORS: Array<{
  value: SubsampleFilterOperator;
  label: string;
  symbol: string;
}> = [
  { value: "equals", label: "Equals (=)", symbol: "=" },
  { value: "notEquals", label: "Does not equal (≠)", symbol: "≠" },
  { value: "greaterThan", label: "Greater than (>)", symbol: ">" },
  { value: "greaterThanOrEqual", label: "Greater than or equal (≥)", symbol: "≥" },
  { value: "lessThan", label: "Less than (<)", symbol: "<" },
  { value: "lessThanOrEqual", label: "Less than or equal (≤)", symbol: "≤" },
];

export const DEFAULT_SUBSAMPLE_FILTER_OPERATOR: SubsampleFilterOperator = "equals";
export const DEFAULT_SUBSAMPLE_FILTER_JOINER: SubsampleFilterJoiner = "AND";

export const createEmptyCondition = (): SubsampleFilterCondition => ({
  column: "",
  operator: DEFAULT_SUBSAMPLE_FILTER_OPERATOR,
  value: "",
});

export const isConditionComplete = (
  condition?: SubsampleFilterCondition | null,
): condition is SubsampleFilterCondition => {
  if (!condition) {
    return false;
  }

  return Boolean(condition.column && condition.value.trim() !== "");
};

const evaluateCondition = (
  row: Record<string, unknown>,
  condition: SubsampleFilterCondition,
): boolean => {
  const rowValue = row[condition.column];
  if (rowValue === undefined || rowValue === null) {
    return false;
  }

  const rowNumber = parseNumeric(rowValue);
  const conditionNumber = parseNumeric(condition.value);
  const canCompareNumerically =
    rowNumber !== null && conditionNumber !== null;

  switch (condition.operator) {
    case "equals":
      if (canCompareNumerically) {
        return rowNumber === conditionNumber;
      }
      return (
        normalizeString(rowValue) === normalizeString(condition.value)
      );
    case "notEquals":
      if (canCompareNumerically) {
        return rowNumber !== conditionNumber;
      }
      return (
        normalizeString(rowValue) !== normalizeString(condition.value)
      );
    case "greaterThan":
      if (!canCompareNumerically) {
        return false;
      }
      return rowNumber > conditionNumber;
    case "greaterThanOrEqual":
      if (!canCompareNumerically) {
        return false;
      }
      return rowNumber >= conditionNumber;
    case "lessThan":
      if (!canCompareNumerically) {
        return false;
      }
      return rowNumber < conditionNumber;
    case "lessThanOrEqual":
      if (!canCompareNumerically) {
        return false;
      }
      return rowNumber <= conditionNumber;
    default:
      return false;
  }
};

export const applySubsampleFilter = (
  rows: DataArray,
  conditions: SubsampleFilterCondition[],
  joiner: SubsampleFilterJoiner,
): DataArray => {
  const validConditions = conditions.filter((condition) =>
    isConditionComplete(condition),
  );

  if (validConditions.length === 0) {
    return rows;
  }

  if (validConditions.length === 1) {
    const [condition] = validConditions;
    return rows.filter((row) => evaluateCondition(row, condition));
  }

  if (joiner === "AND") {
    return rows.filter((row) =>
      validConditions.every((condition) => evaluateCondition(row, condition)),
    );
  }

  return rows.filter((row) =>
    validConditions.some((condition) => evaluateCondition(row, condition)),
  );
};

export const getOperatorSymbol = (
  operator: SubsampleFilterOperator,
): string => {
  return (
    SUBSAMPLE_FILTER_OPERATORS.find((item) => item.value === operator)?.symbol ??
    "="
  );
};

export const formatCondition = (
  condition: SubsampleFilterCondition,
): string => {
  return `${condition.column} ${getOperatorSymbol(condition.operator)} ${condition.value}`;
};

export const formatFilterSummary = (
  filter: SubsampleFilterState,
): string => {
  if (!filter.conditions.length) {
    return "";
  }

  const formattedConditions = filter.conditions.map((condition) =>
    formatCondition(condition),
  );

  return formattedConditions.join(` ${filter.joiner} `);
};

export const buildFilterState = (
  isEnabled: boolean,
  conditions: SubsampleFilterCondition[],
  joiner: SubsampleFilterJoiner,
  matchedRowCount: number,
  totalRowCount: number,
): SubsampleFilterState | null => {
  if (!isEnabled) {
    return null;
  }

  const validConditions = conditions.filter((condition) =>
    isConditionComplete(condition),
  );

  if (!validConditions.length) {
    return null;
  }

  return {
    isEnabled: true,
    conditions: validConditions,
    joiner,
    matchedRowCount,
    totalRowCount,
  };
};
