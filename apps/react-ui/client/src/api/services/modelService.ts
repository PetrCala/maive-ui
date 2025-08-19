import type { ModelRequest, ModelResponse, ModelParameters } from "../types";

/**
 * Service for model-related API operations
 * This service calls our Next.js API routes, which then make server-side calls to the R-plumber service
 */
export class ModelService {
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
    const requestData = {
      data,
      parameters,
    };

    const controller = abortController || new AbortController();

    try {
      const response = await fetch("/api/run-model", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestData),
        signal: controller.signal,
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
      if (error.name === "AbortError") {
        throw error;
      }

      // Re-throw with more context
      throw new Error(
        `Failed to run model: ${error.message || "Unknown error"}`,
      );
    }
  }
}

export const modelService = new ModelService();
