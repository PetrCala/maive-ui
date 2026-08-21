import { ApiRequestError } from "@api/utils/http";

/**
 * Removes ANSI escape codes and other terminal formatting artifacts from error messages.
 *
 * This is needed because backend layers (R + cli) may emit styled output (e.g. bold),
 * which can leak into JSON error strings and render as "weird characters" in the UI.
 */
export function cleanCliErrorMessage(input: string): string {
  const withoutAnsi = input
    // ANSI CSI sequences, e.g. \u001b[1m, \u001b[22m
    .replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, "")
    // ANSI OSC sequences, e.g. \u001b]...<BEL> or \u001b]...\u001b\\
    .replace(/\u001b\][^\u0007]*(?:\u0007|\u001b\\)/g, "");

  const withoutCliMarkers = withoutAnsi
    // cli often prefixes errors with a cross marker in terminal output
    .replace(/^\s*✖\s*/gm, "")
    .trim();

  // If a layer prepended a generic server prefix, keep only the meaningful MAIVE message.
  return withoutCliMarkers.replace(/^internal server error:\s*/i, "");
}

const RATE_LIMIT_MESSAGE =
  "The server is busy right now. Please wait a few seconds and try again.";
const UNKNOWN_ERROR_MESSAGE =
  "An unexpected error occurred while running the model.";
const DROPPED_CONNECTION_MESSAGE =
  "The server did not respond before the connection timed out. " +
  "The analysis may have run out of time or memory on the server. " +
  "Try winsorizing outliers or reducing the number of estimates, and check " +
  "My Runs before retrying: an identical request may already be recorded.";

/**
 * Structured failure of a synchronous model run. The legacy /run-model and
 * /run-rtma routes report failures as HTTP 200 with an error flag; since #526
 * that body also carries a machine-readable `code` ("timeout", "worker_died")
 * plus the budget and elapsed seconds. This error preserves those fields
 * through the throw so the UI can say what actually happened (#536).
 */
export class ModelRunError extends Error {
  readonly code?: string;

  readonly timeoutSeconds?: number;

  readonly elapsedSeconds?: number;

  constructor(
    message: string,
    fields: {
      code?: string;
      timeoutSeconds?: number;
      elapsedSeconds?: number;
    } = {},
  ) {
    super(message);
    this.name = "ModelRunError";
    this.code = fields.code;
    this.timeoutSeconds = fields.timeoutSeconds;
    this.elapsedSeconds = fields.elapsedSeconds;
    // Keeps `instanceof ModelRunError` working after transpilation.
    Object.setPrototypeOf(this, ModelRunError.prototype);
  }
}

/**
 * Fallback message when a structured error arrives without a usable message.
 * The backend normally sends one; this only covers a degenerate payload.
 */
function structuredRunErrorFallback(error: ModelRunError): string {
  if (error.code === "timeout") {
    const budget = error.timeoutSeconds
      ? ` after ${error.timeoutSeconds} seconds`
      : "";
    return (
      `The analysis timed out${budget} before finishing. ` +
      "Try winsorizing outliers, reducing the number of estimates, " +
      "or submitting the analysis as a background run."
    );
  }
  if (error.code === "worker_died") {
    return (
      "The analysis stopped before returning a result, which usually means " +
      "the server ran out of memory. Try reducing the number of estimates."
    );
  }
  return UNKNOWN_ERROR_MESSAGE;
}

/**
 * Build a ModelRunError from a legacy run response body that has its error
 * flag set ({ error, code, message, timeoutSeconds, elapsedSeconds }).
 */
export function modelRunErrorFromResponse(result: {
  code?: string;
  message?: string;
  timeoutSeconds?: number;
  elapsedSeconds?: number;
}): ModelRunError {
  const fields = {
    code: result.code,
    timeoutSeconds: result.timeoutSeconds,
    elapsedSeconds: result.elapsedSeconds,
  };
  const message = result.message
    ? cleanCliErrorMessage(result.message)
    : structuredRunErrorFallback(new ModelRunError("", fields));
  return new ModelRunError(message, fields);
}

/**
 * Builds the message shown to the user for a failed run, distinguishing a
 * rate limit (429, either from the edge or the R backend's concurrency cap)
 * from other failures instead of collapsing both into one generic message.
 * A structured API error's message (from the `{ error: { code, message } }`
 * envelope or its legacy equivalent) is preserved as-is; only a genuinely
 * unrecognized throw falls back to a generic message.
 */
export function getUserFacingRunErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError && error.status === 429) {
    return RATE_LIMIT_MESSAGE;
  }
  if (error instanceof ModelRunError) {
    // Structured backend failure (#526): the message already says what
    // happened (timeout, killed worker, model error); show it as-is.
    return error.message || structuredRunErrorFallback(error);
  }
  if (error instanceof Error && error.name === "TimeoutError") {
    // The client gave up waiting: the connection dropped or the server was
    // still computing. On Aug 15 this surfaced as a bare "Request timed out"
    // that users retried for hours; explain what it means instead (#536).
    return DROPPED_CONNECTION_MESSAGE;
  }
  if (error instanceof TypeError) {
    // fetch() rejects with a TypeError for network failures (offline, DNS,
    // CORS, connection reset) rather than resolving with a response.
    return "Network error: please check your connection and try again.";
  }
  if (error instanceof Error) {
    return cleanCliErrorMessage(error.message);
  }
  return UNKNOWN_ERROR_MESSAGE;
}
