"use client";

import HelpIcon from "@components/Icons/HelpIcon";
import HomeIcon from "@components/Icons/HomeIcon";
import Link from "next/link";
import CONST from "@src/CONST";
import ThemeToggle from "@components/ThemeToggle";

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
        <ThemeToggle />
        {!!showHelpIcon && <HelpIcon />}
        {!!showHomeIcon && <HomeIcon />}
      </div>
    </header>
  );
}
