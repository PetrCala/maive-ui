import React, { useState, useMemo } from "react";
import OptionRenderer from "@src/components/Options/OptionRenderer";
import type { OptionSectionConfig, OptionContext } from "@src/types/options";
import type { ModelParameters } from "@src/types/api";
import {
  filterVisibleOptions,
  shouldShowOption,
} from "@src/utils/optionVisibility";
import {
  DEFAULT_MODEL_PARAMETERS,
  ADVANCED_OPTION_KEYS,
} from "@src/constants/defaultParameters";

type OptionSectionProps = {
  config: OptionSectionConfig;
  parameters: ModelParameters;
  onChange: (key: keyof ModelParameters, value: string | boolean) => void;
  tooltipsEnabled?: boolean;
  context?: Partial<OptionContext>;
};

export default function OptionSection({
  config,
  parameters,
  onChange,
  tooltipsEnabled = true,
  context = {},
}: OptionSectionProps) {
  // Determine initial open state: open if advanced options changed, otherwise use config default
  const initialOpenState = useMemo(() => {
    if (config.title === "Advanced Options") {
      // Check if any advanced options differ from defaults (only evaluated once)
      const hasAdvancedOptionsChanged = ADVANCED_OPTION_KEYS.some(
        (key) => parameters[key] !== DEFAULT_MODEL_PARAMETERS[key],
      );
      return hasAdvancedOptionsChanged;
    }
    return config.defaultOpen ?? true;
  }, [config.title, config.defaultOpen, parameters]);

  const [isOpen, setIsOpen] = useState(initialOpenState);

  const fullContext: OptionContext = {
    parameters,
    ...context,
  };

  if (config.visibility && !shouldShowOption(config.visibility, fullContext)) {
    return null;
  }

  const visibleOptions = filterVisibleOptions(config.options, fullContext);

  if (visibleOptions.length === 0) {
    return null;
  }

  const toggleOpen = () => {
    if (config.collapsible) {
      setIsOpen((prev) => !prev);
    }
  };

  const renderOptions = () => (
    <div className="flex flex-col gap-6">
      {visibleOptions.map((option) => (
        <OptionRenderer
          key={option.key}
          option={option}
          value={parameters[option.key]}
          parameters={parameters}
          onChange={onChange}
          tooltipsEnabled={tooltipsEnabled}
        />
      ))}
      {config.bottomText && (
        <div className="text-sm text-gray-600 dark:text-gray-400 pt-4 border-t border-gray-200 dark:border-gray-700">
          {config.bottomText}
        </div>
      )}
    </div>
  );

  if (!config.collapsible) {
    return <div className="space-y-6">{renderOptions()}</div>;
  }

  return (
    <div className="border-t border-gray-200 dark:border-gray-700 pt-6 mt-6">
      <button
        onClick={toggleOpen}
        className="flex items-center text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-semibold focus:outline-none transition-colors duration-200"
        aria-expanded={isOpen}
      >
        <span className="mr-2">{config.title}</span>
        <svg
          className={`w-4 h-4 transform transition-transform duration-200 ${
            isOpen ? "rotate-90" : "rotate-0"
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
          />
        </svg>
      </button>
      {isOpen && <div className="mt-4 space-y-6">{renderOptions()}</div>}
    </div>
  );
}
