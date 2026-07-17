const GH_OWNER = "PetrCala";
const GH_REPO_UI = "maive-ui";

const GH_REPO_PACKAGE = "MAIVE";
const GH_REPO_PACKAGE_ORG = "PetrCala/MAIVE"; // meta-analysis-es/maive
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
      CRAN: "https://cran.r-project.org/web/packages/MAIVE/index.html",
      GITHUB: `https://github.com/${GH_REPO_PACKAGE_ORG}`,
    },
    APP_GITHUB: {
      HOMEPAGE: `https://github.com/${GH_OWNER}/${GH_REPO_UI}`,
      ISSUES: `https://github.com/${GH_OWNER}/${GH_REPO_UI}/issues`,
    },
    PUBLIC_API: {
      // Branded hostname for the public /v1 model API (see docs/PUBLIC_API.md).
      BASE_URL: "https://api.maive.eu",
      // In-app docs page. Kept off /api, which is the Next.js API-routes namespace.
      DOCS_ROUTE: "/api-docs",
      SPEC: `https://github.com/${GH_OWNER}/${GH_REPO_UI}/blob/master/docs/api/openapi.yaml`,
      GUIDE: `https://github.com/${GH_OWNER}/${GH_REPO_UI}/blob/master/docs/PUBLIC_API.md`,
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

  // Async runs. TTL_SECONDS is the authoritative server-side DynamoDB record
  // lifetime (set when a job is queued); the client uses TTL_MS to decide when a
  // run that is missing from the backend is genuinely expired vs. transiently
  // absent. Single source of truth shared by the API route and the client.
  RUNS: {
    TTL_SECONDS: 48 * 60 * 60, // 48h pickup buffer
    TTL_MS: 48 * 60 * 60 * 1000,
  },

  MODEL_TYPES: {
    MAIVE: "MAIVE",
    WAIVE: "WAIVE",
    WLS: "WLS",
    RTMA: "RTMA",
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
  LARGE_DATASET_ROW_THRESHOLD: 500,
  MOCK_DATA_ROWS_MIN: 9, // At least 3 studies with 3 observations each
  MOCK_DATA_ROWS_MAX: 200,
  // NOTE: Update the descriptive copy in apps/lambda-r-backend/r_scripts/funnel_plot.R (ADJUSTED_POINT_MIN_SCALE) when this value changes.
  ADJUSTED_POINT_MIN_SCALE: 0.1,
  DEMO_MOCK_DATA_NAME: "Mock Data 4",
} as const;

export default CONST;
