import { getRuntimeConfig } from "@src/utils/getRuntimeConfig";

/**
 * Get the API base URL for the current environment
 * @returns The API base URL
 */
export function getApiBaseUrl(): string {
  const { R_API_URL } = getRuntimeConfig();

  if (!R_API_URL) {
    throw new Error(
      "R API URL not configured. Please check your environment configuration.",
    );
  }

  return R_API_URL;
}

/**
 * Get default API configuration
 * @returns Default API configuration
 */
export function getDefaultApiConfig() {
  return {
    baseUrl: getApiBaseUrl(),
    timeout: 30000, // 30 seconds
    headers: {
      "Content-Type": "application/json",
    },
  };
}
