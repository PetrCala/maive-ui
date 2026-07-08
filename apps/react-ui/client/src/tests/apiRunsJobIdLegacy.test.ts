import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createMockReq, createMockRes } from "@tests/helpers/nextApiMocks";

const { ddbSendMock } = vi.hoisted(() => ({
  ddbSendMock: vi.fn(),
}));

vi.mock("@aws-sdk/client-dynamodb", () => ({
  DynamoDBClient: vi.fn(),
}));
vi.mock("@aws-sdk/lib-dynamodb", () => ({
  DynamoDBDocumentClient: { from: vi.fn(() => ({ send: ddbSendMock })) },
  GetCommand: vi.fn((input: unknown) => ({ input })),
}));

const ENV_KEYS = ["AWS_REGION", "RUNS_TABLE_NAME"] as const;
const savedEnv: Record<string, string | undefined> = {};

const setConfigured = () => {
  process.env.AWS_REGION = "us-east-1";
  process.env.RUNS_TABLE_NAME = "runs-table";
};

beforeEach(() => {
  ENV_KEYS.forEach((key) => {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  });
  vi.resetModules();
  ddbSendMock.mockReset();
});

afterEach(() => {
  ENV_KEYS.forEach((key) => {
    if (savedEnv[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = savedEnv[key];
    }
  });
});

describe("legacy /api/runs/[jobId] (unchanged behavior)", () => {
  it("405s for non-GET methods", async () => {
    const { default: handler } = await import("@src/pages/api/runs/[jobId]");
    const req = createMockReq({ method: "POST" });
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(405);
    expect(res.body).toEqual({ error: "Method Not Allowed" });
  });

  it("503s with a plain error string when not configured", async () => {
    const { default: handler } = await import("@src/pages/api/runs/[jobId]");
    const req = createMockReq({ method: "GET", query: { jobId: "abc" } });
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(503);
    expect(res.body).toEqual({ error: "Async runs are not configured." });
  });

  it("404s for an unknown job id", async () => {
    setConfigured();
    ddbSendMock.mockResolvedValue({ Item: undefined });
    const { default: handler } = await import("@src/pages/api/runs/[jobId]");
    const req = createMockReq({ method: "GET", query: { jobId: "missing" } });
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ error: "Run not found or expired." });
  });

  it("returns `result` as the raw stored string (not parsed)", async () => {
    setConfigured();
    const storedResult = JSON.stringify({
      effectEstimate: 0.5,
      funnelPlot: "base64==",
    });
    ddbSendMock.mockResolvedValue({
      Item: {
        jobId: "abc",
        status: "succeeded",
        modelType: "MAIVE",
        result: storedResult,
        submittedAt: 1700000000000,
      },
    });
    const { default: handler } = await import("@src/pages/api/runs/[jobId]");
    const req = createMockReq({ method: "GET", query: { jobId: "abc" } });
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      jobId: "abc",
      status: "succeeded",
      modelType: "MAIVE",
      result: storedResult,
    });
    expect(typeof (res.body as { result?: unknown }).result).toBe("string");
  });
});
