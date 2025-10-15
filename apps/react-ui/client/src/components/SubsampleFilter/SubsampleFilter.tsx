import type { ReactNode } from "react";
import {
  FaArrowDown,
  FaArrowUp,
  FaFilter,
  FaPlusCircle,
  FaTimes,
} from "react-icons/fa";

import SectionHeading from "@src/components/SectionHeading";
import TEXT from "@src/lib/text";
import type {
  SubsampleFilterConditionNode,
  SubsampleFilterGroupNode,
  SubsampleFilterJoiner,
  SubsampleFilterNode,
} from "@src/types";
import {
  SUBSAMPLE_FILTER_OPERATORS,
  createEmptyCondition,
  createEmptyGroup,
} from "@src/utils/subsampleFilterUtils";
import {
  INPUT_FIELD_CLASSES,
  LABEL_CLASSES,
  SECONDARY_BUTTON_CLASSES,
  getToggleButtonClasses,
} from "@src/styles/formStyles";

type SubsampleFilterProps = {
  isEnabled: boolean;
  onToggle: (enabled: boolean) => void;
  columns: string[];
  rootGroup: SubsampleFilterGroupNode;
  onRootGroupChange: (group: SubsampleFilterGroupNode) => void;
  matchedRowCount: number | null;
  totalRowCount: number;
  statusMessage?: string;
};

const numberFormatter = new Intl.NumberFormat();

const iconButtonBaseClasses =
  "inline-flex items-center justify-center rounded-md border border-transparent bg-transparent p-2 text-secondary transition-colors hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-40 disabled:hover:text-secondary";

const ToggleButton = ({
  active,
  children,
  onClick,
  ariaLabel,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
  ariaLabel: string;
}) => {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      className={getToggleButtonClasses(active)}
    >
      {children}
    </button>
  );
};

const ConditionFields = ({
  label,
  condition,
  onChange,
  columns,
}: {
  label: string;
  condition: SubsampleFilterConditionNode;
  onChange: (condition: SubsampleFilterConditionNode) => void;
  columns: string[];
}) => {
  const handleFieldChange = (
    field: "column" | "operator" | "value",
    value: string,
  ) => {
    onChange({
      ...condition,
      [field]: value,
    });
  };

  return (
    <div className="space-y-2">
      <label className={LABEL_CLASSES}>{label}</label>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <select
          className={`${INPUT_FIELD_CLASSES} ${
            condition.column ? "" : "text-secondary"
          }`}
          value={condition.column}
          onChange={(event) => handleFieldChange("column", event.target.value)}
        >
          <option value="">
            {TEXT.validation.subsampleFilter.selectColumn}
          </option>
          {columns.map((column) => (
            <option key={column} value={column}>
              {column}
            </option>
          ))}
        </select>

        <select
          className={INPUT_FIELD_CLASSES}
          value={condition.operator}
          onChange={(event) =>
            handleFieldChange("operator", event.target.value)
          }
        >
          {SUBSAMPLE_FILTER_OPERATORS.map((operator) => (
            <option key={operator.value} value={operator.value}>
              {operator.label}
            </option>
          ))}
        </select>

        <input
          className={INPUT_FIELD_CLASSES}
          value={condition.value}
          onChange={(event) => handleFieldChange("value", event.target.value)}
          placeholder={TEXT.validation.subsampleFilter.valuePlaceholder}
        />
      </div>
    </div>
  );
};

type GroupEditorProps = {
  group: SubsampleFilterGroupNode;
  columns: string[];
  onChange: (group: SubsampleFilterGroupNode) => void;
  onRemove?: () => void;
  isRoot?: boolean;
};

