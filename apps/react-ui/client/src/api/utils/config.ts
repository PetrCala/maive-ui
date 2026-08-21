function sanitizeUrl(url: string) {
  return url.replace(/\/+$/, "");
}

/**
 * Get the R API URL. Server-only since #530: the R backend Function URL
 * requires IAM auth, so the browser talks to same-origin /api routes and the
 * server resolves (and signs for) the compute endpoint.
 * @returns The R API URL
 */
export function getRApiUrl(): string {
  if (typeof window !== "undefined") {
    throw new Error(
      "getRApiUrl is server-only. Browser code must call the /api proxy routes instead of the R backend.",
    );
  }

  return sanitizeUrl(
    process.env.R_API_URL ??
      process.env.NEXT_PUBLIC_DEV_R_API_URL ??
      "http://localhost:8787",
  );
}

/**
 * Get default API configuration
 * @returns Default API configuration
 */
export function getDefaultApiConfig() {
  return {
    timeout: 30000, // 30 seconds
    headers: {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      "Content-Type": "application/json",
    },
  };
}
