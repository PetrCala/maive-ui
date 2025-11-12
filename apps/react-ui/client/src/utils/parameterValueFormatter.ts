import CONST from "@src/CONST";
import type { ModelParameters } from "@src/types";

/**
 * Formats parameter values for user-friendly display in alerts
 */
export function formatParameterValue(
  param: keyof ModelParameters,
  value: unknown,
): string {
  if (value === null || value === undefined) {
    return "None";
  }

  switch (param) {
    case "modelType":
      return value as string;

    case "weight":
      const weightOption = Object.values(CONST.WEIGHT_OPTIONS).find(
        (opt) => opt.VALUE === value,
      );
      return weightOption?.TEXT ?? (value as string);

    case "maiveMethod":
      return value as string;

    case "standardErrorTreatment":
      const seOption = Object.values(CONST.STANDARD_ERROR_TREATMENTS).find(
        (opt) => opt.VALUE === value,
      );
      return seOption?.TEXT ?? (value as string);

    case "shouldUseInstrumenting":
      return value ? "Yes" : "No";

    case "computeAndersonRubin":
      return value ? "Yes" : "No";

    case "useLogFirstStage":
      return value ? "Yes" : "No";

    case "includeStudyDummies":
      return value ? "Yes" : "No";

    case "includeStudyClustering":
      return value ? "Yes" : "No";

    case "winsorize":
      return `${value as number}%`;

    default:
      return String(value);
  }
}
