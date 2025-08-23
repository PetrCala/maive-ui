import TEXT from "@src/lib/text";
import CONST from "@src/CONST";
import CONFIG from "@src/CONFIG";
import type { ModelOptionsConfig } from "@src/types/options";
import type { ModelParameters } from "@src/types/api";

export const modelOptionsConfig: ModelOptionsConfig = {
  basic: {
    options: [
      {
        key: "modelType",
        label: TEXT.model.modelType.label,
        tooltip: TEXT.model.modelType.tooltip,
        type: "dropdown",
        options: Object.values(CONST.MODEL_TYPES).map((type) => ({
          value: type,
          label: type,
        })),
        disabled: !CONFIG.WAIVE_ENABLED,
      },
      {
        key: "includeStudyClustering",
        label: TEXT.model.includeStudyClustering.label,
        tooltip: TEXT.model.includeStudyClustering.tooltip,
        type: "yesno",
      },
      {
        key: "standardErrorTreatment",
        label: TEXT.model.standardErrorTreatment.label,
        tooltip: TEXT.model.standardErrorTreatment.tooltip,
        type: "dropdown",
        options: Object.values(CONST.STANDARD_ERROR_TREATMENTS).map(
          (treatment) => ({
            value: treatment.VALUE,
            label: treatment.TEXT,
          }),
        ),
      },
      {
        key: "computeAndersonRubin",
        label: TEXT.model.computeAndersonRubin.label,
        tooltip: TEXT.model.computeAndersonRubin.tooltip,
        type: "yesno",
        warnings: [
          {
            message: TEXT.model.computeAndersonRubin.warning,
            type: CONST.ALERT_TYPES.WARNING,
            condition: (parameters: ModelParameters) =>
              parameters.computeAndersonRubin === true,
          },
        ],
      },
    ],
  },
  advanced: {
    title: TEXT.model.advancedOptions.title,
    collapsible: true,
    defaultOpen: false,
    options: [
      {
        key: "maiveMethod",
        label: TEXT.model.maiveMethod.label,
        tooltip: TEXT.model.maiveMethod.tooltip,
        type: "dropdown",
        options: Object.values(CONST.MAIVE_METHODS).map((method) => ({
          value: method,
          label: method,
        })),
      },
      {
        key: "shouldUseInstrumenting",
        label: TEXT.model.shouldUseInstrumenting.label,
        tooltip: TEXT.model.shouldUseInstrumenting.tooltip,
        type: "yesno",
      },
      {
        key: "includeStudyDummies",
        label: TEXT.model.includeStudyDummies.label,
        tooltip: TEXT.model.includeStudyDummies.tooltip,
        type: "yesno",
      },
      {
        key: "weight",
        label: TEXT.model.weight.label,
        tooltip: TEXT.model.weight.tooltip,
        type: "dropdown",
        options: Object.values(CONST.WEIGHT_OPTIONS).map((option) => ({
          value: option.VALUE,
          label: option.TEXT,
        })),
      },
    ],
  },
};
