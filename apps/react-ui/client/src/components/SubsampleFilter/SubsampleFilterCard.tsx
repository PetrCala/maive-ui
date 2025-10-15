import SubsampleFilter from "./SubsampleFilter";
import type { SubsampleFilterGroupNode } from "@src/types";

type SubsampleFilterCardProps = {
  isEnabled: boolean;
  onToggle: (enabled: boolean) => void;
  columns: string[];
  rootGroup: SubsampleFilterGroupNode;
  onRootGroupChange: (group: SubsampleFilterGroupNode) => void;
  matchedRowCount: number | null;
  totalRowCount: number;
  statusMessage?: string;
};

/**
 * SubsampleFilterCard - A drop-in card component wrapper for SubsampleFilter
 *
 * This component wraps the SubsampleFilter with card styling, making it easy
 * to add to any page in the application. Simply include this component and
 * pass the required props.
 *
 * @example
 * ```tsx
 * <SubsampleFilterCard
 *   isEnabled={isFilterEnabled}
 *   onToggle={handleFilterToggle}
 *   columns={availableColumns}
 *   rootGroup={filterTree}
 *   onRootGroupChange={setFilterTree}
 *   matchedRowCount={matchedRowCount}
 *   totalRowCount={totalRowCount}
 * />
 * ```
 */
export default function SubsampleFilterCard(props: SubsampleFilterCardProps) {
  return (
    <div className="card p-6 sm:p-8 space-y-6">
      <SubsampleFilter {...props} />
    </div>
  );
}
