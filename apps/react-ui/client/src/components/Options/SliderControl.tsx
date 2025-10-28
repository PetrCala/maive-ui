import React from "react";
import Slider from "@src/components/Slider";
import OptionWrapper from "./OptionWrapper";

type SliderControlProps = {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  className?: string;
  disabled?: boolean;
  formatValue?: (value: number) => string;
  showValueLabel?: boolean;
  showBounds?: boolean;
};

export default function SliderControl({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  className = "",
  disabled = false,
  formatValue,
  showValueLabel,
  showBounds,
}: SliderControlProps) {
  const formatter = formatValue ?? ((val: number) => val.toString());
 
  return (
    <OptionWrapper label={label} className={className}>
      {disabled ? (
        <p className="text-gray-900 dark:text-white font-medium">
          {formatter(value)}
        </p>
      ) : (
        <Slider
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={onChange}
          formatValue={formatter}
          showValueLabel={showValueLabel}
          showBounds={showBounds}
          ariaLabel={label}
        />
      )}
    </OptionWrapper>
  );
}
