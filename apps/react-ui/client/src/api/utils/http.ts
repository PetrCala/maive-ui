import type { ApiConfig } from "@src/types";

/**
 * Error thrown for a non-2xx HTTP response. Carries the response's status
 * code and, when the backend returned a structured error envelope
 * (`{ error: { code, message } }`, used by the public `/v1` API) or the
 * legacy `{ error: string }` / `{ message: string }` shape, the parsed
 * message and code. Being a real `Error` subclass, it survives the
 * `error instanceof Error` check in `httpRequest` below instead of being
 * replaced with a generic message, and callers can branch on `status`/`code`
 * (e.g. to show tailored guidance for a 429) instead of losing that
 * information.
 */
export class ApiRequestError extends Error {
  readonly status: number;

  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
    // Keeps `instanceof ApiRequestError` working after transpilation, which
    // can otherwise break the prototype chain for classes extending Error.
    Object.setPrototypeOf(this, ApiRequestError.prototype);
  }
}

/**
 * Create an AbortController for request timeout
 * @param timeout - Timeout in milliseconds
 * @returns AbortController
 */
function createTimeoutController(timeout: number): AbortController {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), timeout);
  return controller;
}

type ErrorResponseBody = {
  message?: string;
  error?: string | { code?: string; message?: string };
};

/**
 * Handle HTTP response and throw errors if needed
 * @param response - Fetch response
 * @returns Response if successful
 * @throws ApiRequestError if response is not ok
 */
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    let errorCode: string | undefined;

    try {
      const errorData = (await response.json()) as ErrorResponseBody;

      if (errorData.error && typeof errorData.error === "object") {
        // Structured `/v1` envelope: { error: { code, message } }
        errorMessage = errorData.error.message ?? errorMessage;
        errorCode = errorData.error.code;
      } else {
        // Legacy shape: { error: string } or { message: string }
        errorMessage =
          errorData.message ??
          (typeof errorData.error === "string" ? errorData.error : undefined) ??
          errorMessage;
      }
    } catch {
      // If we can't parse the error response, use the default message
    }

    throw new ApiRequestError(errorMessage, response.status, errorCode);
  }

  return response.json() as Promise<T>;
}

/**
 * Make an HTTP request with timeout and error handling
 * @param url - Request URL
 * @param options - Request options
 * @param config - API configuration
 * @returns Promise with response data
 */
export async function httpRequest<T>(
  url: string,
  config: ApiConfig,
  options: RequestInit = {},
): Promise<T> {
  const { timeout = 30000, headers = {}, signal } = config;

  // Create timeout controller only if no signal is provided
  const timeoutController = signal ? null : createTimeoutController(timeout);

  // Merge headers
  const requestHeaders = {
    ...headers,
    ...options.headers,
  };

  // Use the provided signal or the timeout signal
  const requestSignal = signal ?? timeoutController?.signal;

  try {
    const response = await fetch(url, {
      ...options,
      headers: requestHeaders,
      signal: requestSignal,
    });

    return await handleResponse<T>(response);
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        // Check if it was aborted by the user or by timeout
        if (signal?.aborted) {
          throw error; // Re-throw the original abort error
        } else {
          // Named so callers (getUserFacingRunErrorMessage) can tell a
          // client-side timeout from other failures and explain it properly.
          const timeoutError = new Error("Request timed out");
          timeoutError.name = "TimeoutError";
          throw timeoutError;
        }
      }
      throw error;
    }
    throw new Error("An unexpected error occurred");
  }
}

/**
 * Make a GET request
 * @param url - Request URL
 * @param config - API configuration
 * @returns Promise with response data
 */
export async function httpGet<T>(url: string, config: ApiConfig): Promise<T> {
  return httpRequest<T>(url, config, {
    method: "GET",
  });
}

/**
 * Make a POST request
 * @param url - Request URL
 * @param data - Request body data
 * @param config - API configuration
 * @returns Promise with response data
 */
export async function httpPost<T>(
  url: string,
  data: unknown,
  config: ApiConfig,
): Promise<T> {
  return httpRequest<T>(url, config, {
    body: JSON.stringify(data),
    method: "POST",
  });
}
