import { describe, it, expect } from "vitest";
import { ApiRequestError } from "@api/utils/http";
import {
  cleanCliErrorMessage,
  getUserFacingRunErrorMessage,
  modelRunErrorFromResponse,
  ModelRunError,
} from "@src/utils/errorMessageUtils";

// Covers the error-mapping half of #491: a 429, a genuine 500, and a network
// failure must reach the user as three distinct, actionable messages instead
// of all collapsing into "An unexpected error occurred", and a structured
// API error's message (the `{ error: { code, message } }` envelope, or its
// legacy equivalent) must survive unchanged to the page layer.
describe("getUserFacingRunErrorMessage", () => {
  it("shows retry guidance for a 429, regardless of message/code", () => {
    const message = getUserFacingRunErrorMessage(
      new ApiRequestError("Too many requests.", 429, "rate_limited"),
    );

    expect(message).toMatch(/busy/i);
    expect(message).toMatch(/try again/i);
  });

  it("preserves the envelope message for a non-429 ApiRequestError", () => {
    const message = getUserFacingRunErrorMessage(
      new ApiRequestError("R backend returned HTTP 500", 500),
    );

    expect(message).toBe("R backend returned HTTP 500");
  });

  it("strips a generic server prefix but keeps the underlying message", () => {
    const message = getUserFacingRunErrorMessage(
      new ApiRequestError(
        "Internal server error: Data must have exactly 3 or 4 columns.",
        500,
      ),
    );

    expect(message).toBe("Data must have exactly 3 or 4 columns.");
  });

  it("gives network failures a distinct, connection-focused message", () => {
    const message = getUserFacingRunErrorMessage(
      new TypeError("Failed to fetch"),
    );

    expect(message).toMatch(/network/i);
    expect(message).toMatch(/connection/i);
  });

  it("falls back to a generic message for a non-Error throw", () => {
    const message = getUserFacingRunErrorMessage("boom");

    expect(message).toMatch(/unexpected error/i);
  });

  it("produces three distinct messages for 429 vs 500 vs a network failure", () => {
    const rateLimited = getUserFacingRunErrorMessage(
      new ApiRequestError("Too many requests.", 429, "rate_limited"),
    );
    const serverError = getUserFacingRunErrorMessage(
      new ApiRequestError("Internal server error: boom", 500),
    );
    const networkFailure = getUserFacingRunErrorMessage(
      new TypeError("Failed to fetch"),
    );

    const messages = new Set([rateLimited, serverError, networkFailure]);
    expect(messages.size).toBe(3);
  });
});

// Covers #536: structured run failures (#526's { error, code, message,
// timeoutSeconds, elapsedSeconds } payload) and client-side dropped
// connections must reach the user as real explanations, not a stuck spinner
// or a bare "Request timed out".
describe("structured run errors", () => {
  it("preserves the backend's timeout message and fields through the throw", () => {
    const error = modelRunErrorFromResponse({
      code: "timeout",
      message: "The request timed out after 480 seconds.",
      timeoutSeconds: 480,
      elapsedSeconds: 481.2,
    });

    expect(error).toBeInstanceOf(ModelRunError);
    expect(error.code).toBe("timeout");
    expect(error.timeoutSeconds).toBe(480);
    expect(error.elapsedSeconds).toBe(481.2);
    expect(getUserFacingRunErrorMessage(error)).toBe(
      "The request timed out after 480 seconds.",
    );
  });

  it("builds a real timeout explanation when the payload has no message", () => {
    const message = getUserFacingRunErrorMessage(
      modelRunErrorFromResponse({ code: "timeout", timeoutSeconds: 120 }),
    );

    expect(message).toMatch(/timed out after 120 seconds/i);
    expect(message).toMatch(/background run/i);
  });

  it("explains a killed worker when the payload has no message", () => {
    const message = getUserFacingRunErrorMessage(
      modelRunErrorFromResponse({ code: "worker_died" }),
    );

    expect(message).toMatch(/out of memory/i);
  });

  it("strips cli formatting from a structured model error message", () => {
    const message = getUserFacingRunErrorMessage(
      modelRunErrorFromResponse({
        message: "Internal server error: [1mThe model did not converge.",
      }),
    );

    expect(message).toBe("The model did not converge.");
  });

  it("explains a client-side timeout instead of a bare 'Request timed out'", () => {
    const timeoutError = new Error("Request timed out");
    timeoutError.name = "TimeoutError";

    const message = getUserFacingRunErrorMessage(timeoutError);

    expect(message).toMatch(/did not respond/i);
    expect(message).toMatch(/My Runs/);
  });
});

describe("cleanCliErrorMessage", () => {
  it("strips ANSI escape codes", () => {
    expect(cleanCliErrorMessage("[1mBold[22m text")).toBe("Bold text");
  });

  it("strips a leading cli cross marker", () => {
    expect(cleanCliErrorMessage("✖ Something went wrong")).toBe(
      "Something went wrong",
    );
  });
});
