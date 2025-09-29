import type { AlertType } from "./alert";
import type { ModelParameters } from "./api";
import type { RichInfoMessage } from "@src/lib/text";

// Visibility control for options
export type OptionVisibility = {
  // Hide based on parameter values
  hideWhen?: (parameters: ModelParameters) => boolean;
  // Hide based on external conditions (e.g., data characteristics, user permissions)
  hideIf?: (context: OptionContext) => boolean;
  // Hide based on specific parameter values
  hideIfValue?: Partial<ModelParameters>;
  // Hide based on specific parameter keys and their values
  hideIfKeyValue?: Array<{ key: keyof ModelParameters; value: unknown }>;
};

// Context object passed to visibility functions
export type OptionContext = {
  parameters: ModelParameters;
  // Add other context as needed (e.g., uploadedData, userPermissions, etc.)
  [key: string]: unknown;
};

// Warning configuration for options
export type OptionWarning = {
  message: string;
  type: AlertType;
  condition: (parameters: ModelParameters) => boolean;
  richText?: RichInfoMessage;
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
  visibility?: OptionVisibility;
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
  visibility?: OptionVisibility;
  bottomText?: string;
};

// Complete options configuration for the model page
export type ModelOptionsConfig = {
  basic: OptionSectionConfig;
  advanced: OptionSectionConfig;
};
