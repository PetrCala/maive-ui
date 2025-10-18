import type {
  DataArray,
  LegacySubsampleFilterState,
  SubsampleFilterCondition,
  SubsampleFilterConditionNode,
  SubsampleFilterGroupNode,
  SubsampleFilterJoiner,
  SubsampleFilterNode,
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
  {
    value: "greaterThanOrEqual",
    label: "Greater than or equal (≥)",
    symbol: "≥",
  },
  { value: "lessThan", label: "Less than (<)", symbol: "<" },
  { value: "lessThanOrEqual", label: "Less than or equal (≤)", symbol: "≤" },
];

export const DEFAULT_SUBSAMPLE_FILTER_OPERATOR: SubsampleFilterOperator =
  "equals";
export const DEFAULT_SUBSAMPLE_FILTER_JOINER: SubsampleFilterJoiner = "AND";

export const generateFilterNodeId = (): string => {
  return `filter-node-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
};

export const createEmptyCondition = (): SubsampleFilterConditionNode => ({
  id: generateFilterNodeId(),
  type: "condition",
  column: "",
  operator: DEFAULT_SUBSAMPLE_FILTER_OPERATOR,
  value: "",
});

export const createEmptyGroup = (
  children: SubsampleFilterNode[] = [createEmptyCondition()],
  joiner: SubsampleFilterJoiner = DEFAULT_SUBSAMPLE_FILTER_JOINER,
): SubsampleFilterGroupNode => ({
  id: generateFilterNodeId(),
  type: "group",
  joiner,
  children,
});

const cloneFilterNode = (node: SubsampleFilterNode): SubsampleFilterNode => {
  if (node.type === "condition") {
    return { ...node };
  }

  return {
    ...node,
    children: node.children.map((child) => cloneFilterNode(child)),
  };
};

export const cloneFilterGroup = (
  group: SubsampleFilterGroupNode,
): SubsampleFilterGroupNode => {
  return cloneFilterNode(group) as SubsampleFilterGroupNode;
};

export const isConditionComplete = (
  condition?: SubsampleFilterConditionNode | null,
): condition is SubsampleFilterConditionNode => {
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
  const canCompareNumerically = rowNumber !== null && conditionNumber !== null;

  switch (condition.operator) {
    case "equals":
      if (canCompareNumerically) {
        return rowNumber === conditionNumber;
      }
      return normalizeString(rowValue) === normalizeString(condition.value);
    case "notEquals":
      if (canCompareNumerically) {
        return rowNumber !== conditionNumber;
      }
      return normalizeString(rowValue) !== normalizeString(condition.value);
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

const evaluateNode = (
  row: Record<string, unknown>,
  node: SubsampleFilterNode,
): boolean => {
  if (node.type === "condition") {
    return evaluateCondition(row, node);
  }

  if (node.joiner === "AND") {
    return node.children.every((child) => evaluateNode(row, child));
  }

  return node.children.some((child) => evaluateNode(row, child));
};

const pruneNode = (node: SubsampleFilterNode): SubsampleFilterNode | null => {
  if (node.type === "condition") {
    return isConditionComplete(node) ? { ...node } : null;
  }

  const prunedChildren = node.children
    .map((child) => pruneNode(child))
    .filter((child): child is SubsampleFilterNode => Boolean(child));

  if (!prunedChildren.length) {
    return null;
  }

  return {
    ...node,
    children: prunedChildren,
  };
};

export const pruneFilterTree = (
  rootGroup: SubsampleFilterGroupNode,
): SubsampleFilterGroupNode | null => {
  const pruned = pruneNode(rootGroup);

  if (!pruned || pruned.type !== "group") {
    return null;
  }

  return pruned;
};

export const hasCompletedConditions = (
  rootGroup: SubsampleFilterGroupNode,
): boolean => {
  return Boolean(pruneFilterTree(rootGroup));
};

export const applySubsampleFilter = (
  rows: DataArray,
  rootGroup: SubsampleFilterGroupNode,
): DataArray => {
  const prunedRoot = pruneFilterTree(rootGroup);

  if (!prunedRoot) {
    return rows;
  }

  return rows.filter((row) => evaluateNode(row, prunedRoot));
};

export const getOperatorSymbol = (
  operator: SubsampleFilterOperator,
): string => {
  return (
    SUBSAMPLE_FILTER_OPERATORS.find((item) => item.value === operator)
      ?.symbol ?? "="
  );
};

export const formatCondition = (
  condition: SubsampleFilterCondition,
): string => {
  return `${condition.column} ${getOperatorSymbol(condition.operator)} ${condition.value}`;
};

const formatNode = (node: SubsampleFilterNode): string => {
  if (node.type === "condition") {
    return formatCondition(node);
  }

  if (node.children.length === 1) {
    return formatNode(node.children[0]);
  }

  const childrenSummary = node.children
    .map((child) => formatNode(child))
    .join(` ${node.joiner} `);

  return `(${childrenSummary})`;
};

export const formatFilterSummary = (
  filter?: SubsampleFilterState | null,
): string => {
  if (!filter?.isEnabled) {
    return "";
  }

  const pruned = pruneFilterTree(filter.rootGroup);

  if (!pruned) {
    return "";
  }

  return formatNode(pruned);
};

export const buildFilterState = (
  isEnabled: boolean,
  rootGroup: SubsampleFilterGroupNode,
  matchedRowCount: number,
  totalRowCount: number,
): SubsampleFilterState | null => {
  if (!isEnabled) {
    return null;
  }

  const prunedRoot = pruneFilterTree(rootGroup);

  if (!prunedRoot) {
    return null;
  }

  return {
    isEnabled: true,
    rootGroup: prunedRoot,
    matchedRowCount,
    totalRowCount,
  };
};

export const convertLegacyFilterState = (
  legacyState?: LegacySubsampleFilterState | null,
): SubsampleFilterState | null => {
  if (!legacyState) {
    return null;
  }

  const legacyGroup = createEmptyGroup(
    legacyState.conditions.map((condition) => ({
      ...condition,
      id: generateFilterNodeId(),
      type: "condition",
    })),
    legacyState.joiner,
  );

  const prunedRoot = pruneFilterTree(legacyGroup);

  if (!prunedRoot) {
    return null;
  }

  return {
    isEnabled: legacyState.isEnabled,
    rootGroup: prunedRoot,
    matchedRowCount: legacyState.matchedRowCount,
    totalRowCount: legacyState.totalRowCount,
  };
};

const isObject = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value) && typeof value === "object";
};

export const isLegacyFilterState = (
  filter: unknown,
): filter is LegacySubsampleFilterState => {
  return (
    isObject(filter) &&
    Array.isArray((filter as { conditions?: unknown }).conditions)
  );
};

export const isModernFilterState = (
  filter: unknown,
): filter is SubsampleFilterState => {
  return isObject(filter) && "rootGroup" in filter;
};

export const normalizeFilterState = (
  filter: unknown,
): SubsampleFilterState | null => {
  if (!filter) {
    return null;
  }

  if (isModernFilterState(filter)) {
    return filter;
  }

  if (isLegacyFilterState(filter)) {
    return convertLegacyFilterState(filter);
  }

  return null;
};

const defaultNumberFormatter = new Intl.NumberFormat();

export const formatFilterRowSummary = (
  filter?: SubsampleFilterState | null,
  formatter: Intl.NumberFormat = defaultNumberFormatter,
): string => {
  if (!filter?.isEnabled) {
    return "";
  }

  const { matchedRowCount, totalRowCount } = filter;

  if (
    typeof matchedRowCount !== "number" ||
    typeof totalRowCount !== "number" ||
    totalRowCount < 0
  ) {
    return "";
  }

  if (totalRowCount === 0) {
    return `${formatter.format(0)} / ${formatter.format(0)} (0.0%)`;
  }

  const percentage = Math.round((matchedRowCount / totalRowCount) * 1000) / 10;
  return `${formatter.format(matchedRowCount)} / ${formatter.format(totalRowCount)} (${percentage.toFixed(1)}%)`;
};
