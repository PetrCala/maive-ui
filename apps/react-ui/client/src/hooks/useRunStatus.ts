import { useEffect, useState } from "react";
import type { ModelResults, RTMAResults, RunStatus } from "@src/types/api";
import { modelService } from "@api/services/modelService";
import { useRunsStore } from "@src/store/runsStore";
import { getResult, putResult } from "@src/utils/runsCache";
import CONST from "@src/CONST";

type UseRunStatusResult = {
  status: RunStatus | null;
  result: ModelResults | RTMAResults | null;
  errorMessage: string | null;
  runDurationMs: number | null;
  runTimestamp: string | null;
  isPolling: boolean;
};

const TERMINAL_STATUSES: RunStatus[] = [
  "succeeded",
  "failed",
  "timedout",
  "expired",
];
const INITIAL_INTERVAL_MS = 2000;
const BACKOFF_INTERVAL_MS = 5000;
const BACKOFF_AFTER_MS = 30000;
// Safety stop: a run is bounded server-side (R 600s / 480s guard), so if we are
// still polling well beyond that, give up rather than poll forever (e.g. an
// expired/never-created job).
const MAX_POLL_MS = 16 * 60 * 1000;

/**
 * Poll an async run by jobId until it reaches a terminal status, surfacing the
 * status and (once ready) the parsed result. Polls every 2s, backing off to 5s
 * after 30s. Keeps the per-browser runs list status in sync. No-ops when jobId
 * is null (e.g. the synchronous / URL-param results path).
 */
export function useRunStatus(jobId: string | null): UseRunStatusResult {
  const [status, setStatus] = useState<RunStatus | null>(null);
  const [result, setResult] = useState<ModelResults | RTMAResults | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [runDurationMs, setRunDurationMs] = useState<number | null>(null);
  const [runTimestamp, setRunTimestamp] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState<boolean>(Boolean(jobId));
  const updateRunStatus = useRunsStore((state) => state.updateRunStatus);

  useEffect(() => {
    if (!jobId) {
      setIsPolling(false);
      return undefined;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const startedAt = Date.now();
    setIsPolling(true);

    const poll = async () => {
      try {
        const run = await modelService.getRun(jobId);
        if (cancelled) {
          return;
        }

        setStatus(run.status);
        updateRunStatus(jobId, run.status);
        if (run.errorMessage) {
          setErrorMessage(run.errorMessage);
        }
        if (typeof run.runDurationMs === "number") {
          setRunDurationMs(run.runDurationMs);
        }
        if (run.runTimestamp) {
          setRunTimestamp(run.runTimestamp);
        }
        if (run.result) {
          try {
            const parsed = JSON.parse(run.result) as ModelResults | RTMAResults;
            setResult(parsed);
            void putResult(jobId, parsed); // durable client-side cache
          } catch {
            setErrorMessage("Failed to parse run result.");
          }
        }

        if (TERMINAL_STATUSES.includes(run.status)) {
          setIsPolling(false);
          return;
        }
      } catch (error) {
        if (cancelled) {
          return;
        }
        // Transient errors (network blip, brief 404 right after submit) — keep
        // polling; a persistent failure is caught by the MAX_POLL_MS guard.
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Failed to fetch run status.",
        );
      }

      if (Date.now() - startedAt > MAX_POLL_MS) {
        setErrorMessage("Timed out waiting for results.");
        setIsPolling(false);
        return;
      }

      const interval =
        Date.now() - startedAt > BACKOFF_AFTER_MS
          ? BACKOFF_INTERVAL_MS
          : INITIAL_INTERVAL_MS;
      timer = setTimeout(() => void poll(), interval);
    };

    const init = async () => {
      // Durable cache: if this result is already cached locally, render it
      // immediately and skip polling (results are immutable once produced, and
      // this still works after the 48h server TTL).
      const cached = await getResult(jobId);
      if (cancelled) {
        return;
      }
      if (cached) {
        setResult(cached);
        setStatus("succeeded");
        setIsPolling(false);
        return;
      }
      // No durable result and the run is past the 48h server TTL — its record is
      // gone, so polling would only spin until MAX_POLL_MS. Mark it expired and
      // stop. (The cache check above still wins, so an immutable cached result
      // always renders regardless of age.)
      const entry = useRunsStore
        .getState()
        .runsList.find((run) => run.jobId === jobId);
      if (entry && Date.now() - entry.submittedAt > CONST.RUNS.TTL_MS) {
        setStatus("expired");
        updateRunStatus(jobId, "expired");
        setIsPolling(false);
        return;
      }
      void poll();
    };

    void init();

    return () => {
      cancelled = true;
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [jobId, updateRunStatus]);

  return {
    status,
    result,
    errorMessage,
    runDurationMs,
    runTimestamp,
    isPolling,
  };
}
