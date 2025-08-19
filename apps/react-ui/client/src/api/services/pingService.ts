import { httpGet } from "../utils/http";
import { getDefaultApiConfig } from "../utils/config";
import type { PingResponse } from "../types";

/**
 * Service for ping-related API operations
 */
export class PingService {
  private config = getDefaultApiConfig();

  /**
   * Ping the server to check if it's alive
   * @returns Promise with ping response
   */
  async ping(): Promise<PingResponse> {
    return httpGet<PingResponse>(`${this.config.baseUrl}/ping`, this.config);
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
export const pingService = new PingService();
