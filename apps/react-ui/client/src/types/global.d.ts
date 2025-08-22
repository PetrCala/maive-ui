import type RuntimeConfig from "./RuntimeConfig";

export {};

declare global {
  type ExtendedWindow = Window & {
    RUNTIME_CONFIG?: RuntimeConfig;
  };
}
