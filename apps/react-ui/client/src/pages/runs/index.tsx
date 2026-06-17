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
