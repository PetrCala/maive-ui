import CONST from "./CONST";

const CONFIG = {
  BOOTSTRAP_ENABLED: true,
  WAIVE_ENABLED: true,
  RTMA_ENABLED: true,
  // RDT (Residual Discontinuity Test, #559): experimental diagnostic, off by
  // default like WAIVE was. Never exposed through the public API regardless.
  RDT_ENABLED: true,
  // Async (non-blocking) model runs + per-browser runs history.
  ASYNC_RUNS_ENABLED: true,
  SHOULD_SEND_EMAIL_IN_FOOTER_CONTACT: false,
  SHOULD_USE_CLUSTERED_CR2_SE_AS_DEFAULT: true,
  SHOULD_ADD_CITATION_TO_FUNNEL_PLOT: true,
  SHOULD_SHOW_MODEL_PARAMS_HELP_MODAL: false,
  SHOULD_SHOW_DF_ROWS_INFO: true,
  SHOULD_SUGGEST_MOCK_DATA_USE: true,
  SHOULD_SHOW_RAW_DATA_PREVIEW: false,
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
    // The first stage runs on log variances by default (#575, MAIVE#25).
    // Only models that instrument have a first stage; the resolver turns it
    // off for WLS, RTMA and RDT.
    useLogFirstStage: true,
    winsorize: 0,
    favorPositive: true,
  },

  PARAMETER_ALERTS: {
    ENABLED: true,
    AUTO_DISMISS: true,
    AUTO_DISMISS_DURATION: 5000,
  },
} as const;

export default CONFIG;
