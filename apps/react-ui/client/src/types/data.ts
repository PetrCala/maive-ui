type DataArray = Array<Record<string, unknown>>;

type SubsampleFilterOperator =
  | "equals"
  | "notEquals"
  | "greaterThan"
  | "greaterThanOrEqual"
  | "lessThan"
  | "lessThanOrEqual";

type SubsampleFilterCondition = {
  column: string;
  operator: SubsampleFilterOperator;
  value: string;
};

type SubsampleFilterJoiner = "AND" | "OR";

/**
 * Represents the state of a subsample filter
 * Conditions are evaluated left-to-right with the specified joiner
 * Example: [A, B, C] with joiner "AND" means (A AND B AND C)
 * Example: [A, B, C] with joiner "OR" means (A OR B OR C)
 */
type SubsampleFilterState = {
  isEnabled: boolean;
  conditions: SubsampleFilterCondition[];
  joiner: SubsampleFilterJoiner;
  matchedRowCount: number;
  totalRowCount: number;
};

type DataInfo = {
  filename: string;
  rowCount: number;
  hasStudyId: boolean;
  studyCount?: number;
  medianObservationsPerStudy?: number;
};

export default DataArray;
export type {
  DataInfo,
  SubsampleFilterCondition,
  SubsampleFilterJoiner,
  SubsampleFilterOperator,
  SubsampleFilterState,
};
