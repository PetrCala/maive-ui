"use client";

import HelpIcon from "@components/Icons/HelpIcon";
import HomeIcon from "@components/Icons/HomeIcon";
import Link from "next/link";
import CONST from "@src/CONST";

interface HeaderProps {
  showHomeIcon?: boolean;
  showHelpIcon?: boolean;
  className?: string;
}

export default function Header({
  showHomeIcon = true,
  showHelpIcon = true,
  className = "",
}: HeaderProps) {
  return (
    <header
      className={`flex justify-between items-center w-full py-4 px-4 z-50 ${className}`}
    >
      {/* Left side - logo, breadcrumbs, navigation,... */}
      <div className="flex-1 flex items-center">
        <Link href="/">
          <span className="font-bold text-xl tracking-wide text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
            {CONST.APP_DISPLAY_NAME}
          </span>
        </Link>
      </div>

      {/* Right side - icons */}
      {!!showHelpIcon && <HelpIcon />}
      {!!showHomeIcon && <HomeIcon />}
    </header>
  );
}
