import React, { useState } from "react";
import OptionRenderer from "@src/components/Options/OptionRenderer";
import type { OptionSectionConfig } from "@src/types/options";
import type { ModelParameters } from "@src/types/api";

type OptionSectionProps = {
  config: OptionSectionConfig;
  parameters: ModelParameters;
  onChange: (key: keyof ModelParameters, value: string | boolean) => void;
  tooltipsEnabled?: boolean;
};

export default function OptionSection({
  config,
  parameters,
  onChange,
  tooltipsEnabled = true,
}: OptionSectionProps) {
  const [isOpen, setIsOpen] = useState(config.defaultOpen ?? true);

  const toggleOpen = () => {
    if (config.collapsible) {
      setIsOpen((prev) => !prev);
    }
  };

  const renderOptions = () => (
    <div className="flex flex-col gap-6">
      {config.options.map((option) => (
        <OptionRenderer
          key={option.key}
          option={option}
          value={parameters[option.key]}
          onChange={onChange}
          tooltipsEnabled={tooltipsEnabled}
        />
      ))}
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
