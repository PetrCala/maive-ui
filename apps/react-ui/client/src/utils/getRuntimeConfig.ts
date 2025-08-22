import type { RuntimeConfig } from "@src/types";

export function getRuntimeConfig() {
  if (typeof window === "undefined") {
    // During SSR, return empty config - the actual config will be loaded on the client
    return {};
  }

  // eslint-disable-next-line
  const runtimeConfig: RuntimeConfig = (window as any).RUNTIME_CONFIG ?? {};

  // In development, use the dev API URL if it is set
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
