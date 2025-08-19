import type { PingResponse } from "../types";

/**
 * Service for ping operations
 * This service calls our Next.js API routes, which then make server-side calls to the R-plumber service
 */
export class PingService {
  /**
   * Ping the service to check connectivity
   * @returns Promise with ping response
   */
  async ping(): Promise<PingResponse> {
    try {
      const response = await fetch("/api/ping", {
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
      // Re-throw with more context
      throw new Error(
        `Failed to ping service: ${error.message || "Unknown error"}`,
      );
    }
  }
}

export const pingService = new PingService();
