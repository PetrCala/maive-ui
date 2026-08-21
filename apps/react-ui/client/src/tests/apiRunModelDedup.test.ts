// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockReq, createMockRes } from "@tests/helpers/nextApiMocks";
import type { MockResponse } from "@tests/helpers/nextApiMocks";
import {
  DEDUP_REPLAY_SUFFIX,
  DEDUP_RUNNING_MESSAGE,
  RUNNING_FRESH_MS,
} from "@api/server/runRecords";

// Sync model routes with the run-record layer (#529): identical in-flight or
// recently timed out inputs are answered from the maive-runs record instead
// of hitting the R backend, and every executed run writes a start + terminal
// record around the proxied call.

const { ddbSendMock } = vi.hoisted(() => ({ ddbSendMock: vi.fn() }));

vi.mock("@aws-sdk/client-dynamodb", () => ({
  DynamoDBClient: vi.fn(),
}));
vi.mock("@aws-sdk/lib-dynamodb", () => ({
  DynamoDBDocumentClient: { from: vi.fn(() => ({ send: ddbSendMock })) },
  GetCommand: vi.fn((input: unknown) => ({ type: "get", input })),
  UpdateCommand: vi.fn((input: unknown) => ({ type: "update", input })),
  PutCommand: vi.fn((input: unknown) => ({ type: "put", input })),
  BatchGetCommand: vi.fn((input: unknown) => ({ type: "batchGet", input })),
}));
vi.mock("@aws-sdk/client-sqs", () => ({
  SQSClient: vi.fn(),
  SendMessageCommand: vi.fn((input: unknown) => ({ input })),
}));

const ENV_KEYS = [
  "AWS_REGION",
  "RUNS_TABLE_NAME",
  "RUNS_QUEUE_URL",
  "R_API_URL",
  "NEXT_PUBLIC_DEV_R_API_URL",
] as const;
const savedEnv: Record<string, string | undefined> = {};

const fetchMock = vi.fn();

type SentCommand = { type: string; input: Record<string, unknown> };

const sentCommands = (): SentCommand[] =>
  ddbSendMock.mock.calls.map((call: unknown[]) => call[0] as SentCommand);

const withSend = <T>(res: MockResponse<T>): MockResponse<T> => {
  res.send = vi.fn((body: T) => {
    res.body = body;
    return res;
  }) as MockResponse<T>["send"];
  return res;
};

const legacyBody = {
  data: JSON.stringify([
    { effect: 1, se: 0.1 },
    { effect: 2, se: 0.2 },
  ]),
  parameters: JSON.stringify({ maiveMethod: "PET-PEESE", modelType: "MAIVE" }),
};

