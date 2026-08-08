import { describe, it, expect, vi, afterEach } from "vitest";
import { ApiRequestError } from "@api/utils/http";
import { modelService } from "@api/services/modelService";

// Covers apps/react-ui/client/src/api/utils/http.ts: a non-2xx response must
// throw a real ApiRequestError (an Error subclass carrying status/code), not
// a plain object, so a 429 and a 500 stay distinguishable all the way up to
// the page layer instead of being flattened into "An unexpected error
// occurred" by the `error instanceof Error` check in httpRequest().

afterEach(() => {
  vi.restoreAllMocks();
});

describe("httpRequest error mapping", () => {
  it("throws an ApiRequestError with status/code from the /v1 error envelope", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { code: "rate_limited", message: "Too many requests." },
        }),
        { status: 429 },
      ),
    );

    const error = await modelService.getRun("job-1").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error).toBeInstanceOf(Error);
    const apiError = error as ApiRequestError;
    expect(apiError.status).toBe(429);
    expect(apiError.code).toBe("rate_limited");
    expect(apiError.message).toBe("Too many requests.");
  });

  it("throws an ApiRequestError with the legacy { error: string } message for a 500", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "Failed to fetch run." }), {
        status: 500,
      }),
    );

    const error = await modelService.getRun("job-1").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiRequestError);
    const apiError = error as ApiRequestError;
    expect(apiError.status).toBe(500);
    expect(apiError.code).toBeUndefined();
    expect(apiError.message).toBe("Failed to fetch run.");
  });

  it("falls back to a generic status message when the error body isn't JSON", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("<html>Bad Gateway</html>", {
        status: 502,
        statusText: "Bad Gateway",
      }),
    );

    const error = await modelService.getRun("job-1").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiRequestError);
    const apiError = error as ApiRequestError;
    expect(apiError.status).toBe(502);
    expect(apiError.message).toContain("502");
  });

  it("propagates a network failure as the original Error, not a generic one", async () => {
    const networkError = new TypeError("Failed to fetch");
    vi.spyOn(globalThis, "fetch").mockRejectedValue(networkError);

    const error = await modelService.getRun("job-1").catch((e: unknown) => e);

    expect(error).toBe(networkError);
    expect(error).not.toBeInstanceOf(ApiRequestError);
  });
});
