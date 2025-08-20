export async function pingClient() {
  const response = await fetch("/api/ping");
  return response.json();
}
