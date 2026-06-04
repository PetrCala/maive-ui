/**
 * Generate an unguessable job id for an async run.
 *
 * A job id doubles as a bearer token (anyone holding it can read that run's
 * result until the 48h server TTL), so it must NOT be guessable. This is why
 * it uses `crypto.randomUUID()` rather than the timestamp-based
 * `generateDataId` in `dataUtils.ts`.
 *
 * Isomorphic: `crypto.randomUUID` is available in secure-context browsers and
 * in the Node 20 Lambda runtime.
 */
export const generateJobId = (): string => {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID (should not occur in
  // supported browsers/runtime); still random enough for a non-security id.
  return `job_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
};
