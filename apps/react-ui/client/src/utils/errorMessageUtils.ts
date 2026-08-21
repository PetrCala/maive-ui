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
const PROXY_TIMEOUT_MESSAGE =
  "The analysis timed out before finishing. Try winsorizing outliers, " +
  "reducing the number of estimates, or submitting the analysis as a " +
  "background run.";
const BACKEND_UNREACHABLE_MESSAGE =
  "The analysis backend could not be reached. Please try again in a moment.";

/**
 * Structured failure payload of a synchronous run (#526). The R backend's
 * legacy routes return HTTP 200 with `error: true` plus, since the request
 * bounds landed, a `code` saying what actually happened and the wall-clock
 * numbers the server knows.
 */
export type StructuredRunFailure = {
  code?: string;
  message?: string;
  timeoutSeconds?: number;
  elapsedSeconds?: number;
};

// Fallback messages per structured error code, used when the backend payload
// carries a code but no usable message. Mirrors the wording the R backend
// generates in request_bounds.R so both paths read the same to the user.
const FALLBACK_BY_CODE: Record<string, string> = {
  timeout:
    "The analysis exceeded its wall-clock budget before finishing. " +
    "Try winsorizing outliers, reducing the number of estimates, or " +
    "submitting the analysis as a background run.",
  // eslint-disable-next-line @typescript-eslint/naming-convention
  worker_died:
    "The analysis stopped before returning a result, which usually means " +
    "it ran out of memory. Try reducing the number of estimates.",
};

/**
 * Error thrown for a run the backend reported as failed via the legacy
 * `{ error, code, message, timeoutSeconds, elapsedSeconds }` payload. Keeps
 * the structured fields so callers can branch on what actually happened
 * (timeout vs out-of-memory vs analysis error) instead of collapsing every
 * failure into one generic message.
 */
export class RunFailureError extends Error {
  readonly code?: string;

  readonly timeoutSeconds?: number;

  readonly elapsedSeconds?: number;

  constructor(failure: StructuredRunFailure) {
    const cleaned = failure.message
      ? cleanCliErrorMessage(failure.message)
      : "";
    const fallback =
      (failure.code ? FALLBACK_BY_CODE[failure.code] : undefined) ??
      UNKNOWN_ERROR_MESSAGE;
    super(cleaned || fallback);
    this.name = "RunFailureError";
    this.code = failure.code;
    this.timeoutSeconds = failure.timeoutSeconds;
    this.elapsedSeconds = failure.elapsedSeconds;
    Object.setPrototypeOf(this, RunFailureError.prototype);
  }
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
  if (error instanceof ApiRequestError && error.status === 504) {
    // The proxy killed the upstream call at its own budget; the raw message
    // ("timed out at the proxy") is infrastructure-speak, so translate it.
    return PROXY_TIMEOUT_MESSAGE;
  }
  if (error instanceof ApiRequestError && error.status === 502) {
    return BACKEND_UNREACHABLE_MESSAGE;
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
