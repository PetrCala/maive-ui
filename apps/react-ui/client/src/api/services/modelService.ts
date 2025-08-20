import type { ModelRequest, ModelResponse, ModelParameters } from "../types";
import { getRApiUrl } from "../utils/config";
import { httpPost } from "../utils/http";

/**
 * Service for model-related API operations
 * This service runs server-side and calls the R-plumber service directly
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
    data: any[],
    parameters: ModelParameters,
    abortController?: AbortController,
  ): Promise<ModelResponse> {
    const requestData = {
      data,
      parameters,
    };

    try {
      return await httpPost<ModelResponse>(
        `${getRApiUrl()}/run-model`,
        requestData,
        {
          timeout: 300000, // 5 minutes for long-running models
          headers: {
            "Content-Type": "application/json",
          },
          signal: abortController?.signal,
        },
      );
    } catch (error: any) {
      throw new Error(
        `Failed to run model: ${error.message || "Unknown error"}`,
      );
    }
  }
}

export const modelService = new ModelService();
