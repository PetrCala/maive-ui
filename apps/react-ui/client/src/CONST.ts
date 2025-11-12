const GH_OWNER = "PetrCala";
const GH_REPO_UI = "maive-ui";

const GH_REPO_PACKAGE = "MAIVE";
const GH_REPO_PACKAGE_ORG = "meta-analysis-es/maive";
const GH_R_SCRIPTS_PATH = "apps/lambda-r-backend/r_scripts";

const CONST = {
  APP_DISPLAY_NAME: "MAIVE UI",

  CREATOR: "Petr Čala",
  CREATOR_EMAIL: "61505008@fsv.cuni.cz",
  INSTITUTION_NAME: "Charles University",

  GITHUB: {
    OWNER: GH_OWNER,
    REPO_UI: GH_REPO_UI,
    REPO_PACKAGE: GH_REPO_PACKAGE,
    REPO_PACKAGE_ORG: GH_REPO_PACKAGE_ORG,
    R_SCRIPTS_PATH: GH_R_SCRIPTS_PATH,
  },

  LINKS: {
    MAIVE: {
      WEBSITE: "https://meta-analysis.cz/maive/",
      PAPER: "https://doi.org/10.1038/s41467-025-63261-0",
      GITHUB: "https://github.com/meta-analysis-es/maive",
    },
    APP_GITHUB: {
      HOMEPAGE: `https://github.com/${GH_OWNER}/${GH_REPO_UI}`,
      ISSUES: `https://github.com/${GH_OWNER}/${GH_REPO_UI}/issues`,
    },
    APPLICATIONS_URL: "https://meta-analysis.cz/",
    CREATOR_URL: `https://github.com/${GH_OWNER}`,
    CONTACT_WEBSITE_URL: "https://irsova.com/",
    INSTITUTION_URL: "https://ies.fsv.cuni.cz/en",
  },

  REPRODUCIBILITY: {
    DEFAULTS: {
      R_VERSION: "4.4.1",
      MAIVE_TAG: "0.0.3.4",
    },
  },

  MODEL_TYPES: {
    MAIVE: "MAIVE",
    WAIVE: "WAIVE",
    WLS: "WLS",
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
    STUDY_WEIGHTS: {
      VALUE: "study_weights",
      TEXT: "Study Weights",
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
  LARGE_DATASET_ROW_THRESHOLD: 2000,
  MOCK_DATA_ROWS_MIN: 9, // At least 3 studies with 3 observations each
  MOCK_DATA_ROWS_MAX: 200,
  DEMO_MOCK_DATA_NAME: "Mock Data 4",
} as const;

export default CONST;
