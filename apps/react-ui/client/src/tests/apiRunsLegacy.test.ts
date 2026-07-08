import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createMockReq, createMockRes } from "@tests/helpers/nextApiMocks";

const { ddbSendMock, sqsSendMock } = vi.hoisted(() => ({
  ddbSendMock: vi.fn(),
  sqsSendMock: vi.fn(),
}));

vi.mock("@aws-sdk/client-dynamodb", () => ({
  DynamoDBClient: vi.fn(),
}));
vi.mock("@aws-sdk/lib-dynamodb", () => ({
  DynamoDBDocumentClient: { from: vi.fn(() => ({ send: ddbSendMock })) },
  PutCommand: vi.fn((input: unknown) => ({ input })),
  GetCommand: vi.fn((input: unknown) => ({ input })),
  BatchGetCommand: vi.fn((input: unknown) => ({ input })),
}));
vi.mock("@aws-sdk/client-sqs", () => ({
  SQSClient: vi.fn(() => ({ send: sqsSendMock })),
  SendMessageCommand: vi.fn((input: unknown) => ({ input })),
}));

const ENV_KEYS = ["AWS_REGION", "RUNS_TABLE_NAME", "RUNS_QUEUE_URL"] as const;
const savedEnv: Record<string, string | undefined> = {};

const setConfigured = () => {
  process.env.AWS_REGION = "us-east-1";
  process.env.RUNS_TABLE_NAME = "runs-table";
  process.env.RUNS_QUEUE_URL = "https://sqs.example/queue";
};

beforeEach(() => {
  ENV_KEYS.forEach((key) => {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  });
  vi.resetModules();
  ddbSendMock.mockReset();
  sqsSendMock.mockReset();
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

describe("legacy /api/runs (unchanged behavior)", () => {
  it("503s with a plain error string when not configured", async () => {
    const { default: handler } = await import("@src/pages/api/runs");
    const req = createMockReq({ method: "POST" });
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(503);
    expect(res.body).toEqual({ error: "Async runs are not configured." });
  });

  it("returns 200 { tooLarge: true } for an oversized submission", async () => {
    setConfigured();
    const { default: handler } = await import("@src/pages/api/runs");
    const req = createMockReq({
      method: "POST",
      body: {
        data: "x".repeat(300 * 1024),
        parameters: {},
        modelType: "MAIVE",
      },
    });
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ tooLarge: true });
    expect(ddbSendMock).not.toHaveBeenCalled();
    expect(sqsSendMock).not.toHaveBeenCalled();
  });

  it("400s on missing required fields, with no server-side dataset validation", async () => {
    setConfigured();
    const { default: handler } = await import("@src/pages/api/runs");
    const req = createMockReq({
      method: "POST",
      body: { data: [{ effect: 1 }] },
    });
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({
      error: "Missing required fields: data, parameters, modelType.",
    });
  });

  it("queues a valid submission and returns 200 { jobId } — no dataset shape enforced", async () => {
    setConfigured();
    ddbSendMock.mockResolvedValue({});
    sqsSendMock.mockResolvedValue({});
    const { default: handler } = await import("@src/pages/api/runs");
    // Only 1 row / missing n_obs — the legacy route never validated shape.
    const req = createMockReq({
      method: "POST",
      body: {
        data: [{ effect: 1, se: 0.1 }],
        parameters: { modelType: "MAIVE" },
        modelType: "MAIVE",
      },
    });
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("jobId");
    expect(ddbSendMock).toHaveBeenCalledTimes(1);
    expect(sqsSendMock).toHaveBeenCalledTimes(1);
  });

  it("returns [] for GET with no ids, without hitting DynamoDB", async () => {
    setConfigured();
    const { default: handler } = await import("@src/pages/api/runs");
    const req = createMockReq({ method: "GET", query: {} });
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual([]);
    expect(ddbSendMock).not.toHaveBeenCalled();
  });

  it("batch-fetches statuses for GET ?ids=a,b", async () => {
    setConfigured();
    const responses: Record<string, unknown[]> = {};
    responses["runs-table"] = [
      { jobId: "a", status: "succeeded", modelType: "MAIVE" },
      { jobId: "b", status: "running", modelType: "MAIVE" },
    ];
    ddbSendMock.mockResolvedValue({ Responses: responses });
    const { default: handler } = await import("@src/pages/api/runs");
    const req = createMockReq({ method: "GET", query: { ids: "a,b" } });
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual([
      {
        jobId: "a",
        status: "succeeded",
        modelType: "MAIVE",
        errorMessage: undefined,
        runDurationMs: undefined,
        runTimestamp: undefined,
      },
      {
        jobId: "b",
        status: "running",
        modelType: "MAIVE",
        errorMessage: undefined,
        runDurationMs: undefined,
        runTimestamp: undefined,
      },
    ]);
  });

  it("405s for unsupported methods", async () => {
    setConfigured();
    const { default: handler } = await import("@src/pages/api/runs");
    const req = createMockReq({ method: "DELETE" });
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(405);
    expect(res.body).toEqual({ error: "Method Not Allowed" });
  });
});
