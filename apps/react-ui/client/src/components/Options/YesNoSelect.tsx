import React from "react";

interface YesNoSelectProps {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  className?: string;
  disabled?: boolean;
}

export default function YesNoSelect({
  label,
  value,
  onChange,
  className = "",
  disabled = false,
}: YesNoSelectProps) {
  return (
    <div className={`${className}`}>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {label}
      </label>
      <div className="flex space-x-4">
        <label className="inline-flex items-center">
          <input
            type="radio"
            checked={value}
            onChange={() => onChange(true)}
            disabled={disabled}
            className="form-radio text-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <span className="ml-2 text-gray-700 dark:text-gray-300">Yes</span>
        </label>
        <label className="inline-flex items-center">
          <input
            type="radio"
            checked={!value}
            onChange={() => onChange(false)}
            disabled={disabled}
            className="form-radio text-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <span className="ml-2 text-gray-700 dark:text-gray-300">No</span>
        </label>
      </div>
    </div>
  );
}
