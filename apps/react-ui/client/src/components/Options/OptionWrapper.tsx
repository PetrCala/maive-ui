import React from "react";

type OptionWrapperProps = {
  label: string;
  className?: string;
  children: React.ReactNode;
};

export default function OptionWrapper({
  label,
  className = "",
  children,
}: OptionWrapperProps) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {label}
      </label>
      {children}
    </div>
  );
}
