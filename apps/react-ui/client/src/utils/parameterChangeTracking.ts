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
  "PET-PEESE": "PET-PEESE", // eslint-disable-line
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
 * Context for determining change explanations.
 */
type ChangeContext = {
  param: keyof ModelParameters;
  oldValue: unknown;
  newValue: unknown;
  changedByUser: keyof ModelParameters | null;
  prev: ModelParameters;
  next: ModelParameters;
};

/**
 * Explanation rules for automatic parameter changes.
 * Each rule is a function that returns an explanation string or null.
 * Rules are evaluated in order; first matching rule wins.
 *
 * This design is scalable: just add new rules to handle new scenarios.
 */
type ExplanationRule = (context: ChangeContext) => string | null;

const EXPLANATION_RULES: ExplanationRule[] = [
  // shouldUseInstrumenting changes
  ({ param, next, changedByUser }) => {
    if (param !== "shouldUseInstrumenting") {
      return null;
    }
    if (changedByUser !== "modelType") {
      return null;
    }

    if (next.modelType === CONST.MODEL_TYPES.WLS) {
      return "**WLS** doesn't use instrumenting";
    }
    if (next.modelType === CONST.MODEL_TYPES.WAIVE) {
      return "**WAIVE** requires instrumenting";
    }
    if (next.modelType === CONST.MODEL_TYPES.MAIVE) {
      return "**MAIVE** requires instrumenting";
    }
    return null;
  },

  // computeAndersonRubin disabled due to model type
  ({ param, next, changedByUser }) => {
    if (param !== "computeAndersonRubin") {
      return null;
    }
    if (
      changedByUser === "modelType" &&
      next.modelType === CONST.MODEL_TYPES.WLS
    ) {
      return "**WLS** doesn't use instrumenting";
    }
    return null;
  },

  // computeAndersonRubin disabled due to weight
  ({ param, next, changedByUser }) => {
    if (param !== "computeAndersonRubin") {
      return null;
    }
    if (
      changedByUser === "weight" &&
      next.weight === CONST.WEIGHT_OPTIONS.STANDARD_WEIGHTS.VALUE
    ) {
      return "**Anderson-Rubin CI** is not available with **Standard Weights**";
    }
    return null;
  },

  // computeAndersonRubin disabled due to study dummies
  ({ param, next, changedByUser }) => {
    if (param !== "computeAndersonRubin") {
      return null;
    }
    if (changedByUser === "includeStudyDummies" && next.includeStudyDummies) {
      return "**Anderson-Rubin CI** is not available with **Fixed-Intercept Multilevel**";
    }
    return null;
  },

  // weight changed due to instrumenting being disabled
  ({ param, changedByUser }) => {
    if (param !== "weight") {
      return null;
    }
    if (changedByUser === "shouldUseInstrumenting") {
      return "**Adjusted Weights** requires instrumenting";
    }
    if (changedByUser === "modelType") {
      return "**Adjusted Weights** requires instrumenting";
    }
    return null;
  },

  // maiveMethod changed due to WAIVE model
  ({ param, next, changedByUser }) => {
    if (param !== "maiveMethod") {
      return null;
    }
    if (
      changedByUser === "modelType" &&
      next.modelType === CONST.MODEL_TYPES.WAIVE
    ) {
      return "**WAIVE** only supports **PET-PEESE**";
    }
    return null;
  },

  // useLogFirstStage changed due to WAIVE model
  ({ param, next, changedByUser }) => {
    if (param !== "useLogFirstStage") {
      return null;
    }
    if (
      changedByUser === "modelType" &&
      next.modelType === CONST.MODEL_TYPES.WAIVE
    ) {
      return "log first stage is recommended for **WAIVE**";
    }
    return null;
  },

  // includeStudyClustering changed due to standard error treatment
  ({ param, changedByUser }) => {
    if (param !== "includeStudyClustering") {
      return null;
    }
    if (changedByUser === "standardErrorTreatment") {
      return "to match **Standard Error Treatment**";
    }
    return null;
  },
];

/**
 * Get an explanation for why a parameter changed automatically.
 * Returns null if no specific explanation is available.
 */
function getChangeExplanation(context: ChangeContext): string | null {
  for (const rule of EXPLANATION_RULES) {
    const explanation = rule(context);
    if (explanation) {
      return explanation;
    }
  }
  return null;
}

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
 * Includes an explanation if one is available for the context.
 */
export function getParameterChangeMessage(
  param: keyof ModelParameters,
  oldValue: unknown,
  newValue: unknown,
  context?: {
    changedByUser: keyof ModelParameters | null;
    prev: ModelParameters;
    next: ModelParameters;
  },
): string {
  const paramLabel = PARAMETER_LABELS[param] ?? param;
  const formattedNewValue = formatValue(newValue);

  let message = `**${paramLabel}** set to **${formattedNewValue}**`;

  // Add explanation if context is provided
  if (context) {
    const explanation = getChangeExplanation({
      param,
      oldValue,
      newValue,
      changedByUser: context.changedByUser,
      prev: context.prev,
      next: context.next,
    });

    if (explanation) {
      message += ` because ${explanation}`;
    }
  }

  return message;
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
        message: getParameterChangeMessage(param, oldValue, newValue, {
          changedByUser,
          prev,
          next,
        }),
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
