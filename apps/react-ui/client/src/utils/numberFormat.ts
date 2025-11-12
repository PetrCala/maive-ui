/**
 * Formats a number with a custom thousands separator
 * @param value - The number to format
 * @param separator - The separator to use (default: comma)
 * @returns Formatted number string
 */
export const formatNumberWithSeparator = (
  value: number,
  separator = ",",
): string => {
  return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, separator);
};
