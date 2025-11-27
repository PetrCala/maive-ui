import CONST from "@src/CONST";
import type { ModelParameters } from "@src/types";

export type ParameterChange = {
  param: keyof ModelParameters;
  oldValue: unknown;
  newValue: unknown;
  message: string;
};

/**
 * Display labels for parameters - used when generating alert messages.
 */
const PARAMETER_LABELS: Record<keyof ModelParameters, string> = {
  modelType: "Model Type",
  includeStudyDummies: "Fixed-Intercept Multilevel",
  includeStudyClustering: "Study Clustering",
  standardErrorTreatment: "Standard Error Treatment",
  computeAndersonRubin: "Anderson-Rubin CI",
  maiveMethod: "MAIVE Method",
  weight: "Weighting",
  shouldUseInstrumenting: "Use Instrumenting",
  useLogFirstStage: "Log First Stage",
  winsorize: "Winsorization",
};

/**
 * Display labels for specific parameter values.
 */
const VALUE_LABELS: Record<string, string> = {
  // Model types
  MAIVE: "MAIVE",
  WAIVE: "WAIVE",
  WLS: "WLS",
  // Weights
  equal_weights: "Equal Weights",
  standard_weights: "Standard Weights",
  adjusted_weights: "Adjusted Weights",
  study_weights: "Study Weights",
  // MAIVE methods
  PET: "PET",
  PEESE: "PEESE",
  "PET-PEESE": "PET-PEESE",
  EK: "EK",
  // Standard error treatments
  not_clustered: "Not Clustered",
  clustered: "Clustered",
  clustered_cr2: "Clustered (CR2)",
  bootstrap: "Bootstrap",
  // Booleans
  true: "Yes",
  false: "No",
};

/**
 * Format a parameter value for display in an alert message.
 */
function formatValue(value: unknown): string {
  if (typeof value === "boolean") {
    return VALUE_LABELS[String(value)] ?? String(value);
  }
  if (typeof value === "string") {
    return VALUE_LABELS[value] ?? value;
  }
  if (typeof value === "number") {
    return `${value}%`;
  }
  return String(value);
}

/**
 * Generate a human-readable message for a parameter change.
 * Uses **markdown** syntax for emphasis on key terms.
 */
export function getParameterChangeMessage(
  param: keyof ModelParameters,
  oldValue: unknown,
  newValue: unknown,
): string {
  const paramLabel = PARAMETER_LABELS[param] ?? param;
  const formattedNewValue = formatValue(newValue);

  return `**${paramLabel}** automatically set to **${formattedNewValue}**`;
}

/**
 * All model parameters that should be tracked for changes.
 */
const TRACKED_PARAMETERS: Array<keyof ModelParameters> = [
  "modelType",
  "includeStudyDummies",
  "includeStudyClustering",
  "standardErrorTreatment",
  "computeAndersonRubin",
  "maiveMethod",
  "weight",
  "shouldUseInstrumenting",
  "useLogFirstStage",
  "winsorize",
];

/**
 * Detects all indirect parameter changes by comparing prev and next states.
 * Returns changes for any parameter that changed, EXCEPT the one the user directly modified.
 *
 * This is a generic function that catches ALL indirect changes, not just pre-defined scenarios.
 */
export function detectIndirectChanges(
  prev: ModelParameters,
  next: ModelParameters,
  changedByUser: keyof ModelParameters | null,
): ParameterChange[] {
  const changes: ParameterChange[] = [];

  for (const param of TRACKED_PARAMETERS) {
    // Skip the parameter the user directly changed
    if (param === changedByUser) {
      continue;
    }

    const oldValue = prev[param];
    const newValue = next[param];

    // Check if value actually changed
    if (oldValue !== newValue) {
      changes.push({
        param,
        oldValue,
        newValue,
        message: getParameterChangeMessage(param, oldValue, newValue),
      });
    }
  }

  return changes;
}

/**
 * Dispatches parameter alerts for all detected changes.
 * Uses setTimeout to avoid state updates during render.
 *
 * @param changes - Array of detected parameter changes
 * @param showParameterAlert - Function to show an alert (from ParameterAlertProvider)
 */
export function dispatchParameterAlerts(
  changes: ParameterChange[],
  showParameterAlert: (message: string) => void,
): void {
  if (changes.length === 0) {
    return;
  }

  setTimeout(() => {
    changes.forEach((change) => {
      showParameterAlert(change.message);
    });
  }, 0);
}

/**
 * Convenience function that detects changes and dispatches alerts in one call.
 * This is the main function to use in components.
 */
export function detectAndDispatchAlerts(
  prev: ModelParameters,
  next: ModelParameters,
  changedByUser: keyof ModelParameters | null,
  showParameterAlert: (message: string) => void,
): void {
  const changes = detectIndirectChanges(prev, next, changedByUser);
  dispatchParameterAlerts(changes, showParameterAlert);
}

// Keep the old function name as an alias for backward compatibility during migration
// TODO: Remove after migration is complete
export const trackParameterChanges = detectIndirectChanges;
