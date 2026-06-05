"use client";

import { useRouter } from "next/navigation";
import LoadingCard from "@src/components/LoadingCard";
import ActionButton from "@src/components/Buttons/ActionButton";

export type RunLoadingPhase = "submitting" | "running" | "blocking";

type RunLoadingProps = {
  phase: RunLoadingPhase;
  // For the "Model setup" shortcut in the running phase.
  dataId?: string | null;
  // Reuse the cold-start warm-up copy in the blocking (synchronous) phase.
  showWarmupHint?: boolean;
};

const COPY: Record<RunLoadingPhase, { title: string; subtitle: string }> = {
  submitting: {
    title: "Queueing your analysis…",
    subtitle: "One moment — we're setting things up.",
  },
  running: {
    title: "Your analysis is running…",
    subtitle:
      "You're free to leave this page — it keeps running in the background and will appear under My Runs.",
  },
  blocking: {
    title: "Running your analysis…",
    subtitle: "Hang tight while we process your model settings.",
  },
};

/**
 * Unified run-loading screen. Drives a single, consistent loading card across
 * the model page (async "submitting" / synchronous "blocking") and the results
 * page (async "running"), so the experience reads as one continuous screen with
 * status-driven copy. In the "running" phase the user is free to leave and gets
 * shortcuts to queue another run while this one finishes in the background.
 */
export default function RunLoading({
  phase,
  dataId,
  showWarmupHint = false,
}: RunLoadingProps) {
  const router = useRouter();
  const { title } = COPY[phase];
  const subtitle =
    phase === "blocking" && showWarmupHint
      ? "Still working — the first run can take a little longer while the analysis engine warms up."
      : COPY[phase].subtitle;

  return (
    <div className="mx-auto max-w-md">
      <LoadingCard title={title} subtitle={subtitle}>
        {phase === "running" && (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            {dataId ? (
              <ActionButton
                variant="primary"
                size="sm"
                onClick={() =>
                  router.push(`/model?dataId=${encodeURIComponent(dataId)}`)
                }
              >
                Revise your model setup
              </ActionButton>
            ) : null}
            <ActionButton
              // Prominent only when there's no model setup to return to.
              variant={dataId ? "secondary" : "primary"}
              size="sm"
              onClick={() => router.push("/upload")}
            >
              Analyze a new dataset
            </ActionButton>
            <ActionButton
              variant="secondary"
              size="sm"
              onClick={() => router.push("/runs")}
            >
              View My Runs
            </ActionButton>
          </div>
        )}
      </LoadingCard>
    </div>
  );
}
