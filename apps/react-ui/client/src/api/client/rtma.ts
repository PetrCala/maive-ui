import type { DataArray } from "@src/types";
import type { RTMAParameters } from "@src/types/api";

export async function runRTMAClient(
  data: DataArray,
  parameters: RTMAParameters,
  signal?: AbortSignal,
) {
  const response = await fetch("/api/run-rtma", {
    method: "POST",
    headers: {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ data, parameters }),
    signal,
  });

  if (!response.ok) {
    throw new Error(`API run-rtma failed: ${response.statusText}`);
  }

  return response.json() as Promise<{
    data?: unknown;
    error?: string;
    message?: string;
  }>;
}
