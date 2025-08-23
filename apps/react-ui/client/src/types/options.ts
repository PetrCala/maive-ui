import type { AlertType } from "./alert";
import type { ModelParameters } from "./api";

// Warning configuration for options
export type OptionWarning = {
  message: string;
  type: AlertType;
  condition: (parameters: ModelParameters) => boolean;
};

// Base option configuration that all options share
export type BaseOptionConfig = {
  key: keyof ModelParameters;
  label: string;
  tooltip: string;
  type: "yesno" | "dropdown";
  disabled?: boolean;
  className?: string;
  warnings?: OptionWarning[];
};

// Yes/No option configuration
export type YesNoOptionConfig = {
  type: "yesno";
} & BaseOptionConfig;

// Dropdown option configuration
export type DropdownOptionConfig = {
  type: "dropdown";
  options: Array<{
    value: string;
    label: string;
  }>;
} & BaseOptionConfig;

// Union type for all option configurations
export type OptionConfig = YesNoOptionConfig | DropdownOptionConfig;

// Option section configuration
export type OptionSectionConfig = {
  title?: string;
  options: OptionConfig[];
  collapsible?: boolean;
  defaultOpen?: boolean;
};

// Complete options configuration for the model page
export type ModelOptionsConfig = {
  basic: OptionSectionConfig;
  advanced: OptionSectionConfig;
};
