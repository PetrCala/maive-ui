export function getRuntimeConfig() {
  if (typeof window === "undefined") {
    // During SSR, return empty config - the actual config will be loaded on the client
    return {};
  }

  const runtimeConfig = (window as any).RUNTIME_CONFIG || {};

  // In development mode, if RUNTIME_CONFIG is not available, use a fallback
  if (process.env.NODE_ENV === "development" && !runtimeConfig.R_API_URL) {
    // Check if there's a development environment variable set
    const devApiUrl = process.env.NEXT_PUBLIC_DEV_R_API_URL;
    if (devApiUrl) {
      return {
        R_API_URL: devApiUrl,
      };
    }

    // Default to localhost for development
    return {
      R_API_URL: "http://localhost:8787",
    };
  }

  return runtimeConfig;
}
