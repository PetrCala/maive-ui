"use client";

import { useState } from "react";
import Head from "next/head";
import { useRouter } from "next/navigation";
import SectionHeading from "@src/components/SectionHeading";
import { GoBackButton } from "@src/components/Buttons";
import ActionButton from "@src/components/Buttons/ActionButton";
import ConfirmDialog from "@src/components/Modals/ConfirmDialog";
import CONST from "@src/CONST";
import { useRunsStore } from "@src/store/runsStore";
import { deleteResult, clearAllResults } from "@src/utils/runsCache";
import type { RunStatus } from "@src/types/api";

// Non-terminal statuses get a live "pulse" cue, since RunsWatcher updates them
// in place while the run is still in flight.
const PENDING_STATUSES: RunStatus[] = ["queued", "running"];
const isPending = (status: RunStatus): boolean =>
  PENDING_STATUSES.includes(status);

// Statuses that can produce a result to compare. "expired" is included on
// purpose: the server record is gone, but the durable IndexedDB cache may still
// hold the result, and results are immutable so a cached one is never stale.
// The compare page says so per card when there turns out to be nothing cached.
const COMPARABLE_STATUSES: RunStatus[] = ["succeeded", "expired"];
const isComparable = (status: RunStatus): boolean =>
  COMPARABLE_STATUSES.includes(status);

const statusLabel = (status: RunStatus): string => {
  switch (status) {
    case "queued":
      return "Queued";
    case "running":
      return "Running";
    case "succeeded":
      return "Done";
    case "failed":
      return "Failed";
    case "timedout":
      return "Timed out";
    case "expired":
      return "Expired";
    default:
      return status;
  }
};

// Badge classes (background + text) for the status pill.
const statusClasses = (status: RunStatus): string => {
  switch (status) {
    case "succeeded":
      return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
    case "failed":
    case "timedout":
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
    case "expired":
      return "bg-gray-100 text-gray-600 dark:bg-gray-800/40 dark:text-gray-400";
    default:
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
  }
};

