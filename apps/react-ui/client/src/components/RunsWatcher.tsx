"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import CONFIG from "@src/CONFIG";
import CONST from "@src/CONST";
import { useRunsStore } from "@src/store/runsStore";
import { modelService } from "@src/api/services/modelService";
import { useGlobalAlert } from "@src/components/GlobalAlertProvider";
import { notifyRunComplete } from "@src/utils/notifications";
import type { RunStatus } from "@src/types/api";

// Keep the in-app completion toast on screen long enough to click its action.
const COMPLETION_ALERT_MS = 8000;

const TERMINAL_STATUSES: RunStatus[] = [
  "succeeded",
  "failed",
  "timedout",
  "expired",
];
const POLL_INTERVAL_MS = 5000;

const isTerminal = (status: RunStatus) => TERMINAL_STATUSES.includes(status);

/**
 * App-level watcher (renders nothing). While the per-browser runs list has any
 * non-terminal run, it polls their status via the batch endpoint, updates the
 * store (so the My Runs list reflects live status from anywhere in the app),
 * and fires a browser notification when a run transitions to terminal — with an
 * in-app alert fallback. Inert when CONFIG.ASYNC_RUNS_ENABLED is false.
 */
export default function RunsWatcher() {
  const router = useRouter();
  const runsList = useRunsStore((state) => state.runsList);
  const updateRunStatus = useRunsStore((state) => state.updateRunStatus);
  const { showAlert } = useGlobalAlert();

  // Stable key of the runs still in flight — drives the polling effect.
  const pendingIdsKey = runsList
    .filter((run) => !isTerminal(run.status))
    .map((run) => run.jobId)
    .join(",");

  useEffect(() => {
    if (!CONFIG.ASYNC_RUNS_ENABLED || pendingIdsKey === "") {
      return undefined;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
      // Read fresh store state each cycle (it's the source of "previous" status).
      const current = useRunsStore.getState().runsList;
      const pending = current.filter((run) => !isTerminal(run.status));
      if (pending.length === 0) {
        return; // nothing left to watch; effect re-runs if new runs appear
      }

      try {
        const runs = await modelService.getRuns(pending.map((r) => r.jobId));
        if (cancelled) {
          return;
        }
        const byId = new Map(current.map((r) => [r.jobId, r] as const));
        runs.forEach((run) => {
          const prev = byId.get(run.jobId);
          // Notify on a transition into a terminal status.
          if (prev && !isTerminal(prev.status) && isTerminal(run.status)) {
            const shown = notifyRunComplete({
              jobId: run.jobId,
              modelType: run.modelType ?? prev.modelType ?? "Model",
              status: run.status,
            });
            if (!shown) {
              const ok = run.status === "succeeded";
              const modelType = run.modelType ?? prev.modelType ?? "Model";
              const { jobId } = run;
              showAlert(
                ok
                  ? `Your ${modelType} run finished.`
                  : `Your ${modelType} run didn't complete.`,
                ok ? "success" : "error",
                COMPLETION_ALERT_MS,
                {
                  label: ok ? "View results" : "View details",
                  onClick: () =>
                    router.push(`/results?jobId=${encodeURIComponent(jobId)}`),
                },
              );
            }
          }
          updateRunStatus(run.jobId, run.status);
        });

        // Flip runs that are gone from the backend AND past the 48h TTL to a
        // terminal "expired" status. Done in a separate pass (not driven by the
        // response) so it never fires a "run finished" notification. The age
        // guard means a run only transiently absent from a throttled batch
        // response is not falsely expired — a younger missing run keeps polling
        // until its record reappears or it genuinely ages out.
        const returnedIds = new Set(runs.map((run) => run.jobId));
        const now = Date.now();
        pending.forEach((run) => {
          if (
            !returnedIds.has(run.jobId) &&
            now - run.submittedAt > CONST.RUNS.TTL_MS
          ) {
            updateRunStatus(run.jobId, "expired");
          }
        });
      } catch {
        // transient (network/throttle) — keep polling
      }

      if (!cancelled) {
        timer = setTimeout(() => void poll(), POLL_INTERVAL_MS);
      }
    };

    void poll();

    return () => {
      cancelled = true;
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [pendingIdsKey, updateRunStatus, showAlert, router]);

  return null;
}
