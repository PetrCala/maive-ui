import TEXT from "@src/lib/text";
import CONST from "@src/CONST";
import CONFIG from "@src/CONFIG";
import type { ModelOptionsConfig } from "@src/types/options";
import type { ModelParameters } from "@src/types/api";
import { hasStudyIdColumn } from "@src/utils/dataUtils";
import type { DataArray } from "@src/types";

export const modelOptionsConfig: ModelOptionsConfig = {
  basic: {
    bottomText: TEXT.model.basicOptions.bottomText,
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
        visibility: { hideIf: () => true }, // We don't need to show this, as it is automatically set to true if the data has a study ID column
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
        visibility: {
          hideIf: (context) =>
            !hasStudyIdColumn(
              (context.uploadedData as { data: DataArray } | undefined)?.data,
            ),
        },
      },
      {
        key: "computeAndersonRubin",
        label: TEXT.model.computeAndersonRubin.label,
        tooltip: TEXT.model.computeAndersonRubin.tooltip,
        type: "yesno",
        visibility: {
          hideIf: ({ parameters }) => !parameters.shouldUseInstrumenting,
        },
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
        warnings: [
          {
            message: TEXT.citation.reminder.text,
            type: CONST.ALERT_TYPES.INFO,
            condition: (parameters: ModelParameters) =>
              parameters.maiveMethod !== CONST.MAIVE_METHODS.PET_PEESE,
          },
        ],
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
      {
        key: "includeStudyDummies",
        label: TEXT.model.includeStudyDummies.label,
        tooltip: TEXT.model.includeStudyDummies.tooltip,
        type: "yesno",
        visibility: {
          hideIf: (context) =>
            !hasStudyIdColumn(
              (context.uploadedData as { data: DataArray } | undefined)?.data,
            ),
        },
      },
      {
        key: "shouldUseInstrumenting",
        label: TEXT.model.shouldUseInstrumenting.label,
        tooltip: TEXT.model.shouldUseInstrumenting.tooltip,
        type: "yesno",
      },
    ],
  },
};
