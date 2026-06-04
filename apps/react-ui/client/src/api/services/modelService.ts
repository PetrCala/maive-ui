import type {
  DataArray,
  ModelRequest,
  ModelResponse,
  ModelParameters,
} from "@src/types";
import type {
  RTMAParameters,
  SubmitRunResponse,
  GetRunResponse,
} from "@src/types/api";
import { getRApiUrl } from "@api/utils/config";
import { httpGet, httpPost } from "@api/utils/http";

/**
 * Service for model-related API operations.
 * Isomorphic: in the browser it calls the R backend Function URL directly
 * (URL resolved from runtime config); server-side it uses the configured
 * R_API_URL. See getRApiUrl().
 */
export class ModelService {
  /**
   * Run a model with the given data and parameters
   * @param data - The data to process
   * @param parameters - Model parameters
   * @param abortController - Optional AbortController for cancelling the request
   * @returns Promise with model results
   */
  async runModel(
    data: DataArray,
    parameters: ModelParameters,
    abortController?: AbortController,
  ): Promise<ModelResponse> {
    const requestData: ModelRequest = {
      data: JSON.stringify(data),
      parameters: JSON.stringify(parameters),
    };

    try {
      return await httpPost<ModelResponse>(
        `${getRApiUrl()}/run-model`,
        requestData,
        {
          timeout: 300000, // 5 minutes for long-running models
          headers: {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            "Content-Type": "application/json",
          },
          signal: abortController?.signal,
        },
      );
    } catch (error: unknown) {
      throw new Error(
        `Failed to run model: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Run the RTMA model with the given data and parameters
   * @param data - The data to process
   * @param parameters - RTMA parameters
   * @param abortController - Optional AbortController for cancelling the request
   * @returns Promise with RTMA results
   */
  async runRTMA(
    data: DataArray,
    parameters: RTMAParameters,
    abortController?: AbortController,
  ): Promise<ModelResponse> {
    const requestData: ModelRequest = {
      data: JSON.stringify(data),
      parameters: JSON.stringify(parameters),
    };

    try {
      return await httpPost<ModelResponse>(
        `${getRApiUrl()}/run-rtma`,
        requestData,
        {
          timeout: 600000, // 10 minutes for MCMC sampling
          headers: {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            "Content-Type": "application/json",
          },
          signal: abortController?.signal,
        },
      );
    } catch (error: unknown) {
      throw new Error(
        `Failed to run RTMA model: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Submit a model run to the async queue (non-blocking).
   * Calls the same-origin UI Lambda route, which persists a queued job and
   * enqueues it for the orchestrator, returning a jobId. Returns
   * `{ tooLarge: true }` when the dataset is too large to queue — the caller
   * should then fall back to the synchronous runModel/runRTMA path.
   * @param data - The data to process
   * @param parameters - Model or RTMA parameters
   * @param dataId - Local dataset id (links the run to the browser's data)
   * @param modelType - The selected model type
   * @param abortController - Optional AbortController for cancelling the request
   */
  async submitRun(
    data: DataArray,
    parameters: ModelParameters | RTMAParameters,
    dataId: string,
    modelType: ModelParameters["modelType"],
    abortController?: AbortController,
  ): Promise<SubmitRunResponse> {
    try {
      return await httpPost<SubmitRunResponse>(
        "/api/runs",
        { data, parameters, dataId, modelType },
        {
          timeout: 30000,
          headers: {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            "Content-Type": "application/json",
          },
          signal: abortController?.signal,
        },
      );
    } catch (error: unknown) {
      throw new Error(
        `Failed to submit run: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Fetch the status (and result, once terminal) of an async run by jobId.
   * @param jobId - The run's job id
   */
  async getRun(jobId: string): Promise<GetRunResponse> {
    try {
      return await httpGet<GetRunResponse>(
        `/api/runs/${encodeURIComponent(jobId)}`,
        {
          timeout: 30000,
          headers: {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            "Content-Type": "application/json",
          },
        },
      );
    } catch (error: unknown) {
      throw new Error(
        `Failed to fetch run: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }
}

export const modelService = new ModelService();
