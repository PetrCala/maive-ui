import { getRuntimeConfig } from "@src/utils/getRuntimeConfig";

/**
 * Get the fallback URL for development/SSR scenarios
 * @returns Fallback URL
 */
function getFallbackUrl(): string {
  return "http://localhost:8787";
}

/**
 * Check if we're in a server-side rendering environment
 * @returns True if running on server
 */
function isServerSide(): boolean {
  return typeof window === "undefined";
}

/**
 * Check if we're in development mode
 * @returns True if in development
 */
function isDevelopment(): boolean {
  return process.env.NODE_ENV === "development";
}

/**
 * Get the API base URL for the current environment
 * @returns The API base URL
 */
export function getApiBaseUrl(): string {
  // Handle server-side rendering
  if (isServerSide()) {
    return getFallbackUrl();
  }

  // Try to get URL from runtime config
  const { R_API_URL } = getRuntimeConfig();

  if (R_API_URL) {
    return R_API_URL;
  }

  // Handle development fallback
  if (isDevelopment()) {
    console.warn(
      "R API URL not configured. Using fallback for development. " +
        "Set NEXT_PUBLIC_DEV_R_API_URL in .env.local for custom development URL.",
    );
    return getFallbackUrl();
  }

  // Production error
  throw new Error(
    "R API URL not configured. Please check your environment configuration.",
  );
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
