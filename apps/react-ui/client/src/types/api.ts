// API request and response types

import type { RecipeName } from "@src/lib/parameterResolver";

type ApiResponse<T = unknown> = {
  data?: T;
  error?: string;
  message?: string;
  status?: string;
  time?: string;
};

type ModelParameters = {
  modelType: "MAIVE" | "WAIVE" | "WLS" | "RTMA" | "RDT";
  includeStudyDummies: boolean;
  includeStudyClustering: boolean;
  standardErrorTreatment:
    | "not_clustered"
    | "clustered"
    | "clustered_cr2"
    | "bootstrap";
  computeAndersonRubin: boolean;
  maiveMethod: "PET" | "PEESE" | "PET-PEESE" | "EK";
  weight:
    | "equal_weights"
    | "standard_weights"
    | "adjusted_weights"
    | "study_weights";
  shouldUseInstrumenting: boolean;
  useLogFirstStage: boolean;
  winsorize: number;
  favorPositive: boolean;
};

type ModelRequest = {
  data: string; // JSON stringified data
  parameters: string; // JSON stringified parameters
};

// Response of the legacy synchronous model routes. Always HTTP 200: either
// `{ data }` or an error payload with `error` set. Since #526 a failed run
// also carries `code` ("timeout", "worker_died") and the wall-clock numbers
// the server knows, so the UI can say what actually happened.
type ModelResponse = {
  data?: unknown[];
  error?: boolean | string;
  code?: string;
  message?: string;
  timeoutSeconds?: number;
  elapsedSeconds?: number;
  // The fully resolved parameters the backend actually ran (#555), added by
  // the same-origin proxy on every successful run so the results page and the
  // reproducibility package describe the run the server recorded, not the
  // browser's copy of it.
  resolvedParameters?: ResolvedParameters;
  recipe?: RecipeName | null;
};

// Verdict fields (`isSignificant`, `publicationBias.isSignificant`,
// `hausmanTest.rejectsNull`) are `null` when the number they rest on is
// undefined, e.g. a numerically zero standard error from a perfect fit. That
// is "no verdict", not "no": render it neutrally.
type ModelResults = {
  effectEstimate: number;
  standardError: number;
  isSignificant: boolean | null;
  andersonRubinCI: [number, number] | "NA";
  publicationBias: {
    eggerCoef: number;
    eggerSE: number;
    isSignificant: boolean | null;
    eggerBootCI: [number, number] | "NA";
    eggerAndersonRubinCI: [number, number] | "NA";
    // `"NA"` when the Egger standard error is zero (identical effects), so the
    // p-value is undefined. Same spelling the other undefined numbers use.
    pValue?: number | "NA";
  };
  firstStageFStatistic: number | "NA";
  hausmanTest: {
    // `"NA"` on every WLS and WAIVE run, and on MAIVE with degenerate input.
    statistic: number | "NA";
    criticalValue: number;
    rejectsNull: boolean | null;
  };
  seInstrumented: number[];
  funnelPlot: string; // Base64 encoded image
  funnelPlotWidth: number;
  funnelPlotHeight: number;
  bootCI: [[number, number], [number, number]] | "NA";
  bootSE: [number, number] | "NA";
  firstStage?: {
    mode: "levels" | "log";
    description: string;
    fStatisticLabel?: string;
  } | null;
  // New fields added in MAIVE commit 80125b2
  petpeese_selected?: "PET" | "PEESE" | null;
  // `"NA"` whenever `petpeese_selected` is `PET`, so no PEESE curve was fitted.
  peese_se2_coef?: number | "NA" | null;
  peese_se2_se?: number | "NA" | null;
  slope_coef?:
    | number
    | {
        kink_effect: number;
        kink_location: number;
      };
  is_quadratic_fit?: {
    quadratic: boolean;
    slope_type: string;
    slope_detail?: {
      kink_location?: number;
      kink_effect?: number;
    } | null;
  };
  // Instrument strength label from MAIVE 0.2.3+. Optional because runs stored
  // before the backend returned it have no value; `null` on older packages.
  instrument_strength?:
    | "strong"
    | "weak"
    | "very_weak"
    | "unknown"
    | "not_applicable"
    | null;
  // Conditions the MAIVE package raised while fitting (small sample, weak
  // instrument, perfect fit) plus the backend's own, e.g. an undefined
  // significance verdict. Optional for the same stored-run reason as above.
  warnings?: string[];
};

