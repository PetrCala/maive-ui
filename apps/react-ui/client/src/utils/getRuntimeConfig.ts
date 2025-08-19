export function getRuntimeConfig() {
  if (typeof window === "undefined") {
    return {};
  }

  const runtimeConfig = (window as any).RUNTIME_CONFIG || {};

  if (process.env.NODE_ENV === "development" && !runtimeConfig.R_API_URL) {
    const devApiUrl = process.env.NEXT_PUBLIC_DEV_R_API_URL;
    if (devApiUrl) {
      return {
        R_API_URL: devApiUrl,
      };
    }

    return {
      R_API_URL: "http://localhost:8787",
    };
  }

  return runtimeConfig;
}
