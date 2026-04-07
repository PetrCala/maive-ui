import type {
  DataArray,
  ModelRequest,
  ModelResponse,
  ModelParameters,
} from "@src/types";
import type { RTMAParameters } from "@src/types/api";
import { getRApiUrl } from "@api/utils/config";
import { httpPost } from "@api/utils/http";

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
}

export const modelService = new ModelService();
