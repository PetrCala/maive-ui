import type { ModelParameters } from "./api";

// Base option configuration that all options share
export type BaseOptionConfig = {
  key: keyof ModelParameters;
  label: string;
  tooltip: string;
  type: "yesno" | "dropdown";
  disabled?: boolean;
  className?: string;
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