beforeEach(() => {
  ENV_KEYS.forEach((key) => {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  });
  process.env.AWS_REGION = "eu-central-1";
  process.env.RUNS_TABLE_NAME = "runs-table";
  process.env.R_API_URL = "http://localhost:8787";
  vi.resetModules();
  ddbSendMock.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  ENV_KEYS.forEach((key) => {
    if (savedEnv[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = savedEnv[key];
    }
  });
});

describe("/api/run-model run records and dedup", () => {
  it("replays a recent timeout without calling the R backend", async () => {
    const recordedMessage = "The analysis timed out after 570 seconds.";
    ddbSendMock
      .mockResolvedValueOnce({
        Item: {
          status: "timedout",
          finishedAt: Date.now() - 60_000,
          errorMessage: recordedMessage,
        },
      })
      .mockResolvedValue({});

    const { default: handler } = await import("@src/pages/api/run-model");
    const req = createMockReq({ method: "POST", body: legacyBody });
    const res = withSend(createMockRes());

    await handler(req, res);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      error: true,
      message: `${recordedMessage}${DEDUP_REPLAY_SUFFIX}`,
    });
    // The dedup hit is counted on the record.
    const update = sentCommands().find((c) => c.type === "update");
    expect(update).toBeDefined();
    expect(String(update?.input.UpdateExpression)).toContain("#dedupHits");
  });

  it("blocks an identical run that is already in flight", async () => {
    ddbSendMock
      .mockResolvedValueOnce({
        Item: { status: "running", startedAt: Date.now() - 30_000 },
      })
      .mockResolvedValue({});

    const { default: handler } = await import("@src/pages/api/run-model");
    const req = createMockReq({ method: "POST", body: legacyBody });
    const res = withSend(createMockRes());

    await handler(req, res);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ error: true, message: DEDUP_RUNNING_MESSAGE });
  });

  it("runs normally past a stale running record and records the outcome", async () => {
    ddbSendMock
      .mockResolvedValueOnce({
        Item: {
          status: "running",
          startedAt: Date.now() - RUNNING_FRESH_MS - 1_000,
        },
      })
      .mockResolvedValue({});
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ data: { ok: true } }), {
        status: 200,
        // eslint-disable-next-line @typescript-eslint/naming-convention
        headers: { "content-type": "application/json" },
      }),
    );

    const { default: handler } = await import("@src/pages/api/run-model");
    const req = createMockReq({ method: "POST", body: legacyBody });
    const res = withSend(createMockRes());

    await handler(req, res);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(200);
    expect(res.body).toBe(JSON.stringify({ data: { ok: true } }));

    const updates = sentCommands().filter((c) => c.type === "update");
    expect(updates).toHaveLength(2);

    // Start record: running, k, method and the run counter.
    const start = updates[0].input;
    expect(String(start.UpdateExpression)).toContain("#runCount");
    const startValues = start.ExpressionAttributeValues as Record<
      string,
      unknown
    >;
    expect(startValues[":running"]).toBe("running");
    expect(startValues[":k"]).toBe(2);
    expect(startValues[":method"]).toBe("PET-PEESE");
    expect(startValues[":modelType"]).toBe("MAIVE");

    // Terminal record: succeeded, with duration and refreshed TTL.
    const finish = updates[1].input;
    const finishValues = finish.ExpressionAttributeValues as Record<
      string,
      unknown
    >;
    expect(finishValues[":status"]).toBe("succeeded");
    expect(typeof finishValues[":runDurationMs"]).toBe("number");
    expect(typeof finishValues[":ttl"]).toBe("number");

    // The R backend receives the input hash for its structured log line.
    const [, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers["x-maive-input-hash"]).toMatch(/^[0-9a-f]{64}$/);
  });

  it("records a timeout outcome when the R backend reports one", async () => {
    ddbSendMock.mockResolvedValue({});
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          error: true,
          message: "The analysis timed out after 570 seconds.",
        }),
        // eslint-disable-next-line @typescript-eslint/naming-convention
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const { default: handler } = await import("@src/pages/api/run-model");
    const req = createMockReq({ method: "POST", body: legacyBody });
    const res = withSend(createMockRes());

    await handler(req, res);

    const updates = sentCommands().filter((c) => c.type === "update");
    expect(updates).toHaveLength(2);
    const finishValues = updates[1].input.ExpressionAttributeValues as Record<
      string,
      unknown
    >;
    expect(finishValues[":status"]).toBe("timedout");
    expect(finishValues[":errorMessage"]).toBe(
      "The analysis timed out after 570 seconds.",
    );
  });

  it("proxies plainly when the runs table is not configured", async () => {
    delete process.env.RUNS_TABLE_NAME;
    vi.resetModules();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ data: {} }), {
        status: 200,
        // eslint-disable-next-line @typescript-eslint/naming-convention
        headers: { "content-type": "application/json" },
      }),
    );

    const { default: handler } = await import("@src/pages/api/run-model");
    const req = createMockReq({ method: "POST", body: legacyBody });
    const res = withSend(createMockRes());

    await handler(req, res);

    expect(ddbSendMock).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(200);
  });

  it("still completes the run when the record layer fails", async () => {
    ddbSendMock.mockRejectedValue(new Error("dynamo down"));
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ data: {} }), {
        status: 200,
        // eslint-disable-next-line @typescript-eslint/naming-convention
        headers: { "content-type": "application/json" },
      }),
    );
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const { default: handler } = await import("@src/pages/api/run-model");
    const req = createMockReq({ method: "POST", body: legacyBody });
    const res = withSend(createMockRes());

    await handler(req, res);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(200);
    expect(res.body).toBe(JSON.stringify({ data: {} }));
    consoleError.mockRestore();
  });
});
