import type { PingResponse } from "@src/types";
import { httpGet } from "@api/utils/http";

/**
 * Service for ping operations. Client-side only: it calls the same-origin
 * /api/ping route, which signs and forwards to the IAM-protected R backend
 * (#530).
 */
export class PingService {
  /**
   * Ping the R backend service via the server-side proxy route
   * @param abortController - Optional AbortController for cancelling the request
   * @returns Promise with ping response
   */
  async ping(abortController?: AbortController): Promise<PingResponse> {
    try {
      return await httpGet<PingResponse>("/api/ping", {
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
