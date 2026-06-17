"use client";

import HelpIcon from "@components/Icons/HelpIcon";
import HomeIcon from "@components/Icons/HomeIcon";
import Link from "next/link";
import CONST from "@src/CONST";
import CONFIG from "@src/CONFIG";
import ThemeToggle from "@components/ThemeToggle";
import { useRunsStore } from "@src/store/runsStore";

const PENDING_STATUSES = ["queued", "running"];

type HeaderProps = {
  showHomeIcon?: boolean;
  showHelpIcon?: boolean;
  className?: string;
};

export default function Header({
  showHomeIcon = true,
  showHelpIcon = true,
  className = "",
}: HeaderProps) {
  const activeRunCount = useRunsStore(
    (state) =>
      state.runsList.filter((run) => PENDING_STATUSES.includes(run.status))
        .length,
  );

  return (
    <header
      className={`surface-elevated border-b border-primary flex justify-between items-center w-full py-4 px-4 z-50 sticky top-0 ${className}`}
    >
      {/* Left side - logo, breadcrumbs, navigation,... */}
      <div className="flex-1 flex items-center pl-2">
        <Link href="/">
          <span className="font-bold text-xl tracking-wide text-primary hover:text-primary-600 transition-colors">
            {CONST.APP_DISPLAY_NAME}
          </span>
        </Link>
      </div>

      {/* Right side - icons */}
      <div className="flex items-center gap-2">
        {CONFIG.ASYNC_RUNS_ENABLED && (
          <Link
            href="/runs"
            className="text-primary hover:text-primary-600 flex items-center gap-1.5 px-2 text-sm font-medium transition-colors"
          >
            My Runs
            {activeRunCount > 0 && (
              <span
                className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-blue-100 px-1.5 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                aria-label={`${activeRunCount} run${activeRunCount === 1 ? "" : "s"} in progress`}
              >
                {activeRunCount}
              </span>
            )}
          </Link>
        )}
        <ThemeToggle className="icon-header" />
        {!!showHelpIcon && <HelpIcon className="icon-header" />}
        {!!showHomeIcon && <HomeIcon className="icon-header" />}
      </div>
    </header>
  );
}
