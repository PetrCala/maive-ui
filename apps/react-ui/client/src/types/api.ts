// API request and response types

type ApiResponse<T = unknown> = {
  data?: T;
  error?: string;
  message?: string;
  status?: string;
  time?: string;
};

type ModelParameters = {
  modelType: "MAIVE" | "WAIVE" | "WLS" | "RTMA";
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

// Legacy /run-model and /run-rtma contract: HTTP 200 with either { data } or
// an error flag. Since #526 the backend attaches a machine-readable `code`
// ("timeout", "worker_died") plus the budget and elapsed seconds, so the UI
// can say what actually happened instead of showing a generic failure.
type ModelResponse = {
  data: unknown[];
  error?: string | boolean;
  code?: string;
  message?: string;
  timeoutSeconds?: number;
  elapsedSeconds?: number;
};

type ModelResults = {
  effectEstimate: number;
  standardError: number;
  isSignificant: boolean;
  andersonRubinCI: [number, number] | "NA";
  publicationBias: {
    eggerCoef: number;
    eggerSE: number;
    isSignificant: boolean;
    eggerBootCI: [number, number] | "NA";
    eggerAndersonRubinCI: [number, number] | "NA";
    pValue?: number;
  };
  firstStageFStatistic: number | "NA";
  hausmanTest: {
    statistic: number;
    criticalValue: number;
    rejectsNull: boolean;
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
  peese_se2_coef?: number | null;
  peese_se2_se?: number | null;
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
};

type RTMAParameters = {
  modelType: "RTMA";
  favorPositive: boolean;
  alphaSelect: number;
  ciLevel: number;
  winsorize: number;
};

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
};

// Response from GET /api/runs/{jobId}. `result` is the stringified
// ModelResults | RTMAResults, present only once `status` is terminal.
type GetRunResponse = {
  jobId: string;
  status: RunStatus;
  modelType?: ModelParameters["modelType"];
  result?: string;
  errorMessage?: string;
  runDurationMs?: number;
  runTimestamp?: string;
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
  RTMAResults,
  RTMADiagnostics,
  RTMAParameterDiagnostic,
  PingResponse,
  ApiConfig,
  ApiResponse,
  RunStatus,
  SubmitRunResponse,
  GetRunResponse,
};
