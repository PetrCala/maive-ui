import { httpGet } from "../utils/http";
import { getDefaultApiConfig } from "../utils/config";
import type { PingResponse } from "../types";

/**
 * Service for ping-related API operations
 */
export class PingService {
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
   * Ping the server to check if it's alive
   * @returns Promise with ping response
   */
  async ping(): Promise<PingResponse> {
    const config = this.getConfig();
    return httpGet<PingResponse>(`${config.baseUrl}/ping`, config);
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
export const pingService = new PingService();
