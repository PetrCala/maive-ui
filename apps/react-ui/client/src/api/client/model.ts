import type { DataArray, ModelParameters } from "@src/types";

export async function runModelClient(
  data: DataArray,
  parameters: ModelParameters,
  signal?: AbortSignal,
) {
  const response = await fetch("/api/run-model", {
    method: "POST",
    headers: {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ data, parameters }),
    signal,
  });

  if (!response.ok) {
    throw new Error(`API run-model failed: ${response.statusText}`);
  }

  return response.json();
}
