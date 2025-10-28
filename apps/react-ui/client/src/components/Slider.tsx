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
 
  const labelRowShouldRender = showValueLabel || showBounds;
  const labelRowClasses = `flex items-center ${
    showBounds ? "justify-between" : "justify-center"
  } text-xs text-gray-600 dark:text-gray-400 gap-2`;
 
  const formattedValue = formatValue(value);
  const formattedMin = formatValue(min);
  const formattedMax = formatValue(max);
 
  const sliderClasses = [
    "w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600",
    disabled ? "opacity-60 cursor-not-allowed" : "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
    className,
  ]
    .filter(Boolean)
    .join(" ");
 
  return (
    <div className="space-y-2">
      {labelRowShouldRender && (
        <div className={labelRowClasses}>
          {showBounds && <span>{formattedMin}</span>}
          {showValueLabel && (
            <span className="font-medium text-gray-900 dark:text-gray-100">
              {formattedValue}
            </span>
          )}
          {showBounds && <span>{formattedMax}</span>}
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
        className={sliderClasses}
      />
    </div>
  );
}
