"use client";

import Head from "next/head";
import { useRouter } from "next/navigation";
import SectionHeading from "@src/components/SectionHeading";
import { GoBackButton } from "@src/components/Buttons";
import CONST from "@src/CONST";
import { useRunsStore } from "@src/store/runsStore";
import type { RunStatus } from "@src/types/api";

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
    default:
      return status;
  }
};

const statusClasses = (status: RunStatus): string => {
  switch (status) {
    case "succeeded":
      return "text-green-600 dark:text-green-400";
    case "failed":
    case "timedout":
      return "text-red-600 dark:text-red-400";
    default:
      return "text-blue-600 dark:text-blue-400";
  }
};

export default function RunsPage() {
  const router = useRouter();
  const runsList = useRunsStore((state) => state.runsList);
  const removeRun = useRunsStore((state) => state.removeRun);
  const clearRuns = useRunsStore((state) => state.clearRuns);

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
          <div className="mb-4 flex items-center justify-between">
            <SectionHeading level="h1" text="My Runs" />
            {runsList.length > 0 && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => clearRuns()}
              >
                Clear all
              </button>
            )}
          </div>

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
            <ul className="space-y-3">
              {runsList.map((run) => (
                <li
                  key={run.jobId}
                  className="card flex items-center justify-between gap-4"
                >
                  <div>
                    <p className="font-medium">{run.modelType}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {new Date(run.submittedAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span
                      className={`text-sm font-medium ${statusClasses(run.status)}`}
                    >
                      {statusLabel(run.status)}
                    </span>
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() =>
                        openRun(run.jobId, run.dataId, run.parameters)
                      }
                    >
                      Open
                    </button>
                    <button
                      type="button"
                      className="text-sm text-gray-400 hover:text-red-500"
                      aria-label="Remove run"
                      onClick={() => removeRun(run.jobId)}
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
    </>
  );
}
