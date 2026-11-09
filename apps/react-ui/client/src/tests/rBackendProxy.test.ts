// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signedRFetch } from "@api/server/rBackendProxy";

const ENV_KEYS = [
  "R_API_URL",
  "NEXT_PUBLIC_DEV_R_API_URL",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_SESSION_TOKEN",
] as const;

describe("signedRFetch", () => {
  const savedEnv: Partial<Record<(typeof ENV_KEYS)[number], string>> = {};
  const fetchMock = vi.fn(() =>
    Promise.resolve(new Response("{}", { status: 200 })),
  );

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
    fetchMock.mockClear();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    for (const key of ENV_KEYS) {
      if (savedEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = savedEnv[key];
      }
    }
  });

  it("calls non Function URL targets without signing", async () => {
    process.env.R_API_URL = "http://localhost:8787";

    await signedRFetch("/ping", { method: "GET" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      URL,
      RequestInit,
    ];
    expect(url.toString()).toBe("http://localhost:8787/ping");
    const headers = init.headers as Record<string, string>;
    expect(headers.authorization ?? headers.Authorization).toBeUndefined();
  });

  it("signs Function URL targets with SigV4 and the URL's region", async () => {
    process.env.R_API_URL = "https://abc123.lambda-url.eu-central-1.on.aws";
    process.env.AWS_ACCESS_KEY_ID = "AKIAFAKEFAKEFAKEFAKE";
    process.env.AWS_SECRET_ACCESS_KEY = "fake-secret";

    await signedRFetch("/run-model", { method: "POST", body: "{}" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      URL,
      RequestInit,
    ];
    expect(url.toString()).toBe(
      "https://abc123.lambda-url.eu-central-1.on.aws/run-model",
    );
    const headers = init.headers as Record<string, string>;
    const authorization = headers.authorization ?? headers.Authorization;
    expect(authorization).toContain("AWS4-HMAC-SHA256");
    expect(authorization).toContain("/eu-central-1/lambda/aws4_request");
    expect(headers["x-amz-date"]).toBeDefined();
  });

  it("keeps the query string on an unsigned local target (#598)", async () => {
    process.env.R_API_URL = "http://localhost:8787";

    await signedRFetch("/v1/run-model?include=plot", {
      method: "POST",
      body: "{}",
    });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      URL,
      RequestInit,
    ];
    expect(url.toString()).toBe(
      "http://localhost:8787/v1/run-model?include=plot",
    );
    const headers = init.headers as Record<string, string>;
    expect(headers.authorization ?? headers.Authorization).toBeUndefined();
  });

  it("keeps the query string on a Function URL target and signs it (#598)", async () => {
    process.env.R_API_URL = "https://abc123.lambda-url.eu-central-1.on.aws";
    process.env.AWS_ACCESS_KEY_ID = "AKIAFAKEFAKEFAKEFAKE";
    process.env.AWS_SECRET_ACCESS_KEY = "fake-secret";
    // Freeze the signing time so the two requests below differ only in
    // their query string.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-09T12:00:00Z"));
    try {
      await signedRFetch("/v1/run-model?include=plot", {
        method: "POST",
        body: "{}",
      });
      await signedRFetch("/v1/run-model", { method: "POST", body: "{}" });
    } finally {
      vi.useRealTimers();
    }

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [withQuery, withoutQuery] = fetchMock.mock.calls as unknown as [
      [URL, RequestInit],
      [URL, RequestInit],
    ];
    expect(withQuery[0].toString()).toBe(
      "https://abc123.lambda-url.eu-central-1.on.aws/v1/run-model?include=plot",
    );
    const signedHeaders = withQuery[1].headers as Record<string, string>;
    const bareHeaders = withoutQuery[1].headers as Record<string, string>;
    const signedAuthorization =
      signedHeaders.authorization ?? signedHeaders.Authorization;
    expect(signedAuthorization).toContain("AWS4-HMAC-SHA256");
    expect(signedHeaders["x-amz-date"]).toBe(bareHeaders["x-amz-date"]);
    // Same credentials, path, headers, body and time: a different signature
    // means the query string is part of what was signed.
    expect(signedAuthorization).not.toBe(
      bareHeaders.authorization ?? bareHeaders.Authorization,
    );
  });

  it("refuses to call a Function URL without credentials", async () => {
    process.env.R_API_URL = "https://abc123.lambda-url.eu-central-1.on.aws";

    await expect(
      signedRFetch("/run-model", { method: "POST", body: "{}" }),
    ).rejects.toThrow(/credentials/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
