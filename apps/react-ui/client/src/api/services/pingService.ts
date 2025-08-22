import type { PingResponse } from "@src/types";
import { getRApiUrl } from "@api/utils/config";
import { httpGet } from "@api/utils/http";

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
      return await httpGet<PingResponse>(`${getRApiUrl()}/ping`, {
        timeout: 30000, // 30 seconds for ping
        headers: {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          "Content-Type": "application/json",
        },
        signal: abortController?.signal,
      });
    } catch (error: unknown) {
      throw new Error(
        `Failed to ping R service: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }
}

export const pingService = new PingService();
