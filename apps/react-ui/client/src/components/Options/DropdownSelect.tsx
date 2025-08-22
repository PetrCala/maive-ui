import React from "react";

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
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={`${width} px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