type RTMAParameters = {
  modelType: "RTMA";
  favorPositive: boolean;
  alphaSelect: number;
  ciLevel: number;
  winsorize: number;
  // Sampler seed. Optional on the way in (the backend's RTMA_DEFAULT_SEED is
  // the single definition of the default); the response's `seed` field says
  // which one actually ran.
  seed?: number;
};

// RDT (Residual Discontinuity Test, #559) has no user options at all: the
// cutoff, running variable, kernel, bandwidth rule and inference are fixed in
// the backend. Experimental; hidden behind CONFIG.RDT_ENABLED.
type RDTParameters = {
  modelType: "RDT";
};

// What the server resolved and ran, echoed as `resolvedParameters` on every
// successful run response (#555).
type ResolvedParameters = ModelParameters | RTMAParameters | RDTParameters;

// Per-parameter sampler diagnostics. The sampler can mix well for mu and
// badly for tau, so these are reported separately rather than collapsed into
// a single worst case.
type RTMAParameterDiagnostic = {
  mu: number | null;
  tau: number | null;
};

// Whether an RTMA fit can be trusted at all. `null` on any field means the
// backend could not read that diagnostic off the fit, which is not the same as
// the diagnostic being fine.
type RTMADiagnostics = {
  // Whether the mle_params() optimisation converged. This is the optimisation
  // that produces the reported mode (mu and tau), so a false here means those
  // point estimates are meaningless while the credible intervals, which are
  // posterior quantiles, are unaffected.
  optimConverged: boolean | null;
  // Gelman-Rubin convergence statistic; above 1.01 the chains disagree.
  rHat: RTMAParameterDiagnostic;
  // Effective sample size: how many independent draws the posterior summaries
  // are effectively based on.
  nEff: RTMAParameterDiagnostic;
  // Divergent transitions. Any at all mean the sampler could not explore part
  // of the posterior, so the intervals can be biased even at a healthy r_hat.
  divergences: number | null;
};

type RTMAResults = {
  mu: number;
  muCI: [number, number];
  tau: number;
  tauCI: [number, number];
  zScorePlot: string; // Base64 encoded image
  zScorePlotWidth: number;
  zScorePlotHeight: number;
  nonaffirmativeCount: number;
  nonaffirmativeProportion: number;
  // Conditions raised while fitting, most importantly a favored direction that
  // is opposite the pooled estimate. Optional because runs stored before the
  // backend started returning the field have no value for it.
  warnings?: string[];
  // Fields below are optional for the same stored-run reason (#481).
  // Posterior medians; the posterior is often skewed, so the mode alone
  // (reported as mu/tau) can sit near the edge of its own interval.
  muMedian?: number;
  tauMedian?: number;
  // Naive inverse-variance (fixed-effect) pooled mean of the analyzed
  // estimates, with no truncation correction.
  unadjustedMean?: number;
  // Level of the equal-tailed credible intervals in muCI and tauCI.
  ciLevel?: number;
  // RNG seed the sampler ran under. The credible intervals are posterior
  // quantiles, so they depend on it; runs stored before the backend pinned a
  // seed (#479) have no value and are not exactly reproducible.
  seed?: number;
  // Estimates analyzed after the se > 0 filter, the affirmative share of
  // them, and the uploaded rows removed by that filter.
  k?: number;
  affirmativeCount?: number;
  droppedRows?: number;
  // Convergence diagnostics for the fit (#480). Optional for the same
  // stored-run reason: runs from before the backend returned them cannot say
  // whether they converged, so their absence must not read as "all clear".
  diagnostics?: RTMADiagnostics;
};

// One local-linear fit of the jump in residual precision at a cutoff on |t|:
// the headline, a bandwidth-sensitivity refit, or a placebo threshold. A fit
// that could not be computed (too few estimates on a side) carries only
// `unavailable`, the reason, so the rest of the panel still renders.
type RDTFit = {
  jump: number;
  jumpSE: number;
  jumpCI: [number, number];
  pValue: number;
  bandwidth: number;
  /** Threshold on |t| the fit was estimated at (1.96 for the headline). */
  cutoff: number;
  nLeft: number;
  nRight: number;
  studies: number;
  unavailable?: undefined;
};

