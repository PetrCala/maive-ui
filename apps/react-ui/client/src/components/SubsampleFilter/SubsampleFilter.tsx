import type { ReactNode } from "react";
import { FaFilter } from "react-icons/fa";

import TEXT from "@src/lib/text";
import type {
  SubsampleFilterCondition,
  SubsampleFilterJoiner,
} from "@src/types";
import {
  SUBSAMPLE_FILTER_OPERATORS,
  createEmptyCondition,
} from "@src/utils/subsampleFilterUtils";

type SubsampleFilterProps = {
  isEnabled: boolean;
  onToggle: (enabled: boolean) => void;
  columns: string[];
  primaryCondition: SubsampleFilterCondition;
  onPrimaryChange: (condition: SubsampleFilterCondition) => void;
  secondaryCondition: SubsampleFilterCondition;
  onSecondaryChange: (condition: SubsampleFilterCondition) => void;
  isSecondaryEnabled: boolean;
  onSecondaryToggle: (enabled: boolean) => void;
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
      <span className="text-sm font-medium text-secondary">{label}</span>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <select
          className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900/40 text-gray-900 dark:text-gray-100 p-2 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
          value={condition.column}
          onChange={(event) => handleFieldChange("column", event.target.value)}
        >
          <option value="">{TEXT.validation.subsampleFilter.selectColumn}</option>
          {columns.map((column) => (
            <option key={column} value={column}>
              {column}
            </option>
          ))}
        </select>

        <select
          className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900/40 text-gray-900 dark:text-gray-100 p-2 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
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
          className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900/40 text-gray-900 dark:text-gray-100 p-2 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
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
      className={`px-4 py-2 text-sm font-medium transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary ${active ? "bg-primary text-white" : "bg-gray-100 dark:bg-gray-800 text-secondary hover:bg-gray-200 dark:hover:bg-gray-700"}`}
    >
      {children}
    </button>
  );
};

export default function SubsampleFilter({
  isEnabled,
  onToggle,
  columns,
  primaryCondition,
  onPrimaryChange,
  secondaryCondition,
  onSecondaryChange,
  isSecondaryEnabled,
  onSecondaryToggle,
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
          <ToggleButton
            active={isEnabled}
            onClick={() => onToggle(true)}
          >
            {TEXT.validation.subsampleFilter.enableLabel}
          </ToggleButton>
          <ToggleButton
            active={!isEnabled}
            onClick={() => {
              onToggle(false);
              onSecondaryToggle(false);
              onSecondaryChange(createEmptyCondition());
            }}
          >
            {TEXT.validation.subsampleFilter.disableLabel}
          </ToggleButton>
        </div>
      </div>

      {isEnabled && (
        <div className="space-y-4">
          <ConditionFields
            label={TEXT.validation.subsampleFilter.conditionALabel}
            condition={primaryCondition}
            onChange={onPrimaryChange}
            columns={columns}
          />

          <div className="space-y-3">
            {isSecondaryEnabled ? (
              <ConditionFields
                label={TEXT.validation.subsampleFilter.conditionBLabel}
                condition={secondaryCondition}
                onChange={onSecondaryChange}
                columns={columns}
              />
            ) : null}

            <div className="flex flex-wrap items-center gap-3">
              {isSecondaryEnabled ? (
                <>
                  <label className="text-sm font-medium text-secondary">
                    {TEXT.validation.subsampleFilter.joinerLabel}
                  </label>
                  <select
                    className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900/40 text-gray-900 dark:text-gray-100 p-2 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
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
              ) : null}

              <button
                type="button"
                onClick={() => {
                  if (isSecondaryEnabled) {
                    onSecondaryToggle(false);
                    onSecondaryChange(createEmptyCondition());
                  } else {
                    onSecondaryToggle(true);
                  }
                }}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-gray-200 dark:border-gray-700 text-secondary hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                {isSecondaryEnabled
                  ? TEXT.validation.subsampleFilter.removeCondition
                  : TEXT.validation.subsampleFilter.addCondition}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-lg bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 p-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-secondary">
            {TEXT.validation.subsampleFilter.rowsMatchingLabel}
          </span>
          <span className="text-sm font-semibold text-primary">
            {matchedSummary}
          </span>
        </div>
        {statusMessage ? (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            {statusMessage}
          </p>
        ) : null}
      </div>
    </div>
  );
}
