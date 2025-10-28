import React from "react";

type SliderProps = {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  formatValue?: (value: number) => string;
  showValueLabel?: boolean;
  showBounds?: boolean;
  valueLabel?: string;
  className?: string;
  name?: string;
  id?: string;
  ariaLabel?: string;
  ariaLabelledBy?: string;
};

const defaultFormatValue = (value: number) => value.toString();

export default function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
  disabled = false,
  formatValue = defaultFormatValue,
  showValueLabel = true,
  showBounds = true,
  valueLabel = "Selected value",
  className = "",
  name,
  id,
  ariaLabel,
  ariaLabelledBy,
}: SliderProps) {
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextValue = Number(event.target.value);
    if (!Number.isNaN(nextValue)) {
      onChange(nextValue);
    }
  };

  const formattedValue = formatValue(value);
  const formattedMin = formatValue(min);
  const formattedMax = formatValue(max);

  const sliderClasses = [
    "w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600",
    disabled
      ? "opacity-60 cursor-not-allowed"
      : "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="space-y-3">
      {showBounds && (
        <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
          <span>{formattedMin}</span>
          <span>{formattedMax}</span>
        </div>
      )}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={handleChange}
        disabled={disabled}
        name={name}
        id={id}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={formattedValue}
        className={sliderClasses}
      />
      {showValueLabel && (
        <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
          <span>{valueLabel}</span>
          <span className="inline-flex items-center justify-center rounded-md bg-gray-100 px-2 py-1 text-sm font-medium text-gray-900 dark:bg-gray-800 dark:text-gray-100 min-w-[3.5rem]">
            {formattedValue}
          </span>
        </div>
      )}
    </div>
  );
}
