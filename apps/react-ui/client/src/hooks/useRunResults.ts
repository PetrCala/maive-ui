import { useEffect, useState } from "react";
import type { ModelResults, RTMAResults } from "@src/types/api";
import { modelService } from "@api/services/modelService";
import { getResult, putResult } from "@src/utils/runsCache";

export type RunResultState =
  | { status: "loading" }
  | { status: "ready"; result: ModelResults | RTMAResults }
  | { status: "unavailable"; reason: string };

export type RunResultsMap = Record<string, RunResultState>;

// Why this is a fetch and not a poll, unlike useRunStatus: comparison only ever
// looks at runs that already finished, so there is nothing to wait for. A run
// whose result is not there now will not acquire one by asking again.
const NO_RESULT_REASON = "This run has no stored result.";
const EXPIRED_REASON =
  "This run is past the 48-hour server window and was not cached on this device.";

/**
 * Load the results of several runs at once, for side-by-side comparison (#457).
 *
 * Each job is resolved independently and in parallel: the durable IndexedDB
 * cache first, then `GET /api/runs/{jobId}`. The cache is checked first because
 * results are immutable once produced, so a cached copy is always as good as
 * the server's and outlives the 48-hour server TTL. The batch `GET /api/runs`
 * route is deliberately not used here; it returns status only, no result
 * payload.
 *
 * One job failing never blocks the others: the comparison renders whatever
 * resolved, and each missing card says why. Results that came from the server
 * are written back to the cache, so re-opening the same comparison is offline.
 */
export function useRunResults(jobIds: string[]): RunResultsMap {
  const [resultsMap, setResultsMap] = useState<RunResultsMap>({});
  // jobIds is a fresh array on every render (parsed from the query string), so
  // depend on its contents rather than its identity to avoid refetching in a
  // loop.
  const jobIdsKey = jobIds.join(",");

  useEffect(() => {
    const ids = jobIdsKey ? jobIdsKey.split(",") : [];
    if (ids.length === 0) {
      setResultsMap({});
      return undefined;
    }

    let cancelled = false;
    setResultsMap(
      Object.fromEntries(ids.map((id) => [id, { status: "loading" }])),
    );

    const resolveOne = async (jobId: string): Promise<RunResultState> => {
      const cached = await getResult(jobId);
      if (cached) {
        return { status: "ready", result: cached };
      }

      try {
        const run = await modelService.getRun(jobId);
        if (!run.result) {
          return {
            status: "unavailable",
            reason:
              run.status === "expired" ? EXPIRED_REASON : NO_RESULT_REASON,
          };
        }
        const parsed = JSON.parse(run.result) as ModelResults | RTMAResults;
        void putResult(jobId, parsed);
        return { status: "ready", result: parsed };
      } catch {
        // A 404 here is the normal shape of an expired run: the record is gone
        // once the server TTL passes, and the cache above already had its say.
        return { status: "unavailable", reason: EXPIRED_REASON };
      }
    };

    void Promise.all(
      ids.map(async (jobId) => {
        const state = await resolveOne(jobId);
        if (!cancelled) {
          // Commit each result as it lands rather than awaiting the whole set,
          // so one slow job does not hold up the cards that are already known.
          setResultsMap((previous) => ({ ...previous, [jobId]: state }));
        }
      }),
    );

    return () => {
      cancelled = true;
    };
  }, [jobIdsKey]);

  return resultsMap;
}
