import type { ReactNode } from "react";
import { FaFilter, FaTimes } from "react-icons/fa";

import TEXT from "@src/lib/text";
import type {
  SubsampleFilterCondition,
  SubsampleFilterJoiner,
} from "@src/types";
import {
  SUBSAMPLE_FILTER_OPERATORS,
  createEmptyCondition,
} from "@src/utils/subsampleFilterUtils";
import {
  INPUT_FIELD_CLASSES,
  getToggleButtonClasses,
  SECONDARY_BUTTON_CLASSES,
  LABEL_CLASSES,
} from "@src/styles/formStyles";

type SubsampleFilterProps = {
  isEnabled: boolean;
  onToggle: (enabled: boolean) => void;
  columns: string[];
  conditions: SubsampleFilterCondition[];
  onConditionsChange: (conditions: SubsampleFilterCondition[]) => void;
  joiner: SubsampleFilterJoiner;
  onJoinerChange: (joiner: SubsampleFilterJoiner) => void;
  matchedRowCount: number | null;
  totalRowCount: number;
  statusMessage?: string;
};

const numberFormatter = new Intl.NumberFormat();

const ConditionFields = ({
  label,
  condition,
  onChange,
  columns,
}: {
  label: string;
  condition: SubsampleFilterCondition;
  onChange: (condition: SubsampleFilterCondition) => void;
  columns: string[];
}) => {
  const handleFieldChange = (
    field: keyof SubsampleFilterCondition,
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <select
          className={INPUT_FIELD_CLASSES}
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

const ToggleButton = ({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={getToggleButtonClasses(active)}
    >
      {children}
    </button>
  );
};

export default function SubsampleFilter({
  isEnabled,
  onToggle,
  columns,
  conditions,
  onConditionsChange,
  joiner,
  onJoinerChange,
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

  const handleAddCondition = () => {
    onConditionsChange([...conditions, createEmptyCondition()]);
  };

  const handleRemoveCondition = (index: number) => {
    const newConditions = conditions.filter((_, i) => i !== index);
    // Ensure at least one condition remains
    if (newConditions.length === 0) {
      onConditionsChange([createEmptyCondition()]);
    } else {
      onConditionsChange(newConditions);
    }
  };

  const handleConditionChange = (
    index: number,
    condition: SubsampleFilterCondition,
  ) => {
    const newConditions = [...conditions];
    newConditions[index] = condition;
    onConditionsChange(newConditions);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-full bg-primary/10 text-primary">
          <FaFilter className="w-4 h-4" />
        </div>
        <div className="flex-1 space-y-1">
          <h3 className="text-lg font-semibold text-primary">
            {TEXT.validation.subsampleFilter.title}
          </h3>
          <p className="text-secondary text-sm">
            {TEXT.validation.subsampleFilter.description}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-secondary">
          {TEXT.validation.subsampleFilter.toggleLabel}
        </span>
        <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <ToggleButton active={isEnabled} onClick={() => onToggle(true)}>
            {TEXT.validation.subsampleFilter.enableLabel}
          </ToggleButton>
          <ToggleButton
            active={!isEnabled}
            onClick={() => {
              onToggle(false);
              // Reset to single empty condition when disabling
              onConditionsChange([createEmptyCondition()]);
            }}
          >
            {TEXT.validation.subsampleFilter.disableLabel}
          </ToggleButton>
        </div>
      </div>

      {isEnabled && (
        <div className="space-y-4">
          {conditions.map((condition, index) => (
            <div key={`condition-${index}`} className="space-y-3">
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <ConditionFields
                    label={`Condition ${index + 1}`}
                    condition={condition}
                    onChange={(newCondition) =>
                      handleConditionChange(index, newCondition)
                    }
                    columns={columns}
                  />
                </div>
                {conditions.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveCondition(index)}
                    className="mt-7 p-2 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    title="Remove condition"
                  >
                    <FaTimes className="w-4 h-4" />
                  </button>
                )}
              </div>

              {index < conditions.length - 1 && (
                <div className="flex items-center justify-center">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-800">
                    <span className="text-xs font-semibold text-secondary">
                      {joiner}
                    </span>
                  </div>
                </div>
              )}
            </div>
          ))}

          <div className="flex flex-wrap items-center gap-3">
            {conditions.length > 1 && (
              <>
                <label className={LABEL_CLASSES}>
                  {TEXT.validation.subsampleFilter.joinerLabel}
                </label>
                <select
                  className={INPUT_FIELD_CLASSES}
                  value={joiner}
                  onChange={(event) =>
                    onJoinerChange(event.target.value as SubsampleFilterJoiner)
                  }
                >
                  <option value="AND">
                    {TEXT.validation.subsampleFilter.joinerAnd}
                  </option>
                  <option value="OR">
                    {TEXT.validation.subsampleFilter.joinerOr}
                  </option>
                </select>
              </>
            )}

            <button
              type="button"
              onClick={handleAddCondition}
              className={SECONDARY_BUTTON_CLASSES}
            >
              Add Condition {conditions.length + 1}
            </button>
          </div>
        </div>
      )}

      {isEnabled && (
        <div className="rounded-lg bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 p-4 space-y-2">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm font-medium text-secondary">
              {TEXT.validation.subsampleFilter.rowsMatchingLabel}
            </span>
            <span className="flex min-h-[2.5rem] items-center text-sm font-semibold text-primary text-right">
              {matchedSummary}
            </span>
          </div>
          {statusMessage ? (
            <p className="text-xs text-primary-600 dark:text-primary-300">
              {statusMessage}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
