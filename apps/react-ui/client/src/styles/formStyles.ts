/**
 * Shared form styles for consistent UI across the application
 * These styles are used for inputs, selects, and buttons
 */

/**
 * Standard input/select field styles
 * Matches the styling used in column mapping and other form elements
 */
export const INPUT_FIELD_CLASSES =
  "h-10 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900/40 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40";

/**
 * Standard button size classes
 * Small: Used for inline actions, toggle buttons
 * Medium: Default button size for primary actions
 * Large: Used for prominent CTAs
 */
export const BUTTON_SIZE_CLASSES = {
  sm: "h-10 px-3 text-sm",
  md: "h-11 px-4 text-base",
  lg: "h-12 px-6 text-lg",
} as const;

/**
 * Toggle button base classes
 * Used for Yes/No, AND/OR type toggles
 */
export const TOGGLE_BUTTON_BASE_CLASSES =
  "inline-flex items-center justify-center font-medium transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary";

/**
 * Gets toggle button classes with active state styling
 */
export const getToggleButtonClasses = (
  active: boolean,
  size: keyof typeof BUTTON_SIZE_CLASSES = "sm",
): string => {
  const sizeClass = BUTTON_SIZE_CLASSES[size];
  const stateClasses = active
    ? "bg-primary-600 text-white shadow-sm hover:bg-primary-500 dark:bg-primary-500 dark:hover:bg-primary-400"
    : "bg-white text-secondary hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700";

  return `${TOGGLE_BUTTON_BASE_CLASSES} ${sizeClass} ${stateClasses}`;
};

/**
 * Secondary button classes for actions like Add/Remove
 * Matches the ActionButton secondary variant styling
 */
export const SECONDARY_BUTTON_CLASSES =
  "inline-flex h-10 items-center justify-center gap-2 px-4 text-sm font-medium rounded-lg border border-gray-200 dark:border-gray-700 text-secondary hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors";

/**
 * Label classes for form fields
 */
export const LABEL_CLASSES = "text-sm font-medium text-secondary";
