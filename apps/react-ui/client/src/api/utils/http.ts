import type { ApiConfig, ApiError } from "@src/types";

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

/**
 * Handle HTTP response and throw errors if needed
 * @param response - Fetch response
 * @returns Response if successful
 * @throws Error if response is not ok
 */
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

    try {
      const errorData = (await response.json()) as {
        message?: string;
        error?: string;
      };
      errorMessage = errorData.message ?? errorData.error ?? errorMessage;
    } catch {
      // If we can't parse the error response, use the default message
    }

    const error: ApiError = {
      message: errorMessage,
      status: response.status,
    };

    // eslint-disable-next-line @typescript-eslint/no-throw-literal
    throw error;
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
          throw new Error("Request timed out");
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
