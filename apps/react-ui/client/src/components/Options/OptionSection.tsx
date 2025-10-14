import React, { useState, useEffect, useRef } from "react";
import OptionRenderer from "@src/components/Options/OptionRenderer";
import type { OptionSectionConfig, OptionContext } from "@src/types/options";
import type { ModelParameters } from "@src/types/api";
import { modelOptionsConfig } from "@src/config/optionsConfig";
import {
  filterVisibleOptions,
  shouldShowOption,
} from "@src/utils/optionVisibility";
import TEXT from "@src/lib/text";
import CONFIG from "@src/CONFIG";
import CONST from "@src/CONST";

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
  const [isOpen, setIsOpen] = useState(config.defaultOpen ?? true);
  const advancedOptionKeys = modelOptionsConfig.advanced.options.map(
    (option) => option.key,
  );
  const hasUserToggled = useRef(false);

  useEffect(() => {
    if (
      config.title === TEXT.model.advancedOptions.title &&
      !hasUserToggled.current
    ) {
      const hasAdvancedOptionsChanged = advancedOptionKeys.some(
        (key) => parameters[key] !== CONFIG.DEFAULT_MODEL_PARAMETERS[key],
      );
      // Only open if advanced options are changed, never close automatically
      if (hasAdvancedOptionsChanged && !isOpen) {
        setIsOpen(true);
      }
    }
  }, [config.title, parameters, isOpen, advancedOptionKeys]);

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
      hasUserToggled.current = true;
      setIsOpen((prev) => !prev);
    }
  };

  const shouldShowBottomText =
    Boolean(config.bottomText) &&
    !(
      config === modelOptionsConfig.basic &&
      parameters.modelType === CONST.MODEL_TYPES.WAIVE
    );

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
      {shouldShowBottomText && (
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
