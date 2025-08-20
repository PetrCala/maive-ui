import type { PingResponse } from "../types";
import { getRApiUrl } from "../utils/config";
import { httpGet } from "../utils/http";

/**
 * Service for ping operations
 * This service runs server-side and calls the R-plumber service directly
 */
export class PingService {
  /**
   * Ping the R backend service
   * @param abortController - Optional AbortController for cancelling the request
   * @returns Promise with ping response
   */
  async ping(abortController?: AbortController): Promise<PingResponse> {
    try {
      // Call R backend directly using the existing httpGet utility
      return await httpGet<PingResponse>(`${getRApiUrl()}/ping`, {
        timeout: 30000, // 30 seconds for ping
        headers: {
          "Content-Type": "application/json",
        },
        signal: abortController?.signal,
      });
    } catch (error: any) {
      throw new Error(
        `Failed to ping R service: ${error.message || "Unknown error"}`,
      );
    }
  }
}

export const pingService = new PingService();