const GroupEditor = ({
  group,
  columns,
  onChange,
  onRemove,
  isRoot = false,
}: GroupEditorProps) => {
  const handleJoinerChange = (joiner: SubsampleFilterJoiner) => {
    if (joiner === group.joiner) {
      return;
    }

    onChange({
      ...group,
      joiner,
    });
  };

  const handleChildChange = (index: number, child: SubsampleFilterNode) => {
    const nextChildren = group.children.map((existing, childIndex) =>
      childIndex === index ? child : existing,
    );

    onChange({
      ...group,
      children: nextChildren,
    });
  };

  const handleRemoveChild = (index: number) => {
    const nextChildren = group.children.filter((_, childIndex) =>
      childIndex !== index
    );

    if (nextChildren.length === 0) {
      if (isRoot) {
        onChange({
          ...group,
          children: [createEmptyCondition()],
        });
      } else if (onRemove) {
        onRemove();
      } else {
        onChange({
          ...group,
          children: [createEmptyCondition()],
        });
      }

      return;
    }

    onChange({
      ...group,
      children: nextChildren,
    });
  };

  const handleMoveChild = (index: number, direction: number) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= group.children.length) {
      return;
    }

    const nextChildren = [...group.children];
    const [removed] = nextChildren.splice(index, 1);
    nextChildren.splice(targetIndex, 0, removed);

    onChange({
      ...group,
      children: nextChildren,
    });
  };

  const handleAddCondition = () => {
    onChange({
      ...group,
      children: [...group.children, createEmptyCondition()],
    });
  };

  const handleAddGroup = () => {
    onChange({
      ...group,
      children: [...group.children, createEmptyGroup()],
    });
  };

  return (
    <div
      className={
        isRoot
          ? "space-y-4"
          : "space-y-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900/40"
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-secondary">
            {TEXT.validation.subsampleFilter.joinerLabel}
          </span>
          <div className="inline-flex overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
            <ToggleButton
              active={group.joiner === "AND"}
              onClick={() => handleJoinerChange("AND")}
              ariaLabel={TEXT.validation.subsampleFilter.joinerAnd}
            >
              {TEXT.validation.subsampleFilter.joinerAnd}
            </ToggleButton>
            <ToggleButton
              active={group.joiner === "OR"}
              onClick={() => handleJoinerChange("OR")}
              ariaLabel={TEXT.validation.subsampleFilter.joinerOr}
            >
              {TEXT.validation.subsampleFilter.joinerOr}
            </ToggleButton>
          </div>
        </div>
        {!isRoot && onRemove ? (
          <button
            type="button"
            className={`${iconButtonBaseClasses} text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300`}
            onClick={onRemove}
            aria-label={TEXT.validation.subsampleFilter.removeGroup}
          >
            <FaTimes className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <div className="space-y-4">
        {group.children.map((child, index) => {
          const isLast = index === group.children.length - 1;
          const conditionLabel = `${TEXT.validation.subsampleFilter.conditionLabel} ${
            index + 1
          }`;

          return (
            <div key={child.id} className="space-y-3">
              <div className="rounded-lg border border-dashed border-gray-200 p-4 dark:border-gray-700">
                {child.type === "condition" ? (
                  <ConditionFields
                    label={conditionLabel}
                    condition={child}
                    columns={columns}
                    onChange={(updatedCondition) =>
                      handleChildChange(index, updatedCondition)
                    }
                  />
                ) : (
                  <GroupEditor
                    group={child}
                    columns={columns}
                    onChange={(updatedGroup) =>
                      handleChildChange(index, updatedGroup)
                    }
                    onRemove={() => handleRemoveChild(index)}
                  />
                )}
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className={iconButtonBaseClasses}
                    disabled={index === 0}
                    onClick={() => handleMoveChild(index, -1)}
                    aria-label={TEXT.validation.subsampleFilter.moveItemUp}
                  >
                    <FaArrowUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className={iconButtonBaseClasses}
                    disabled={isLast}
                    onClick={() => handleMoveChild(index, 1)}
                    aria-label={TEXT.validation.subsampleFilter.moveItemDown}
                  >
                    <FaArrowDown className="h-4 w-4" />
                  </button>
                </div>

                {child.type === "condition" ? (
                  <button
                    type="button"
                    className={`${iconButtonBaseClasses} text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300`}
                    onClick={() => handleRemoveChild(index)}
                    aria-label={TEXT.validation.subsampleFilter.removeCondition}
                  >
                    <FaTimes className="h-4 w-4" />
                  </button>
                ) : null}
              </div>

              {!isLast ? (
                <div className="flex justify-center">
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-secondary dark:bg-gray-800">
                    {group.joiner}
                  </span>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <button
          type="button"
          onClick={handleAddCondition}
          className={`${SECONDARY_BUTTON_CLASSES} flex items-center gap-2`}
        >
          <FaPlusCircle className="h-4 w-4" />
          {TEXT.validation.subsampleFilter.addCondition}
        </button>
        <button
          type="button"
          onClick={handleAddGroup}
          className={`${SECONDARY_BUTTON_CLASSES} flex items-center gap-2`}
        >
          <FaPlusCircle className="h-4 w-4" />
          {TEXT.validation.subsampleFilter.addGroup}
        </button>
      </div>
    </div>
  );
};

export default function SubsampleFilter({
  isEnabled,
  onToggle,
  columns,
  rootGroup,
  onRootGroupChange,
  matchedRowCount,
  totalRowCount,
  statusMessage,
}: SubsampleFilterProps) {
  const matchedSummary = (() => {
    if (!isEnabled) {
      return `${numberFormatter.format(totalRowCount)} / ${numberFormatter.format(totalRowCount)} (100%)`;
    }

    if (matchedRowCount === null) {
      return TEXT.validation.subsampleFilter.unavailableMatches;
    }

    const percentage = totalRowCount
      ? Math.round((matchedRowCount / totalRowCount) * 1000) / 10
      : 0;

    return `${numberFormatter.format(matchedRowCount)} / ${numberFormatter.format(totalRowCount)} (${percentage.toFixed(1)}%)`;
  })();

  return (
    <div className="space-y-4">
      <SectionHeading
        level="h2"
        text={TEXT.validation.subsampleFilter.title}
        icon={<FaFilter />}
        description={TEXT.validation.subsampleFilter.description}
      />

      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-secondary">
          {TEXT.validation.subsampleFilter.toggleLabel}
        </span>
        <div className="inline-flex overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
          <ToggleButton
            active={isEnabled}
            onClick={() => onToggle(true)}
            ariaLabel={TEXT.validation.subsampleFilter.enableLabel}
          >
            {TEXT.validation.subsampleFilter.enableLabel}
          </ToggleButton>
          <ToggleButton
            active={!isEnabled}
            onClick={() => {
              onToggle(false);
              onRootGroupChange(createEmptyGroup());
            }}
            ariaLabel={TEXT.validation.subsampleFilter.disableLabel}
          >
            {TEXT.validation.subsampleFilter.disableLabel}
          </ToggleButton>
        </div>
      </div>

      {isEnabled ? (
        <GroupEditor
          group={rootGroup}
          columns={columns}
          onChange={onRootGroupChange}
          isRoot
        />
      ) : null}

      {isEnabled ? (
        <div className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/40">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm font-medium text-secondary">
              {TEXT.validation.subsampleFilter.rowsMatchingLabel}
            </span>
            <span className="flex items-center justify-end text-right text-sm font-semibold text-primary">
              {matchedSummary}
            </span>
          </div>
          {statusMessage ? (
            <p className="text-xs text-primary-600 dark:text-primary-300">
              {statusMessage}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

