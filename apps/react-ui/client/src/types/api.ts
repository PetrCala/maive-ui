// API request and response types

type ApiResponse<T = unknown> = {
  data?: T;
  error?: string;
  message?: string;
  status?: string;
  time?: string;
};

type ModelParameters = {
  modelType: "MAIVE" | "WAIVE" | "WLS";
  includeStudyDummies: boolean;
  includeStudyClustering: boolean;
  standardErrorTreatment:
    | "not_clustered"
    | "clustered"
    | "clustered_cr2"
    | "bootstrap";
  computeAndersonRubin: boolean;
  maiveMethod: "PET" | "PEESE" | "PET-PEESE" | "EK";
  weight: "equal_weights" | "standard_weights" | "adjusted_weights" | "study_weights";
  shouldUseInstrumenting: boolean;
  useLogFirstStage: boolean;
  winsorize: number;
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
  firstStageFTest: number | "NA";
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
};

type PingResponse = {
  status: string;
  time: string;
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
  PingResponse,
  ApiConfig,
  ApiError,
  ApiResponse,
};
