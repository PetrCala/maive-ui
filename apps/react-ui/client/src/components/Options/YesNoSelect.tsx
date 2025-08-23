import React from "react";
import OptionWrapper from "./OptionWrapper";

type YesNoSelectProps = {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  className?: string;
  disabled?: boolean;
};

export default function YesNoSelect({
  label,
  value,
  onChange,
  className = "",
  disabled = false,
}: YesNoSelectProps) {
  return (
    <OptionWrapper label={label} className={className}>
      {disabled ? (
        <p className="text-gray-900 dark:text-white font-medium">
          {value ? "Yes" : "No"}
        </p>
      ) : (
        <div className="flex space-x-4">
          <label className="inline-flex items-center">
            <input
              type="radio"
              checked={value}
              onChange={() => onChange(true)}
              className="form-radio text-blue-600"
            />
            <span className="ml-2 text-gray-700 dark:text-gray-300">Yes</span>
          </label>
          <label className="inline-flex items-center">
            <input
              type="radio"
              checked={!value}
              onChange={() => onChange(false)}
              className="form-radio text-blue-600"
            />
            <span className="ml-2 text-gray-700 dark:text-gray-300">No</span>
          </label>
        </div>
      )}
    </OptionWrapper>
  );
}
