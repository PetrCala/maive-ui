import type { OptionVisibility, OptionContext } from "@src/types/options";
import type { ModelParameters } from "@src/types/api";

/**
 * Checks if an option should be visible based on its visibility configuration
 */
export function shouldShowOption(
  visibility: OptionVisibility | undefined,
  context: OptionContext,
): boolean {
  if (!visibility) {
    return true; // Default to visible if no visibility rules
  }

  // Check hideWhen function
  if (visibility.hideWhen?.(context.parameters)) {
    return false;
  }

  // Check hideIf function
  if (visibility.hideIf?.(context)) {
    return false;
  }

  // Check hideIfValue (exact parameter matches)
  if (visibility.hideIfValue) {
    for (const [key, value] of Object.entries(visibility.hideIfValue)) {
      if (context.parameters[key as keyof ModelParameters] === value) {
        return false;
      }
    }
  }

  // Check hideIfKeyValue (specific key-value pairs)
  if (visibility.hideIfKeyValue) {
    for (const { key, value } of visibility.hideIfKeyValue) {
      if (context.parameters[key] === value) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Filters options based on their visibility configuration
 */
export function filterVisibleOptions<
  T extends { visibility?: OptionVisibility },
>(items: T[], context: OptionContext): T[] {
  return items.filter((item) => shouldShowOption(item.visibility, context));
}
