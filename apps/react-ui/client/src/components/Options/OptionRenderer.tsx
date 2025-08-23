import React from "react";
import { YesNoSelect, DropdownSelect } from "@src/components/Options";
import Tooltip from "@src/components/Tooltip";
import Alert from "@src/components/Alert";
import type { OptionConfig } from "@src/types/options";
import type { ModelParameters } from "@src/types/api";
import CONFIG from "@src/CONFIG";

type OptionRendererProps = {
  option: OptionConfig;
  value: ModelParameters[keyof ModelParameters];
  parameters: ModelParameters;
  onChange: (key: keyof ModelParameters, value: string | boolean) => void;
  tooltipsEnabled?: boolean;
};

export default function OptionRenderer({
  option,
  value,
  parameters,
  onChange,
  tooltipsEnabled = true,
}: OptionRendererProps) {
  const handleChange = (newValue: string | boolean) => {
    onChange(option.key, newValue);
  };

  const renderOption = () => {
    switch (option.type) {
      case "yesno":
        return (
          <YesNoSelect
            label={option.label}
            value={value as boolean}
            onChange={handleChange as (value: boolean) => void}
            className={option.className}
            disabled={option.disabled}
          />
        );
      case "dropdown":
        return (
          <DropdownSelect
            label={option.label}
            value={value as string}
            onChange={handleChange as (value: string) => void}
            options={option.options}
            className={option.className}
            disabled={option.disabled}
          />
        );
      default:
        return null;
    }
  };

  const renderWarnings = () => {
    if (!option.warnings) {
      return null;
    }

    return option.warnings
      .filter((warning) => warning.condition(parameters))
      .map((warning, index) => (
        <Alert
          key={index}
          message={warning.message}
          type={warning.type}
          className="mt-3"
        />
      ));
  };

  return (
    <div className="flex-shrink-0">
      <Tooltip
        content={option.tooltip}
        visible={tooltipsEnabled && CONFIG.TOOLTIPS_ENABLED.MODEL_PAGE}
      >
        {renderOption()}
      </Tooltip>
      {renderWarnings()}
    </div>
  );
}
