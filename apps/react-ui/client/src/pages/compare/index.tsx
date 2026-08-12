"use client";

import { useRouter } from "next/navigation";
import Head from "next/head";
import SectionHeading from "@src/components/SectionHeading";
import { GoBackButton } from "@src/components/Buttons";
import ActionButton from "@src/components/Buttons/ActionButton";
import ResultsSummary from "@src/components/ResultsSummary";
import RTMAResultsSummary from "@src/components/RTMAResultsSummary";
import Alert from "@src/components/Alert";
import CONST from "@src/CONST";
import { useRunsStore, type RunEntry } from "@src/store/runsStore";
import { useRunResults, type RunResultState } from "@src/hooks/useRunResults";
import { useReadySearchParams } from "@src/hooks/useReadySearchParams";
import { parseRunParameters } from "@src/utils/runParameterUtils";
import { isRtmaResults } from "@src/utils/resultTypeUtils";

// Class names are written out in full rather than composed as `grid-cols-${n}`:
// Tailwind scans source text for literal class names, so an interpolated one is
// never emitted into the stylesheet.
const gridClassFor = (count: number): string => {
  if (count >= 3) {
    return "grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3";
  }
  if (count === 2) {
    return "grid grid-cols-1 gap-4 lg:grid-cols-2";
  }
  return "grid grid-cols-1 gap-4";
};

const parseJobIds = (raw: string | null): string[] => {
  if (!raw) {
    return [];
  }
  // De-duplicated: the same run twice is two identical columns, which compares
  // nothing and would collide on the React key.
  return Array.from(
    new Set(
      raw
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  ).slice(0, CONST.RUNS.COMPARE_MAX);
};

type RunCardProps = {
  jobId: string;
  entry: RunEntry | undefined;
  state: RunResultState | undefined;
};

function RunCard({ jobId, entry, state }: RunCardProps) {
  const router = useRouter();
  const parameters = parseRunParameters(entry?.parameters);

  return (
    <div className="surface-elevated flex flex-col rounded-lg border border-primary p-4">
      <div className="mb-3 min-w-0 border-b border-primary pb-3">
        <p
          className="truncate font-medium"
          title={entry?.filename ?? "Unknown dataset"}
        >
          {entry?.filename ?? "Unknown dataset"}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <span className="inline-flex flex-shrink-0 items-center rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
            {entry?.modelType ?? parameters.modelType}
          </span>
          {entry ? (
            <span>
              {new Date(entry.submittedAt).toLocaleString()}
              {entry.rowCount > 0 ? ` · ${entry.rowCount} rows` : ""}
            </span>
          ) : null}
        </div>
      </div>

      {state?.status === "ready" ? (
        isRtmaResults(state.result) ? (
          // RTMAResultsSummary brings its own titled panel; the MAIVE summary
          // does not, so it gets a matching one here. Without it the cards sit
          // side by side with different chrome, which reads as a rendering bug
          // rather than as two different model types.
          <RTMAResultsSummary results={state.result} columns={1} />
        ) : (
          <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-700">
            <h2 className="mb-4 text-xl font-semibold">
              {`${parameters.modelType} Results`}
            </h2>
            <ResultsSummary
              results={state.result}
              parameters={parameters}
              variant="simple"
              layout="vertical"
              columns={1}
              showInterpretation={false}
            />
          </div>
        )
      ) : state?.status === "unavailable" ? (
        <Alert message={state.reason} type={CONST.ALERT_TYPES.WARNING} />
      ) : (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Loading results...
        </p>
      )}

      <div className="mt-4 pt-2">
        <ActionButton
          variant="secondary"
          size="sm"
          onClick={() => {
            const params = new URLSearchParams({ jobId });
            if (entry?.dataId) {
              params.set("dataId", entry.dataId);
            }
            if (entry?.parameters) {
              params.set("parameters", entry.parameters);
            }
            router.push(`/results?${params.toString()}`);
          }}
        >
          Open full results
        </ActionButton>
      </div>
    </div>
  );
}

export default function ComparePage() {
  const { params, isReady } = useReadySearchParams();
  const router = useRouter();
  const jobIds = parseJobIds(params.get("jobIds"));
  const runsList = useRunsStore((state) => state.runsList);
  const resultsMap = useRunResults(jobIds);

  const entryFor = (jobId: string): RunEntry | undefined =>
    runsList.find((run) => run.jobId === jobId);

  // Comparing runs of different model families is legitimate (that is often the
  // point), but the cards then hold different metrics and cannot be read across,
  // so say so rather than letting it look like a rendering fault.
  const modelTypes = new Set(
    jobIds.map((jobId) => entryFor(jobId)?.modelType).filter(Boolean),
  );
  const hasMixedModels = modelTypes.size > 1;

  return (
    <>
      <Head>
        <title>{`${CONST.APP_DISPLAY_NAME} - Compare Runs`}</title>
      </Head>
      <main className="content-page-container">
        <div className="mx-auto w-full max-w-7xl">
          <div className="mb-4 flex items-center justify-between">
            <SectionHeading level="h1" text="Compare Runs" />
            <ActionButton
              variant="secondary"
              size="sm"
              onClick={() => router.push("/runs")}
            >
              Back to My Runs
            </ActionButton>
          </div>

          {!isReady ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Loading...
            </p>
          ) : jobIds.length < CONST.RUNS.COMPARE_MIN ? (
            <div className="card text-center">
              <p className="mb-4 text-gray-600 dark:text-gray-300">
                {`Pick at least ${CONST.RUNS.COMPARE_MIN} finished runs in My Runs to compare them side by side.`}
              </p>
              <GoBackButton href="/runs" text="My Runs" variant="simple" />
            </div>
          ) : (
            <>
              {hasMixedModels && (
                <div className="mb-4">
                  <Alert
                    message="These runs use different model types, so their result cards report different quantities and do not line up row by row."
                    type={CONST.ALERT_TYPES.INFO}
                  />
                </div>
              )}
              <div className={gridClassFor(jobIds.length)}>
                {jobIds.map((jobId) => (
                  <RunCard
                    key={jobId}
                    jobId={jobId}
                    entry={entryFor(jobId)}
                    state={resultsMap[jobId]}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </main>
    </>
  );
}
