export type FilterOperator =
  | "equals"
  | "notEquals"
  | "greaterThan"
  | "greaterThanOrEqual"
  | "lessThan"
  | "lessThanOrEqual";

export type FilterJoiner = "AND" | "OR";

export type SubsampleFilterCondition = {
  column: string;
  operator: FilterOperator;
  value: string;
};

export type SubsampleFilter = {
  enabled: boolean;
  joiner: FilterJoiner;
  conditions: SubsampleFilterCondition[];
  totalRowCount: number;
  matchingRowCount: number;
};
