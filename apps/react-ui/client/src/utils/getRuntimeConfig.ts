import type { RuntimeConfig } from "@src/types";

export function getRuntimeConfig() {
  if (typeof window === "undefined") {
    // During SSR, return empty config - the actual config will be loaded on the client
    return {};
  }

  const runtimeConfig: RuntimeConfig = (window as ExtendedWindow)
    .RUNTIME_CONFIG ?? {
    R_API_URL: "",
  };

  if (!runtimeConfig.R_API_URL) {
    throw new Error("R_API_URL is not set");
  }

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
