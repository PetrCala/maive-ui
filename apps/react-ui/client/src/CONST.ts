const CONST = {
  MAIVE_URL: "https://meta-analysis.cz/maive/",
  MAIVE_PAPER_URL: "https://meta-analysis.cz/maive/maive.pdf",
  MAIVE_GITHUB_URL: "https://github.com/meta-analysis-es/maive",
  APP_DISPLAY_NAME: "MAIVE UI",
  CREATOR: "Petr Čala",
  CREATOR_URL: "https://github.com/PetrCala",

  // Footer constants
  FOOTER: {
    COPYRIGHT: "© Charles University 2025-",
    GITHUB_URL: "https://github.com/PetrCala/maive-ui",
    CONTACT_EMAIL: "61505008@fsv.cuni.cz",
    ISSUE_REPORT_URL: "https://github.com/PetrCala/maive-ui/issues",
  },

  MODEL_TYPES: {
    MAIVE: "MAIVE",
    WAIVE: "WAIVE",
  },
  MAIVE_METHODS: {
    PET: "PET",
    PEESE: "PEESE",
    PET_PEESE: "PET-PEESE",
    EK: "EK",
  },
  ALERT_TYPES: {
    WARNING: "warning",
    INFO: "info",
    ERROR: "error",
    SUCCESS: "success",
  },
  WEIGHT_OPTIONS: {
    EQUAL_WEIGHTS: {
      VALUE: "equal_weights",
      TEXT: "Equal Weights",
    },
    STANDARD_WEIGHTS: {
      VALUE: "standard_weights",
      TEXT: "Standard Weights",
    },
    ADJUSTED_WEIGHTS: {
      VALUE: "adjusted_weights",
      TEXT: "Adjusted Weights",
    },
  },
  STANDARD_ERROR_TREATMENTS: {
    NOT_CLUSTERED: {
      VALUE: "not_clustered",
      TEXT: "Not Clustered",
    },
    CLUSTERED: {
      VALUE: "clustered",
      TEXT: "Clustered",
    },
    CLUSTERED_CR2: {
      VALUE: "clustered_cr2",
      TEXT: "Clustered CR2",
    },
    BOOTSTRAP: {
      VALUE: "bootstrap",
      TEXT: "Bootstrap",
    },
  },
  MOCK_DATA_ROWS_MIN: 9, // At least 3 studies with 3 observations each
  MOCK_DATA_ROWS_MAX: 200,
} as const;

export default CONST;
