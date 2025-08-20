// API request and response types

export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  message?: string;
  status?: string;
  time?: string;
}

export interface ModelParameters {
  modelType: "MAIVE" | "WAIVE";
  includeStudyDummies: boolean;
  includeStudyClustering: boolean;
  standardErrorTreatment:
    | "not_clustered"
    | "clustered"
    | "clustered_cr2"
    | "bootstrap";
  computeAndersonRubin: boolean;
  maiveMethod: "PET" | "PEESE" | "PET-PEESE" | "EK";
  shouldUseInstrumenting: boolean;
}

export interface ModelRequest {
  file_data: string; // JSON stringified data
  parameters: string; // JSON stringified parameters
}

export interface ModelResponse {
  data: any[];
  error?: string;
}

export interface PingResponse {
  status: string;
  time: string;
}

// API configuration
export interface ApiConfig {
  baseUrl?: string;
  timeout?: number;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

// Error types
export interface ApiError {
  message: string;
  status?: number;
  code?: string;
}
