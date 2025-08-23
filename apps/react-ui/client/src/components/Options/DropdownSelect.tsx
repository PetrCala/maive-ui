import React from "react";
import OptionWrapper from "./OptionWrapper";

type Option = {
  value: string;
  label: string;
};

type DropdownSelectProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  className?: string;
  disabled?: boolean;
  width?: string;
};

export default function DropdownSelect({
  label,
  value,
  onChange,
  options,
  className = "",
  disabled = false,
  width = "w-48",
}: DropdownSelectProps) {
  const shouldRenderAsPlainText = disabled || options.length === 1;
  const currentOption =
    options.find((option) => option.value === value) ?? options[0];

  return (
    <OptionWrapper label={label} className={className}>
      {shouldRenderAsPlainText ? (
        <p className="text-gray-900 dark:text-white font-medium">
          {currentOption.label}
        </p>
      ) : (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${width} px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white`}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}
    </OptionWrapper>
  );
}
