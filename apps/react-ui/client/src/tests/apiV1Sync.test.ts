// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockReq, createMockRes } from "@tests/helpers/nextApiMocks";
import type { MockResponse } from "@tests/helpers/nextApiMocks";

// The public sync routes (/api/v1/run-model, /api/v1/run-rtma) resolve the
// parameters before forwarding to the R backend and decorate the 200 with
// what ran (#555).

vi.mock("@aws-sdk/client-dynamodb", () => ({ DynamoDBClient: vi.fn() }));
vi.mock("@aws-sdk/lib-dynamodb", () => ({
  DynamoDBDocumentClient: { from: vi.fn(() => ({ send: vi.fn() })) },
  GetCommand: vi.fn(),
  UpdateCommand: vi.fn(),
  PutCommand: vi.fn(),
  BatchGetCommand: vi.fn(),
}));
vi.mock("@aws-sdk/client-sqs", () => ({
  SQSClient: vi.fn(),
  SendMessageCommand: vi.fn(),
}));

const ENV_KEYS = [
  "AWS_REGION",
  "RUNS_TABLE_NAME",
  "R_API_URL",
  "NEXT_PUBLIC_DEV_R_API_URL",
] as const;
const savedEnv: Record<string, string | undefined> = {};
const fetchMock = vi.fn();

const withSend = <T>(res: MockResponse<T>): MockResponse<T> => {
  res.send = vi.fn((body: T) => {
    res.body = body;
    return res;
  }) as MockResponse<T>["send"];
  return res;
};

const fourColumnRows = [
  { effect: 0.42, se: 0.11, n_obs: 120, study_id: "a" },
  { effect: 0.31, se: 0.06, n_obs: 90, study_id: "a" },
  { effect: 0.55, se: 0.2, n_obs: 45, study_id: "a" },
  { effect: 0.12, se: 0.04, n_obs: 200, study_id: "b" },
];

const upstreamJson = (body: unknown, status = 200) =>
  Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      // eslint-disable-next-line @typescript-eslint/naming-convention
      headers: { "content-type": "application/json" },
    }),
  );

const parseBody = <T = Record<string, unknown>>(res: MockResponse<string>): T =>
  JSON.parse(String(res.body)) as T;

const forwardedBody = (): Record<string, unknown> => {
  const [, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];
  return JSON.parse(init.body as string) as Record<string, unknown>;
};

