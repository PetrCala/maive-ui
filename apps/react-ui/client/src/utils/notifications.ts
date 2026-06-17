import type { RunStatus } from "@src/types/api";

const isSupported = (): boolean =>
  typeof window !== "undefined" && "Notification" in window;

/**
 * Lazily request browser-notification permission. No-op if unsupported or the
 * user has already decided (granted/denied). Safe to call on every submit.
 */
export const requestNotificationPermission = (): void => {
  if (!isSupported() || Notification.permission !== "default") {
    return;
  }
  void Notification.requestPermission().catch(() => {
    // ignore — we fall back to in-app alerts
  });
};

type NotifyArgs = {
  jobId: string;
  modelType: string;
  status: RunStatus;
};

/**
 * Fire a browser notification for a finished run. Returns true if a native
 * notification was shown, false otherwise (caller can fall back to an in-app
 * alert).
 */
export const notifyRunComplete = ({
  jobId,
  modelType,
  status,
}: NotifyArgs): boolean => {
  if (!isSupported() || Notification.permission !== "granted") {
    return false;
  }
  // "expired" is assigned locally to stale runs, not a completion event — never
  // surface it as a notification.
  if (status === "expired") {
    return false;
  }
  const succeeded = status === "succeeded";
  const title = succeeded
    ? `${modelType} run finished`
    : `${modelType} run ${status === "timedout" ? "timed out" : "failed"}`;
  const body = succeeded
    ? "Your analysis is ready — open it from My Runs."
    : "Open My Runs for details.";
  try {
    const notification = new Notification(title, { body, tag: jobId });
    notification.onclick = () => {
      window.focus();
      window.location.href = `/results?jobId=${encodeURIComponent(jobId)}`;
    };
    return true;
  } catch {
    return false;
  }
};
