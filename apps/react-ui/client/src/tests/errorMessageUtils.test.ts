import { describe, it, expect } from "vitest";
import { ApiRequestError } from "@api/utils/http";
import {
  RunFailureError,
  cleanCliErrorMessage,
  getUserFacingRunErrorMessage,
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

// Covers #536: the structured error payload from #526 (code, message,
// wall-clock numbers) must reach the user as a message that says what
// actually happened, not a generic failure.
describe("RunFailureError", () => {
  it("preserves the backend's timeout message, cleaned of cli artifacts", () => {
    const error = new RunFailureError({
      code: "timeout",
      message:
        "✖ The request timed out after 120 seconds. Try winsorizing outliers.",
      timeoutSeconds: 120,
      elapsedSeconds: 121.2,
    });

    expect(getUserFacingRunErrorMessage(error)).toBe(
      "The request timed out after 120 seconds. Try winsorizing outliers.",
    );
    expect(error.code).toBe("timeout");
    expect(error.timeoutSeconds).toBe(120);
    expect(error.elapsedSeconds).toBe(121.2);
  });

  it("falls back to a timeout-specific message when the payload has no text", () => {
    const message = getUserFacingRunErrorMessage(
      new RunFailureError({ code: "timeout" }),
    );

    expect(message).toMatch(/budget/i);
    expect(message).toMatch(/background/i);
  });

  it("explains a killed worker as an out-of-memory failure", () => {
    const message = getUserFacingRunErrorMessage(
      new RunFailureError({ code: "worker_died" }),
    );

    expect(message).toMatch(/memory/i);
    expect(message).toMatch(/reducing/i);
  });

  it("keeps a plain analysis error message intact without a code", () => {
    const message = getUserFacingRunErrorMessage(
      new RunFailureError({
        message: "Internal server error: The model did not converge.",
      }),
    );

    expect(message).toBe("The model did not converge.");
  });

  it("falls back to the generic message for an unknown code with no text", () => {
    const message = getUserFacingRunErrorMessage(
      new RunFailureError({ code: "mystery" }),
    );

    expect(message).toMatch(/unexpected error/i);
  });
});

describe("proxy-level failures", () => {
  it("translates a 504 proxy timeout into user guidance", () => {
    const message = getUserFacingRunErrorMessage(
      new ApiRequestError("The analysis request timed out at the proxy.", 504),
    );

    expect(message).toMatch(/timed out/i);
    expect(message).toMatch(/background/i);
    expect(message).not.toMatch(/proxy/i);
  });

  it("translates a 502 into a backend-unreachable message", () => {
    const message = getUserFacingRunErrorMessage(
      new ApiRequestError("Failed to reach the analysis backend.", 502),
    );

    expect(message).toMatch(/could not be reached/i);
    expect(message).toMatch(/try again/i);
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
