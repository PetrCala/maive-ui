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

type ModelResponse = {
  data: unknown[];
  error?: string;
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

// Error types
type ApiError = {
  message: string;
  status?: number;
  code?: string;
};

export type {
  ModelParameters,
  ModelRequest,
  ModelResponse,
  ModelResults,
  RTMAParameters,
  RTMAResults,
  PingResponse,
  ApiConfig,
  ApiError,
  ApiResponse,
  RunStatus,
  SubmitRunResponse,
  GetRunResponse,
};
