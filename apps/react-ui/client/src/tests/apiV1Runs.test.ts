import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createMockReq, createMockRes } from "@tests/helpers/nextApiMocks";

const { ddbSendMock, sqsSendMock } = vi.hoisted(() => ({
  ddbSendMock: vi.fn<[{ input: unknown }], Promise<unknown>>(),
  sqsSendMock: vi.fn<[{ input: unknown }], Promise<unknown>>(),
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

const validMaiveData = [
  { effect: 0.42, se: 0.11, n_obs: 120 },
  { effect: 0.31, se: 0.06, n_obs: 90 },
  { effect: 0.55, se: 0.2, n_obs: 45 },
  { effect: 0.12, se: 0.04, n_obs: 200 },
];

type PutCall = {
  input: { Item: { modelType: string; parameters: string } };
};

const getLastPutCall = (): PutCall =>
  ddbSendMock.mock.calls[ddbSendMock.mock.calls.length - 1][0] as PutCall;

type SendMessageCall = { input: { MessageBody: string } };

const getLastQueuedMessage = (): Record<string, unknown> => {
  const call = sqsSendMock.mock.calls[
    sqsSendMock.mock.calls.length - 1
  ][0] as SendMessageCall;
  return JSON.parse(call.input.MessageBody) as Record<string, unknown>;
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

describe("POST /api/v1/runs", () => {
  it("503s with the error envelope when not configured", async () => {
    const { default: handler } = await import("@src/pages/api/v1/runs");
    const req = createMockReq({
      method: "POST",
      body: { data: validMaiveData },
    });
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(503);
    expect(res.body).toEqual({
      error: {
        code: "not_configured",
        message: "Async runs are not configured.",
      },
    });
  });

  it("400s with validation_error for an invalid dataset", async () => {
    setConfigured();
    const { default: handler } = await import("@src/pages/api/v1/runs");
    const req = createMockReq({
      method: "POST",
      body: { data: [{ effect: 1, se: 0.1 }] }, // only 2 rows, missing n_obs
    });
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ error: { code: "validation_error" } });
    expect(ddbSendMock).not.toHaveBeenCalled();
    expect(sqsSendMock).not.toHaveBeenCalled();
  });

  it("413s with payload_too_large for an oversized submission (not the legacy tooLarge signal)", async () => {
    setConfigured();
    const { default: handler } = await import("@src/pages/api/v1/runs");
    // Comfortably above the ~900 KiB budget.
    const bigData = Array.from({ length: 4 }, (_, i) => ({
      effect: 0.1 + i,
      se: 0.1,
      n_obs: 10,
      study_id: "x".repeat(300 * 1024),
    }));
    const req = createMockReq({ method: "POST", body: { data: bigData } });
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(413);
    expect(res.body).toMatchObject({ error: { code: "payload_too_large" } });
  });

  it("queues a submission between the 200 KiB and ~900 KiB budget instead of 413ing", async () => {
    setConfigured();
    ddbSendMock.mockResolvedValue({});
    sqsSendMock.mockResolvedValue({});
    const { default: handler } = await import("@src/pages/api/v1/runs");
    // Above the old 200 KiB cap, comfortably under the ~900 KiB budget.
    const midData = Array.from({ length: 4 }, (_, i) => ({
      effect: 0.1 + i,
      se: 0.1,
      n_obs: 10,
      study_id: "x".repeat(100 * 1024),
    }));
    const req = createMockReq({ method: "POST", body: { data: midData } });
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("jobId");
    expect(ddbSendMock).toHaveBeenCalledTimes(1);
    expect(sqsSendMock).toHaveBeenCalledTimes(1);
  });

  it("applies CONFIG.DEFAULT_MODEL_PARAMETERS defaults and derives shouldUseInstrumenting when parameters/modelType are omitted", async () => {
    setConfigured();
    ddbSendMock.mockResolvedValue({});
    sqsSendMock.mockResolvedValue({});
    const { default: handler } = await import("@src/pages/api/v1/runs");
    const req = createMockReq({
      method: "POST",
      body: { data: validMaiveData },
    });
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("jobId");

    const putCall = getLastPutCall();
    expect(putCall.input.Item.modelType).toBe("MAIVE");
    const storedParameters = JSON.parse(
      putCall.input.Item.parameters,
    ) as Record<string, unknown>;
    expect(storedParameters).toMatchObject({
      modelType: "MAIVE",
      shouldUseInstrumenting: true,
      maiveMethod: "PET-PEESE",
    });
  });

  it("derives shouldUseInstrumenting=false for modelType WLS", async () => {
    setConfigured();
    ddbSendMock.mockResolvedValue({});
    sqsSendMock.mockResolvedValue({});
    const { default: handler } = await import("@src/pages/api/v1/runs");
    const req = createMockReq({
      method: "POST",
      body: { data: validMaiveData, modelType: "WLS" },
    });
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    const putCall = getLastPutCall();
    const storedParameters = JSON.parse(
      putCall.input.Item.parameters,
    ) as Record<string, unknown>;
    expect(storedParameters).toMatchObject({
      modelType: "WLS",
      shouldUseInstrumenting: false,
    });
  });

  it("routes modelType RTMA to RTMA defaults and skips the MAIVE-family row/column checks", async () => {
    setConfigured();
    ddbSendMock.mockResolvedValue({});
    sqsSendMock.mockResolvedValue({});
    const { default: handler } = await import("@src/pages/api/v1/runs");
    const req = createMockReq({
      method: "POST",
      body: {
        data: [
          { effect: 0.1, se: 0.1 },
          { effect: 0.2, se: 0.2 },
        ],
        modelType: "RTMA",
      },
    });
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    const putCall = getLastPutCall();
    expect(putCall.input.Item.modelType).toBe("RTMA");
    const storedParameters = JSON.parse(
      putCall.input.Item.parameters,
    ) as Record<string, unknown>;
    expect(storedParameters).toEqual({
      modelType: "RTMA",
      favorPositive: true,
      alphaSelect: 0.05,
      ciLevel: 0.95,
      winsorize: 0,
    });
  });

  it("queues RTMA rows in canonical column order even when effect/se keys are swapped (#488)", async () => {
    setConfigured();
    ddbSendMock.mockResolvedValue({});
    sqsSendMock.mockResolvedValue({});
    const { default: handler } = await import("@src/pages/api/v1/runs");
    const req = createMockReq({
      method: "POST",
      body: {
        // Same repro shape as the issue: `se` named first, `effect` second.
        // The orchestrator posts queued rows to the legacy positional
        // /run-rtma route, so this must land in the queue as effect-then-se
        // regardless of the submitted key order.
        data: [
          { se: 0.12, effect: -0.4 },
          { se: 0.08, effect: 0.25 },
        ],
        modelType: "RTMA",
      },
    });
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    const queued = getLastQueuedMessage();
    expect(queued.data).toEqual([
      { effect: -0.4, se: 0.12 },
      { effect: 0.25, se: 0.08 },
    ]);
  });

  it("leaves already-canonical MAIVE rows unchanged in the queued message", async () => {
    setConfigured();
    ddbSendMock.mockResolvedValue({});
    sqsSendMock.mockResolvedValue({});
    const { default: handler } = await import("@src/pages/api/v1/runs");
    const req = createMockReq({
      method: "POST",
      body: { data: validMaiveData },
    });
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    const queued = getLastQueuedMessage();
    expect(queued.data).toEqual(validMaiveData);
  });

  it("405s with method_not_allowed for unsupported methods", async () => {
    setConfigured();
    const { default: handler } = await import("@src/pages/api/v1/runs");
    const req = createMockReq({ method: "DELETE" });
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(405);
    expect(res.body).toMatchObject({ error: { code: "method_not_allowed" } });
  });
});

describe("GET /api/v1/runs (batch status)", () => {
  it("returns [] for no ids without hitting DynamoDB", async () => {
    setConfigured();
    const { default: handler } = await import("@src/pages/api/v1/runs");
    const req = createMockReq({ method: "GET", query: {} });
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual([]);
    expect(ddbSendMock).not.toHaveBeenCalled();
  });

  it("returns statuses only (no results) for a valid id list", async () => {
    setConfigured();
    const responses: Record<string, unknown[]> = {};
    responses["runs-table"] = [
      { jobId: "a", status: "queued", modelType: "MAIVE" },
    ];
    ddbSendMock.mockResolvedValue({ Responses: responses });
    const { default: handler } = await import("@src/pages/api/v1/runs");
    const req = createMockReq({ method: "GET", query: { ids: "a" } });
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual([
      {
        jobId: "a",
        status: "queued",
        modelType: "MAIVE",
        errorMessage: undefined,
        runDurationMs: undefined,
        runTimestamp: undefined,
      },
    ]);
  });
});
