import { getRuntimeConfig } from "@src/utils/getRuntimeConfig";

/**
 * Get the R API URL for the current environment
 * This function works both client-side and server-side
 * @returns The R API URL
 */
export function getRApiUrl(): string {
  // Server-side: check environment variables first
  if (typeof window === "undefined") {
    return (
      process.env.NEXT_PUBLIC_R_API_URL ||
      process.env.R_API_URL ||
      "http://localhost:8787"
    );
  }

  // Client-side: try to get URL from runtime config
  const { R_API_URL } = getRuntimeConfig();

  if (R_API_URL) {
    return R_API_URL;
  }

  // Handle development fallback
  if (process.env.NODE_ENV === "development") {
    console.warn(
      "R API URL not configured. Using fallback for development. " +
        "Set NEXT_PUBLIC_DEV_R_API_URL in .env.local for custom development URL.",
    );
    return "http://localhost:8787";
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
    baseUrl: getRApiUrl(), // Now uses the single source of truth
    timeout: 30000, // 30 seconds
    headers: {
      "Content-Type": "application/json",
    },
  };
}
