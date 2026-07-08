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

describe("GET /api/v1/runs/[jobId]", () => {
  it("405s with the error envelope for non-GET methods", async () => {
    const { default: handler } = await import("@src/pages/api/v1/runs/[jobId]");
    const req = createMockReq({ method: "POST" });
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(405);
    expect(res.body).toMatchObject({ error: { code: "method_not_allowed" } });
  });

  it("503s with not_configured when async runs aren't configured", async () => {
    const { default: handler } = await import("@src/pages/api/v1/runs/[jobId]");
    const req = createMockReq({ method: "GET", query: { jobId: "abc" } });
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(503);
    expect(res.body).toMatchObject({ error: { code: "not_configured" } });
  });

  it("404s with not_found for an unknown/expired job id", async () => {
    setConfigured();
    ddbSendMock.mockResolvedValue({ Item: undefined });
    const { default: handler } = await import("@src/pages/api/v1/runs/[jobId]");
    const req = createMockReq({ method: "GET", query: { jobId: "missing" } });
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({
      error: { code: "not_found", message: "Run not found or expired." },
    });
  });

  it("returns `result` as a parsed object with plot fields stripped by default", async () => {
    setConfigured();
    const storedResult = {
      effectEstimate: 0.5,
      standardError: 0.1,
      funnelPlot: "base64==",
      funnelPlotWidth: 400,
      funnelPlotHeight: 300,
    };
    ddbSendMock.mockResolvedValue({
      Item: {
        jobId: "abc",
        status: "succeeded",
        modelType: "MAIVE",
        result: JSON.stringify(storedResult),
        submittedAt: 1700000000000,
      },
    });
    const { default: handler } = await import("@src/pages/api/v1/runs/[jobId]");
    const req = createMockReq({ method: "GET", query: { jobId: "abc" } });
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    const body = res.body as { result?: Record<string, unknown> };
    expect(typeof body.result).toBe("object");
    expect(body.result).toEqual({
      effectEstimate: 0.5,
      standardError: 0.1,
    });
  });

  it("includes plot fields when ?include=plot is set", async () => {
    setConfigured();
    const storedResult = {
      effectEstimate: 0.5,
      funnelPlot: "base64==",
      funnelPlotWidth: 400,
      funnelPlotHeight: 300,
    };
    ddbSendMock.mockResolvedValue({
      Item: {
        jobId: "abc",
        status: "succeeded",
        modelType: "MAIVE",
        result: JSON.stringify(storedResult),
      },
    });
    const { default: handler } = await import("@src/pages/api/v1/runs/[jobId]");
    const req = createMockReq({
      method: "GET",
      query: { jobId: "abc", include: "plot" },
    });
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    const body = res.body as { result?: Record<string, unknown> };
    expect(body.result).toEqual(storedResult);
  });

  it("strips zScorePlot fields for RTMA results", async () => {
    setConfigured();
    const storedResult = {
      mu: 0.2,
      tau: 0.1,
      zScorePlot: "base64==",
      zScorePlotWidth: 400,
      zScorePlotHeight: 300,
    };
    ddbSendMock.mockResolvedValue({
      Item: {
        jobId: "abc",
        status: "succeeded",
        modelType: "RTMA",
        result: JSON.stringify(storedResult),
      },
    });
    const { default: handler } = await import("@src/pages/api/v1/runs/[jobId]");
    const req = createMockReq({ method: "GET", query: { jobId: "abc" } });
    const res = createMockRes();

    await handler(req, res);

    expect(res.body).toMatchObject({ result: { mu: 0.2, tau: 0.1 } });
    const body = res.body as { result?: Record<string, unknown> };
    expect(body.result).not.toHaveProperty("zScorePlot");
  });
});
