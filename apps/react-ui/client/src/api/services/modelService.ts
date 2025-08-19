import { httpPost } from "../utils/http";
import { getDefaultApiConfig } from "../utils/config";
import type { ModelRequest, ModelResponse, ModelParameters } from "../types";

/**
 * Service for model-related API operations
 */
export class ModelService {
  private config: ReturnType<typeof getDefaultApiConfig> | null = null;

  /**
   * Get the API configuration, initializing it if needed
   * @returns API configuration
   */
  private getConfig() {
    if (!this.config) {
      this.config = getDefaultApiConfig();
    }
    return this.config;
  }

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

    const config = this.getConfig();

    return httpPost<ModelResponse>(
      `${config.baseUrl}/run-model`,
      requestData,
      config,
    );
  }

  /**
   * Update the API configuration
   * @param config - New API configuration
   */
  updateConfig(config: Partial<ReturnType<typeof getDefaultApiConfig>>) {
    if (this.config) {
      this.config = { ...this.config, ...config };
    } else {
      this.config = { ...getDefaultApiConfig(), ...config };
    }
  }
}

// Export a singleton instance
export const modelService = new ModelService();
