import React from "react";
import { YesNoSelect, DropdownSelect } from "@src/components/Options";
import Tooltip from "@src/components/Tooltip";
import Alert from "@src/components/Alert";
import type { OptionConfig } from "@src/types/options";
import type { ModelParameters } from "@src/types/api";
import CONFIG from "@src/CONFIG";
import CONST from "@src/CONST";
import TEXT from "@src/lib/text";

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

  const optionLabel =
    option.key === "maiveMethod" && !parameters.shouldUseInstrumenting
      ? TEXT.model.maiveMethod.nonInstrumentingLabel
      : option.label;

  const renderOption = () => {
    switch (option.type) {
      case "yesno":
        return (
          <YesNoSelect
            label={optionLabel}
            value={value as boolean}
            onChange={handleChange as (value: boolean) => void}
            className={option.className}
            disabled={option.disabled}
          />
        );
      case "dropdown": {
        const dropdownOptions =
          option.key === "weight"
            ? option.options.filter((dropdownOption) => {
                if (
                  !parameters.shouldUseInstrumenting &&
                  dropdownOption.value ===
                    CONST.WEIGHT_OPTIONS.ADJUSTED_WEIGHTS.VALUE
                ) {
                  return false;
                }
                return true;
              })
            : option.options;
        return (
          <DropdownSelect
            label={optionLabel}
            value={value as string}
            onChange={handleChange as (value: string) => void}
            options={dropdownOptions}
            className={option.className}
            disabled={option.disabled}
          />
        );
      }
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
      {option.key === "shouldUseInstrumenting" &&
        !parameters.shouldUseInstrumenting && (
          <Alert
            message={TEXT.model.shouldUseInstrumenting.noInstrumentingInfo}
            type={CONST.ALERT_TYPES.INFO}
            className="mt-3"
            role="status"
          />
        )}
      {renderWarnings()}
    </div>
  );
}
