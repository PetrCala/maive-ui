import { httpPost } from "../utils/http";
import { getDefaultApiConfig } from "../utils/config";
import type { ModelRequest, ModelResponse, ModelParameters } from "../types";

/**
 * Service for model-related API operations
 */
export class ModelService {
  private config = getDefaultApiConfig();

  /**
   * Run a model with the given data and parameters
   * @param data - The data to process
   * @param parameters - Model parameters
   * @param abortController - Optional AbortController for cancellation
   * @returns Promise with model results
   */
  async runModel(
    data: any[],
    parameters: ModelParameters,
    abortController?: AbortController,
  ): Promise<ModelResponse> {
    const requestData: ModelRequest = {
      file_data: JSON.stringify(data),
      parameters: JSON.stringify(parameters),
    };

    // Override the signal if an AbortController is provided
    const requestOptions: RequestInit = {};
    if (abortController) {
      requestOptions.signal = abortController.signal;
    }

    return httpPost<ModelResponse>(
      `${this.config.baseUrl}/run-model`,
      requestData,
      this.config,
    );
  }

  /**
   * Update the API configuration
   * @param config - New API configuration
   */
  updateConfig(config: Partial<typeof this.config>) {
    this.config = { ...this.config, ...config };
  }
}

// Export a singleton instance
export const modelService = new ModelService();
