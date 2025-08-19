/**
 * Utility to ensure code only runs on the client side
 * @param callback - Function to execute only on client
 * @returns Promise that resolves on client, rejects on server
 */
export function clientOnly<T>(callback: () => T | Promise<T>): Promise<T> {
  if (typeof window === "undefined") {
    return Promise.reject(
      new Error("This function can only be called on the client side"),
    );
  }

  try {
    const result = callback();
    return Promise.resolve(result);
  } catch (error) {
    return Promise.reject(error);
  }
}

/**
 * Check if the current environment is client-side
 * @returns True if running on client, false if on server
 */
export function isClient(): boolean {
  return typeof window !== "undefined";
}
