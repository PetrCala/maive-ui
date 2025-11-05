/**
 * Types for reproducibility export functionality
 */

/**
 * Version information for the deployed application
 */
export type VersionInfo = {
  /** UI application version from package.json (e.g., "0.3.17-0") */
  uiVersion: string;
  /** MAIVE R package tag/version (e.g., "0.0.3.4") */
  maiveTag: string;
  /** Git commit hash of the deployed code */
  gitCommitHash: string;
  /** R version used in backend (e.g., "4.4.1") */
  rVersion: string;
  /** Timestamp when version info was generated */
  timestamp: string;
};

/**
 * Information about winsorization applied to the data
 */
export type WinsorizeInfo = {
  /** Winsorization percentage (0-100) */
  percentage: number;
  /** Number of effect size values clipped */
  clippedEffects: number;
  /** Number of standard error values clipped */
  clippedSEs: number;
  /** Lower bound for effect sizes */
  lowerBoundBS: number;
  /** Upper bound for effect sizes */
  upperBoundBS: number;
  /** Lower bound for standard errors */
  lowerBoundSE: number;
  /** Upper bound for standard errors */
  upperBoundSE: number;
};

/**
 * Bundle of R source code files fetched from GitHub
 */
export type RCodeBundle = {
  /** Content of maive_model.R */
  maiveModel: string;
  /** Content of funnel_plot.R */
  funnelPlot: string;
  /** Content of host.R (helper functions) */
  hostHelpers?: string;
};

/**
 * Configuration for README generation
 */
export type ReadmeConfig = {
  /** Version information */
  versionInfo: VersionInfo;
  /** Number of rows in the dataset */
  numRows: number;
  /** Analysis parameters as a formatted table */
  parameterTable: string;
  /** Citation information */
  citation: string;
};

/**
 * Complete reproducibility package metadata
 */
export type ReproducibilityPackage = {
  /** Main wrapper R script */
  wrapperScript: string;
  /** R source code bundle */
  rCodeBundle: RCodeBundle;
  /** User's data in CSV format */
  dataCsv: string;
  /** Parameters in JSON format */
  parametersJson: string;
  /** Expected results in JSON format */
  expectedResultsJson: string;
  /** README markdown content */
  readme: string;
  /** Version manifest text */
  versionManifest: string;
};