beforeEach(() => {
  ENV_KEYS.forEach((key) => {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  });
  process.env.R_API_URL = "http://localhost:8787";
  vi.resetModules();
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

describe("POST /api/v1/run-model", () => {
  it("forwards fully resolved parameters and echoes them on the 200", async () => {
    fetchMock.mockImplementation(() =>
      upstreamJson({ effectEstimate: 0.2, standardError: 0.05 }),
    );
    const { default: handler } = await import(
      "@src/pages/api/v1/[...endpoint]"
    );
    const req = createMockReq({
      method: "POST",
      query: { endpoint: ["run-model"] },
      body: { data: fourColumnRows, recipe: "EK" },
    });
    const res = withSend(createMockRes<string>());

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    const forwarded = forwardedBody();
    expect(forwarded).not.toHaveProperty("recipe");
    expect(forwarded.parameters).toMatchObject({
      modelType: "WLS",
      maiveMethod: "EK",
      shouldUseInstrumenting: false,
      weight: "standard_weights",
      includeStudyClustering: true,
    });
    const body = parseBody(res);
    expect(body.effectEstimate).toBe(0.2);
    expect(body.resolvedParameters).toEqual(forwarded.parameters);
    expect(body.recipe).toBe("EK");
  });

  it("400s on an unknown key without calling the backend", async () => {
    const { default: handler } = await import(
      "@src/pages/api/v1/[...endpoint]"
    );
    const req = createMockReq({
      method: "POST",
      query: { endpoint: ["run-model"] },
      body: { data: fourColumnRows, parameters: { favourPositive: true } },
    });
    const res = withSend(createMockRes());

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({
      error: {
        code: "validation_error",
        message: expect.stringContaining("favourPositive") as string,
      },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("400s on a top-level modelType instead of silently running MAIVE (#574)", async () => {
    const { default: handler } = await import(
      "@src/pages/api/v1/[...endpoint]"
    );
    const req = createMockReq({
      method: "POST",
      query: { endpoint: ["run-model"] },
      body: { modelType: "WLS", data: fourColumnRows },
    });
    const res = withSend(createMockRes());

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({
      error: {
        code: "validation_error",
        message:
          "Unexpected top-level key: modelType. modelType is a run parameter and belongs inside `parameters`; this endpoint accepts data, parameters and recipe at the top level.",
      },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("400s on an arbitrary unknown top-level key (#574)", async () => {
    const { default: handler } = await import(
      "@src/pages/api/v1/[...endpoint]"
    );
    const req = createMockReq({
      method: "POST",
      query: { endpoint: ["run-model"] },
      body: { data: fourColumnRows, options: { modelType: "WLS" } },
    });
    const res = withSend(createMockRes());

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({
      error: {
        code: "validation_error",
        message: expect.stringContaining(
          "Unexpected top-level key: options.",
        ) as string,
      },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("400s when RTMA is requested on the MAIVE endpoint", async () => {
    const { default: handler } = await import(
      "@src/pages/api/v1/[...endpoint]"
    );
    const req = createMockReq({
      method: "POST",
      query: { endpoint: ["run-model"] },
      body: { data: fourColumnRows, parameters: { modelType: "RTMA" } },
    });
    const res = withSend(createMockRes());

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({
      error: {
        message: expect.stringContaining("/v1/run-rtma") as string,
      },
    });
  });

  it("relays a backend error body untouched", async () => {
    fetchMock.mockImplementation(() =>
      upstreamJson(
        { error: { code: "validation_error", message: "Data must ..." } },
        400,
      ),
    );
    const { default: handler } = await import(
      "@src/pages/api/v1/[...endpoint]"
    );
    const req = createMockReq({
      method: "POST",
      query: { endpoint: ["run-model"] },
      body: { data: fourColumnRows },
    });
    const res = withSend(createMockRes<string>());

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(parseBody(res)).toEqual({
      error: { code: "validation_error", message: "Data must ..." },
    });
  });
});

describe("POST /api/v1/run-rtma", () => {
  it("fills the backend's reported seed into the echo when the caller sent none", async () => {
    fetchMock.mockImplementation(() =>
      upstreamJson({ mu: 0.1, muCI: [0, 0.2], seed: 2025 }),
    );
    const { default: handler } = await import(
      "@src/pages/api/v1/[...endpoint]"
    );
    const req = createMockReq({
      method: "POST",
      query: { endpoint: ["run-rtma"] },
      body: { data: fourColumnRows.map(({ effect, se }) => ({ effect, se })) },
    });
    const res = withSend(createMockRes<string>());

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(forwardedBody().parameters).not.toHaveProperty("seed");
    const body = parseBody(res);
    expect(body.resolvedParameters).toEqual({
      modelType: "RTMA",
      favorPositive: true,
      alphaSelect: 0.05,
      ciLevel: 0.95,
      winsorize: 0,
      seed: 2025,
    });
    expect(body.recipe).toBe("RTMA");
  });

  it("400s on a top-level seed instead of ignoring it (#574)", async () => {
    const { default: handler } = await import(
      "@src/pages/api/v1/[...endpoint]"
    );
    const req = createMockReq({
      method: "POST",
      query: { endpoint: ["run-rtma"] },
      body: { seed: 42, data: [{ effect: 0.1, se: 0.1 }] },
    });
    const res = withSend(createMockRes());

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({
      error: {
        code: "validation_error",
        message: expect.stringContaining(
          "Unexpected top-level key: seed. seed is a run parameter and belongs inside `parameters`",
        ) as string,
      },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps a caller seed", async () => {
    fetchMock.mockImplementation(() => upstreamJson({ mu: 0.1, seed: 7 }));
    const { default: handler } = await import(
      "@src/pages/api/v1/[...endpoint]"
    );
    const req = createMockReq({
      method: "POST",
      query: { endpoint: ["run-rtma"] },
      body: {
        data: [
          { effect: 0.1, se: 0.1 },
          { effect: 0.2, se: 0.1 },
        ],
        parameters: { seed: 7 },
      },
    });
    const res = withSend(createMockRes<string>());

    await handler(req, res);

    expect(forwardedBody().parameters).toMatchObject({ seed: 7 });
    const body = parseBody<{ resolvedParameters: { seed: number } }>(res);
    expect(body.resolvedParameters.seed).toBe(7);
  });
});

describe("POST /api/run-model (browser sync proxy)", () => {
  it("resolves the JSON-string parameters, forwards the resolved copy and decorates the legacy envelope", async () => {
    fetchMock.mockImplementation(() =>
      upstreamJson({ data: { effectEstimate: 0.3 } }),
    );
    const { default: handler } = await import("@src/pages/api/run-model");
    const req = createMockReq({
      method: "POST",
      body: {
        data: JSON.stringify(fourColumnRows),
        parameters: JSON.stringify({ modelType: "WLS" }),
      },
    });
    const res = withSend(createMockRes<string>());

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    const forwarded = forwardedBody();
    expect(typeof forwarded.parameters).toBe("string");
    const forwardedParameters = JSON.parse(
      forwarded.parameters as string,
    ) as Record<string, unknown>;
    expect(forwardedParameters).toMatchObject({
      modelType: "WLS",
      weight: "standard_weights",
      includeStudyClustering: true,
    });
    const body = parseBody(res);
    expect(body.data).toEqual({ effectEstimate: 0.3 });
    expect(body.resolvedParameters).toEqual(forwardedParameters);
    expect(body.recipe).toBe("PET-PEESE");
  });

  it("400s on an unknown key with the legacy error shape", async () => {
    const { default: handler } = await import("@src/pages/api/run-model");
    const req = createMockReq({
      method: "POST",
      body: {
        data: JSON.stringify(fourColumnRows),
        parameters: JSON.stringify({ favourPositive: true }),
      },
    });
    const res = withSend(createMockRes());

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({
      error: true,
      code: "validation_error",
      message: expect.stringContaining("favourPositive") as string,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("400s on a top-level modelType with the legacy error shape (#574)", async () => {
    const { default: handler } = await import("@src/pages/api/run-model");
    const req = createMockReq({
      method: "POST",
      body: {
        modelType: "WLS",
        data: JSON.stringify(fourColumnRows),
        parameters: JSON.stringify({}),
      },
    });
    const res = withSend(createMockRes());

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({
      error: true,
      code: "validation_error",
      message:
        "Unexpected top-level key: modelType. modelType is a run parameter and belongs inside `parameters`; this endpoint accepts data and parameters at the top level.",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("400s on a top-level modelType on the RTMA proxy too (#574)", async () => {
    const { default: handler } = await import("@src/pages/api/run-rtma");
    const req = createMockReq({
      method: "POST",
      body: {
        modelType: "RTMA",
        data: JSON.stringify([{ effect: 0.1, se: 0.1 }]),
        parameters: JSON.stringify({ modelType: "RTMA" }),
      },
    });
    const res = withSend(createMockRes());

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({
      error: true,
      code: "validation_error",
      message: expect.stringContaining(
        "Unexpected top-level key: modelType.",
      ) as string,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not decorate a legacy error payload", async () => {
    fetchMock.mockImplementation(() =>
      upstreamJson({ error: true, message: "boom" }),
    );
    const { default: handler } = await import("@src/pages/api/run-model");
    const req = createMockReq({
      method: "POST",
      body: {
        data: JSON.stringify(fourColumnRows),
        parameters: JSON.stringify({}),
      },
    });
    const res = withSend(createMockRes<string>());

    await handler(req, res);

    expect(parseBody(res)).toEqual({
      error: true,
      message: "boom",
    });
  });
});
