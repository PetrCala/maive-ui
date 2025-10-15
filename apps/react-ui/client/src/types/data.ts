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

type SubsampleFilterConditionNode = SubsampleFilterCondition & {
  id: string;
  type: "condition";
};

type SubsampleFilterGroupNode = {
  id: string;
  type: "group";
  joiner: SubsampleFilterJoiner;
  children: SubsampleFilterNode[];
};

type SubsampleFilterNode =
  | SubsampleFilterConditionNode
  | SubsampleFilterGroupNode;

type SubsampleFilterState = {
  isEnabled: boolean;
  rootGroup: SubsampleFilterGroupNode;
  matchedRowCount: number;
  totalRowCount: number;
};

type LegacySubsampleFilterState = {
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
  SubsampleFilterConditionNode,
  SubsampleFilterGroupNode,
  SubsampleFilterJoiner,
  SubsampleFilterNode,
  SubsampleFilterOperator,
  LegacySubsampleFilterState,
  SubsampleFilterState,
};
