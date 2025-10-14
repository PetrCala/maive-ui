import type {
  FilterJoiner,
  FilterOperator,
  SubsampleFilterCondition,
} from "@src/types";

export const FILTER_OPERATOR_OPTIONS: Array<{
  value: FilterOperator;
  label: string;
  symbol: string;
}> = [
  { value: "equals", label: "Equals", symbol: "==" },
  { value: "notEquals", label: "Does not equal", symbol: "!=" },
  { value: "greaterThan", label: "Greater than", symbol: ">" },
  { value: "greaterThanOrEqual", label: "Greater than or equal", symbol: ">=" },
  { value: "lessThan", label: "Less than", symbol: "<" },
  { value: "lessThanOrEqual", label: "Less than or equal", symbol: "<=" },
];

const getOperatorOption = (operator: FilterOperator) =>
  FILTER_OPERATOR_OPTIONS.find((option) => option.value === operator);

export const getOperatorSymbol = (operator: FilterOperator): string => {
  return getOperatorOption(operator)?.symbol ?? "=";
};

const formatConditionValue = (value: string): string => {
  const trimmed = value.trim();

  if (trimmed === "") {
    return '""';
  }

  const numericValue = Number(trimmed);
  if (!Number.isNaN(numericValue)) {
    return trimmed;
  }

  if (/^(true|false)$/i.test(trimmed)) {
    return trimmed.toLowerCase();
  }

  if (/^".*"$|^'.*'$/.test(trimmed)) {
    return trimmed;
  }

  if (/^[\w.-]+$/.test(trimmed)) {
    return trimmed;
  }

  return `"${trimmed}"`;
};

export const formatFilterCondition = (
  condition: SubsampleFilterCondition,
): string => {
  const symbol = getOperatorSymbol(condition.operator);
  return `${condition.column} ${symbol} ${formatConditionValue(condition.value)}`;
};

export const formatFilterSummary = (
  conditions: SubsampleFilterCondition[],
  joiner: FilterJoiner,
): string => {
  if (!conditions.length) {
    return "";
  }

  return conditions.map(formatFilterCondition).join(` ${joiner} `);
};