type RDTFitUnavailable = {
  unavailable: string;
};

// Results of the Residual Discontinuity Test (#559). A diagnostic, not an
// estimator: there is no corrected effect. `jump` is the discontinuity in the
// residual of log(SE) on log(N) at |t| = 1.96. Lower residual = more precise
// than sample size predicts, so the p-hacking signature is a negative jump.
type RDTResults = {
  /** Always "RDT"; first field of the payload so the shape is unambiguous. */
  model: "RDT";
  jump: number;
  jumpSE: number;
  jumpCI: [number, number];
  pValue: number;
  /** Satterthwaite degrees of freedom of the CR2 test on the jump. */
  df: number;
  cutoff: number;
  /** Effective bandwidth in log points. */
  bandwidth: number;
  /** The estimation window on the |t| scale. */
  windowT: [number, number];
  nLeft: number;
  nRight: number;
  /** Clusters inside the window: studies, or estimates when there is no study column. */
  studies: number;
  hasStudyColumn: boolean;
  /** Usable estimates after the row filter, and the rows that filter dropped. */
  k: number;
  droppedRows: number;
  /**
   * Smallest jump detectable with 80% power at the 5% level: the standard
   * error times the exact noncentral-t multiplier on `df`, which is about
   * 3.05 from df 12 and larger with fewer clusters (#573).
   */
  minDetectableJump: number;
  firstStage: {
    slope: number;
    rSquared: number;
  };
  sensitivity: {
    half: RDTFit | RDTFitUnavailable;
    double: RDTFit | RDTFitUnavailable;
  };
  placebo: {
    below: RDTFit | RDTFitUnavailable;
    above: RDTFit | RDTFitUnavailable;
  };
  warnings: string[];
  plot: string; // Base64 encoded image
  plotWidth: number;
  plotHeight: number;
};

// Any result payload a finished run can carry.
type RunResults = ModelResults | RTMAResults | RDTResults;

type PingResponse = {
  status: string;
  time: string;
};

// Async runs (queue) types -----------------------------------------------
// "expired" is a client-synthetic terminal status: the backend never writes it.
// It is assigned locally when a non-terminal run is past the 48h server TTL and
// its record is gone (see RunsWatcher / useRunStatus), so a stale run does not
// appear stuck on "running" forever.
type RunStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "timedout"
  | "expired";

// Response from POST /api/runs. `tooLarge` signals the client to fall back to
// the synchronous path (dataset too big to queue via SQS).
type SubmitRunResponse = {
  jobId?: string;
  tooLarge?: boolean;
  error?: string;
  resolvedParameters?: ResolvedParameters;
  recipe?: RecipeName | null;
};

// Response from GET /api/runs/{jobId}. `result` is the stringified
// ModelResults | RTMAResults, present only once `status` is terminal.
// `errorCode` is the R backend's structured code ("timeout", "worker_died";
// #526) threaded through the orchestrator and the runs table, so clients can
// key off it instead of parsing errorMessage or trusting the status heuristic.
// Optional: runs recorded before the code was threaded through have none.
type GetRunResponse = {
  jobId: string;
  status: RunStatus;
  modelType?: ModelParameters["modelType"];
  result?: string;
  errorMessage?: string;
  errorCode?: string;
  runDurationMs?: number;
  runTimestamp?: string;
  // The parameters the run was queued with, already resolved (#555). Absent
  // on runs recorded before they were stored.
  resolvedParameters?: ResolvedParameters;
  recipe?: RecipeName | null;
};

// API configuration
type ApiConfig = {
  baseUrl?: string;
  timeout?: number;
  headers?: Record<string, string>;
  signal?: AbortSignal;
};

export type {
  ModelParameters,
  ModelRequest,
  ModelResponse,
  ModelResults,
  RTMAParameters,
  RDTParameters,
  ResolvedParameters,
  RTMAResults,
  RDTFit,
  RDTFitUnavailable,
  RDTResults,
  RunResults,
  RTMADiagnostics,
  RTMAParameterDiagnostic,
  PingResponse,
  ApiConfig,
  ApiResponse,
  RunStatus,
  SubmitRunResponse,
  GetRunResponse,
};
