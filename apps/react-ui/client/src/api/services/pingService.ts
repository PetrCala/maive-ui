import type { PingResponse } from "../types";
import { getRApiUrl } from "../utils/config";

/**
 * Service for ping operations
 * This service runs server-side and calls the R-plumber service directly
 */
export class PingService {
  /**
   * Ping the R backend service
   * @returns Promise with ping response
   */
  async ping(): Promise<PingResponse> {
    try {
      const response = await fetch(`${getRApiUrl()}/ping`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || `HTTP error! status: ${response.status}`,
        );
      }

      const result: PingResponse = await response.json();
      return result;
    } catch (error: any) {
      throw new Error(
        `Failed to ping R service: ${error.message || "Unknown error"}`,
      );
    }
  }
}

export const pingService = new PingService();
