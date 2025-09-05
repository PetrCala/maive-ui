import CONST from "./CONST";

const CONFIG = {
  BOOTSTRAP_ENABLED: false,
  WAIVE_ENABLED: false,
  SHOULD_SEND_EMAIL_IN_FOOTER_CONTACT: false,
  SHOULD_USE_BOOTSTRAP_SE_AS_DEFAULT: false,
  SHOULD_ADD_CITATION_TO_FUNNEL_PLOT: true,
  SHOULD_SHOW_MODEL_PARAMS_HELP_MODAL: false,
  SHOULD_SHOW_DF_ROWS_INFO: true,
  SHOULD_SUGGEST_MOCK_DATA_USE: true,
  TOOLTIPS_ENABLED: {
    MODEL_PAGE: true,
    RESULTS_PAGE: true,
  },

  DEFAULT_MODEL_PARAMETERS: {
    modelType: CONST.MODEL_TYPES.MAIVE,
    includeStudyDummies: false,
    includeStudyClustering: false,
    standardErrorTreatment: CONST.STANDARD_ERROR_TREATMENTS.CLUSTERED_CR2.VALUE,
    computeAndersonRubin: false,
    maiveMethod: CONST.MAIVE_METHODS.PET_PEESE,
    weight: CONST.WEIGHT_OPTIONS.EQUAL_WEIGHTS.VALUE,
    shouldUseInstrumenting: true,
  },
} as const;

export default CONFIG;
