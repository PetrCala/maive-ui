export async function runModelClient(
  data: any[],
  parameters: any,
  signal?: AbortSignal,
) {
  const response = await fetch("/api/run-model", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data, parameters }),
    signal,
  });

  if (!response.ok) {
    throw new Error(`API run-model failed: ${response.statusText}`);
  }

  return response.json();
}
