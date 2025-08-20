import type { ModelRequest, ModelResponse, ModelParameters } from "../types";
import { getRApiUrl } from "../utils/config";

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
      const response = await fetch(`${getRApiUrl()}/run-model`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || `HTTP error! status: ${response.status}`,
        );
      }

      const result: ModelResponse = await response.json();
      return result;
    } catch (error: any) {
      throw new Error(
        `Failed to run model: ${error.message || "Unknown error"}`,
      );
    }
  }
}

export const modelService = new ModelService();