export default function RunsPage() {
  const router = useRouter();
  const runsList = useRunsStore((state) => state.runsList);
  const removeRun = useRunsStore((state) => state.removeRun);
  const clearRuns = useRunsStore((state) => state.clearRuns);
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>([]);

  // Insertion order is preserved so the compare columns appear in the order the
  // user ticked them, which is the only ordering they control.
  const toggleSelected = (jobId: string) => {
    setSelectedJobIds((previous) =>
      previous.includes(jobId)
        ? previous.filter((id) => id !== jobId)
        : [...previous, jobId],
    );
  };

  const selectionIsFull = selectedJobIds.length >= CONST.RUNS.COMPARE_MAX;
  const canCompare = selectedJobIds.length >= CONST.RUNS.COMPARE_MIN;
  const anyComparable = runsList.some((run) => isComparable(run.status));

  const compareSelected = () => {
    router.push(`/compare?jobIds=${selectedJobIds.join(",")}`);
  };

  const openRun = (
    jobId: string,
    dataId: string | null,
    parameters: string,
  ) => {
    const params = new URLSearchParams({ jobId });
    if (dataId) {
      params.set("dataId", dataId);
    }
    if (parameters) {
      params.set("parameters", parameters);
    }
    router.push(`/results?${params.toString()}`);
  };

  return (
    <>
      <Head>
        <title>{`${CONST.APP_DISPLAY_NAME} - My Runs`}</title>
      </Head>
      <main className="content-page-container">
        <div className="mx-auto w-full max-w-3xl">
          <div className="mb-1 flex items-center justify-between">
            <SectionHeading level="h1" text="My Runs" />
            {runsList.length > 0 && (
              <ActionButton
                variant="secondary"
                size="sm"
                onClick={() => setIsClearConfirmOpen(true)}
              >
                Clear all
              </ActionButton>
            )}
          </div>

          {runsList.length > 0 && (
            <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
              Runs are saved on this device only.
            </p>
          )}

          {anyComparable && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {selectedJobIds.length === 0
                  ? `Select ${CONST.RUNS.COMPARE_MIN} or ${CONST.RUNS.COMPARE_MAX} finished runs to compare them side by side.`
                  : `${selectedJobIds.length} of ${CONST.RUNS.COMPARE_MAX} selected.`}
              </p>
              {selectedJobIds.length > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="text-sm text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-200"
                    onClick={() => setSelectedJobIds([])}
                  >
                    Clear selection
                  </button>
                  <ActionButton
                    variant="primary"
                    size="sm"
                    disabled={!canCompare}
                    onClick={compareSelected}
                  >
                    Compare selected
                  </ActionButton>
                </div>
              )}
            </div>
          )}

          {runsList.length === 0 ? (
            <div className="card text-center">
              <p className="mb-4 text-gray-600 dark:text-gray-300">
                You have no runs yet. Submit an analysis and it will appear
                here.
              </p>
              <GoBackButton
                href="/upload"
                text="Upload data"
                variant="simple"
              />
            </div>
          ) : (
            <ul className="space-y-2">
              {runsList.map((run) => (
                <li
                  key={run.jobId}
                  className="surface-elevated flex items-center justify-between gap-4 rounded-lg border border-primary px-4 py-3"
                >
                  {/* Tighter gap than the row's other groups: this row already
                      truncates filenames at phone widths, and the checkbox
                      column costs it another 28px. */}
                  <div className="flex min-w-0 items-center gap-2">
                    {/* Space is reserved even for rows that cannot be selected,
                        so the filenames stay on one left edge down the list. */}
                    {!isComparable(run.status) && anyComparable && (
                      <span className="h-4 w-4 flex-shrink-0" aria-hidden />
                    )}
                    {isComparable(run.status) && (
                      <input
                        type="checkbox"
                        className="h-4 w-4 flex-shrink-0 cursor-pointer accent-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
                        checked={selectedJobIds.includes(run.jobId)}
                        disabled={
                          selectionIsFull && !selectedJobIds.includes(run.jobId)
                        }
                        aria-label={`Select ${run.filename} for comparison`}
                        title={
                          selectionIsFull && !selectedJobIds.includes(run.jobId)
                            ? `You can compare at most ${CONST.RUNS.COMPARE_MAX} runs at a time.`
                            : undefined
                        }
                        onChange={() => toggleSelected(run.jobId)}
                      />
                    )}
                    <div className="min-w-0">
                      <p className="truncate font-medium" title={run.filename}>
                        {run.filename}
                      </p>
                      <div className="mt-0.5 flex min-w-0 items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                        <span className="inline-flex flex-shrink-0 items-center rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                          {run.modelType}
                        </span>
                        <span className="truncate">
                          {new Date(run.submittedAt).toLocaleString()}
                          {run.rowCount > 0 ? ` · ${run.rowCount} rows` : ""}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-semibold ${statusClasses(run.status)}`}
                    >
                      {isPending(run.status) && (
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-75" />
                          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
                        </span>
                      )}
                      {statusLabel(run.status)}
                    </span>
                    <ActionButton
                      variant="primary"
                      size="sm"
                      onClick={() =>
                        openRun(run.jobId, run.dataId, run.parameters)
                      }
                    >
                      Open
                    </ActionButton>
                    <button
                      type="button"
                      className="text-sm text-gray-400 transition-colors hover:text-red-600"
                      aria-label="Remove run"
                      onClick={() => {
                        removeRun(run.jobId);
                        void deleteResult(run.jobId);
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>

      <ConfirmDialog
        isOpen={isClearConfirmOpen}
        onClose={() => setIsClearConfirmOpen(false)}
        onConfirm={() => {
          clearRuns();
          void clearAllResults();
        }}
        title="Clear all runs?"
        message="This permanently removes every run from this device, including their cached results. This can't be undone."
        confirmLabel="Clear all"
      />
    </>
  );
}
