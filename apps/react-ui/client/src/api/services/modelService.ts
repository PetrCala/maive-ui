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
   * @returns Promise with model results
   */
  async runModel(
    data: any[],
    parameters: ModelParameters,
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
