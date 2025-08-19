import { describe, it, expect, vi, beforeEach } from "vitest";
import { modelService, pingService } from "../api/index";

// Mock the runtime config
vi.mock("@src/utils/getRuntimeConfig", () => ({
  getRuntimeConfig: () => ({ R_API_URL: "http://localhost:8787" }),
}));

describe("API Services", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("ModelService", () => {
    it("should create a model service instance", () => {
      expect(modelService).toBeDefined();
    });

    it("should have a runModel method", () => {
      expect(typeof modelService.runModel).toBe("function");
    });
  });

  describe("PingService", () => {
    it("should create a ping service instance", () => {
      expect(pingService).toBeDefined();
    });

    it("should have a ping method", () => {
      expect(typeof pingService.ping).toBe("function");
    });
  });
});
