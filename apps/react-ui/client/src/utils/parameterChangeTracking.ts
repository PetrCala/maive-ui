import CONST from "@src/CONST";
import TEXT from "@src/lib/text";
import type { ModelParameters } from "@src/types";

export type ParameterChange = {
  param: keyof ModelParameters;
  oldValue: unknown;
  newValue: unknown;
  message: string;
};

/**
 * Tracks automatic parameter changes that occur when a user modifies a parameter.
 * Returns an array of changes that happened automatically (not the user-initiated change).
 */
export function trackParameterChanges(
  prev: ModelParameters,
  next: ModelParameters,
  changedByUser: keyof ModelParameters,
): ParameterChange[] {
  const changes: ParameterChange[] = [];

  // Helper to add a change if the value actually changed
  const addChange = (
    param: keyof ModelParameters,
    oldVal: unknown,
    newVal: unknown,
    message: string,
  ) => {
    if (oldVal !== newVal && param !== changedByUser) {
      changes.push({
        param,
        oldValue: oldVal,
        newValue: newVal,
        message,
      });
    }
  };

  // Track modelType changes and their cascading effects
  if (changedByUser === "modelType") {
    const prevModelType = prev.modelType;
    const nextModelType = next.modelType;

    if (nextModelType === CONST.MODEL_TYPES.WLS) {
      addChange(
        "shouldUseInstrumenting",
        prev.shouldUseInstrumenting,
        next.shouldUseInstrumenting,
        TEXT.model.parameterAlerts.wlsInstrumentingDisabled,
      );

      if (prev.weight !== next.weight) {
        addChange(
          "weight",
          prev.weight,
          next.weight,
          TEXT.model.parameterAlerts.wlsWeightChanged,
        );
      }

      addChange(
        "computeAndersonRubin",
        prev.computeAndersonRubin,
        next.computeAndersonRubin,
        TEXT.model.parameterAlerts.wlsAndersonRubinDisabled,
      );
    } else if (nextModelType === CONST.MODEL_TYPES.WAIVE) {
      addChange(
        "shouldUseInstrumenting",
        prev.shouldUseInstrumenting,
        next.shouldUseInstrumenting,
        TEXT.model.parameterAlerts.waiveInstrumentingEnabled,
      );

      if (prev.maiveMethod !== next.maiveMethod) {
        addChange(
          "maiveMethod",
          prev.maiveMethod,
          next.maiveMethod,
          TEXT.model.parameterAlerts.waiveMethodChanged,
        );
      }

      if (prev.useLogFirstStage !== next.useLogFirstStage) {
        addChange(
          "useLogFirstStage",
          prev.useLogFirstStage,
          next.useLogFirstStage,
          TEXT.model.parameterAlerts.waiveLogFirstStageEnabled,
        );
      }
    } else if (
      nextModelType === CONST.MODEL_TYPES.MAIVE &&
      prevModelType !== CONST.MODEL_TYPES.MAIVE
    ) {
      addChange(
        "shouldUseInstrumenting",
        prev.shouldUseInstrumenting,
        next.shouldUseInstrumenting,
        TEXT.model.parameterAlerts.maiveInstrumentingEnabled,
      );
    }
  }

  // Track weight changes
  if (changedByUser === "weight") {
    if (
      next.weight === CONST.WEIGHT_OPTIONS.STANDARD_WEIGHTS.VALUE &&
      prev.computeAndersonRubin !== next.computeAndersonRubin &&
      !next.computeAndersonRubin
    ) {
      addChange(
        "computeAndersonRubin",
        prev.computeAndersonRubin,
        next.computeAndersonRubin,
        TEXT.model.parameterAlerts.weightStandardAndersonRubinDisabled,
      );
    }
  }

  // Track includeStudyDummies changes
  if (changedByUser === "includeStudyDummies") {
    if (
      next.includeStudyDummies &&
      prev.computeAndersonRubin !== next.computeAndersonRubin &&
      !next.computeAndersonRubin
    ) {
      addChange(
        "computeAndersonRubin",
        prev.computeAndersonRubin,
        next.computeAndersonRubin,
        TEXT.model.parameterAlerts.studyDummiesAndersonRubinDisabled,
      );
    }
  }

  // Track standardErrorTreatment changes
  if (changedByUser === "standardErrorTreatment") {
    if (prev.includeStudyClustering !== next.includeStudyClustering) {
      addChange(
        "includeStudyClustering",
        prev.includeStudyClustering,
        next.includeStudyClustering,
        TEXT.model.parameterAlerts.standardErrorClusteringAdjusted,
      );
    }
  }

  // Track shouldUseInstrumenting changes
  if (changedByUser === "shouldUseInstrumenting") {
    if (
      !next.shouldUseInstrumenting &&
      prev.weight === CONST.WEIGHT_OPTIONS.ADJUSTED_WEIGHTS.VALUE &&
      next.weight !== CONST.WEIGHT_OPTIONS.ADJUSTED_WEIGHTS.VALUE
    ) {
      addChange(
        "weight",
        prev.weight,
        next.weight,
        TEXT.model.parameterAlerts.adjustedWeightsWithoutInstrumenting,
      );
    }
  }

  // Also check for any other automatic changes that might have occurred
  // (e.g., from useEffect hooks)
  const allParams: Array<keyof ModelParameters> = [
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

  for (const param of allParams) {
    if (param !== changedByUser && prev[param] !== next[param]) {
      // Check if we already added this change
      if (!changes.some((c) => c.param === param)) {
        // This is a change we haven't tracked yet - might be from useEffect
        // We'll handle these in the model page directly
      }
    }
  }

  return changes;
}
