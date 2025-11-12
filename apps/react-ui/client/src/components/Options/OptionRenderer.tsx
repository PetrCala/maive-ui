import React from "react";
import {
  YesNoSelect,
  DropdownSelect,
  SliderControl,
} from "@src/components/Options";
import Tooltip from "@src/components/Tooltip";
import Alert from "@src/components/Alert";
import type { OptionConfig, OptionContext } from "@src/types/options";
import type { ModelParameters } from "@src/types/api";
import CONFIG from "@src/CONFIG";
import CONST from "@src/CONST";
import TEXT from "@src/lib/text";
import renderRichInfoMessage from "@src/lib/text/richText";

type OptionRendererProps = {
  option: OptionConfig;
  value: ModelParameters[keyof ModelParameters];
  parameters: ModelParameters;
  onChange: (
    key: keyof ModelParameters,
    value: string | boolean | number,
  ) => void;
  tooltipsEnabled?: boolean;
  context?: OptionContext;
};

export default function OptionRenderer({
  option,
  value,
  parameters,
  onChange,
  tooltipsEnabled = true,
  context,
}: OptionRendererProps) {
  const handleChange = (newValue: string | boolean | number) => {
    onChange(option.key, newValue);
  };

  const handleBooleanChange = (newValue: boolean) => {
    handleChange(newValue);
  };

  const handleStringChange = (newValue: string) => {
    handleChange(newValue);
  };

  const handleNumberChange = (newValue: number) => {
    handleChange(newValue);
  };

  const optionLabel = (() => {
    if (option.key === "maiveMethod") {
      if (!parameters.shouldUseInstrumenting) {
        return TEXT.model.maiveMethod.nonInstrumentingLabel;
      }

      if (parameters.modelType === CONST.MODEL_TYPES.WAIVE) {
        return TEXT.model.maiveMethod.waiveLabel;
      }
    }

    return option.label;
  })();

  const noInstrumentingInfo =
    TEXT.model.shouldUseInstrumenting.noInstrumentingInfo;
  const tooltipContent =
    option.key === "modelType" ? TEXT.model.modelType.tooltip : option.tooltip;
  const isWaiveModel =
    CONFIG.WAIVE_ENABLED && parameters.modelType === CONST.MODEL_TYPES.WAIVE;

  const renderOption = () => {
    switch (option.type) {
      case "yesno":
        if (typeof value !== "boolean") {
          return null;
        }
        return (
          <YesNoSelect
            label={optionLabel}
            value={value}
            onChange={handleBooleanChange}
            className={option.className}
            disabled={option.disabled}
          />
        );
      case "dropdown": {
        if (typeof value !== "string") {
          return null;
        }
        let dropdownOptions = option.options;

        if (option.key === "weight") {
          dropdownOptions = dropdownOptions.filter((dropdownOption) => {
            if (
              !parameters.shouldUseInstrumenting &&
              dropdownOption.value ===
                CONST.WEIGHT_OPTIONS.ADJUSTED_WEIGHTS.VALUE
            ) {
              return false;
            }
            return true;
          });
        }

        if (option.key === "maiveMethod" && isWaiveModel) {
          dropdownOptions = dropdownOptions.filter(
            (dropdownOption) =>
              dropdownOption.value === CONST.MAIVE_METHODS.PET_PEESE,
          );
        }

        return (
          <DropdownSelect
            label={optionLabel}
            value={value}
            onChange={handleStringChange}
            options={dropdownOptions}
            className={option.className}
            disabled={option.disabled}
          />
        );
      }
      case "slider":
        if (typeof value !== "number") {
          return null;
        }
        return (
          <SliderControl
            label={optionLabel}
            value={value}
            onChange={handleNumberChange}
            min={option.min}
            max={option.max}
            step={option.step}
            className={option.className}
            disabled={option.disabled}
            formatValue={option.formatValue}
            showValueLabel={option.showValueLabel}
            showBounds={option.showBounds}
            valueLabel={option.valueLabel}
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

    const warningContext: OptionContext =
      context ?? ({ parameters } as OptionContext);

    return option.warnings
      .filter((warning) => warning.condition(parameters, warningContext))
      .map((warning, index) => (
        <Alert
          key={index}
          message={
            warning.richText
              ? renderRichInfoMessage(warning.richText)
              : warning.message
          }
          type={warning.type}
          className="mt-3"
        />
      ));
  };

  return (
    <div className="flex-shrink-0">
      <Tooltip
        content={tooltipContent}
        visible={tooltipsEnabled && CONFIG.TOOLTIPS_ENABLED.MODEL_PAGE}
      >
        {renderOption()}
      </Tooltip>
      {option.key === "modelType" && !parameters.shouldUseInstrumenting && (
        <Alert
          message={renderRichInfoMessage(noInstrumentingInfo)}
          type={CONST.ALERT_TYPES.INFO}
          className="mt-3"
          role="status"
        />
      )}
      {option.key === "modelType" && isWaiveModel && (
        <Alert
          message={TEXT.waive.helpText}
          type={CONST.ALERT_TYPES.INFO}
          className="mt-3"
          role="status"
        />
      )}
      {renderWarnings()}
    </div>
  );
}
