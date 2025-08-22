import Tooltip from "@components/Tooltip";
import { useState, useRef } from "react";

type HelpButtonProps = {
  helpText: string;
  className?: string;
};

export default function HelpButton({
  helpText,
  className = "",
}: HelpButtonProps) {
  const [show, setShow] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  return (
    <span
      className={`inline-flex items-center align-middle ${className}`}
      style={{ verticalAlign: "middle" }}
    >
      <button
        ref={btnRef}
        type="button"
        aria-label="Show help"
        onClick={() => setShow((prev) => !prev)}
        className="ml-1 p-0.5 w-5 h-5 flex items-center justify-center rounded-full bg-transparent text-gray-400 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 transition-colors duration-200 hover:bg-gray-100 dark:hover:bg-gray-700"
        tabIndex={0}
        style={{ lineHeight: 0 }}
      >
        {/* Standalone question mark icon SVG */}
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth={2}
            fill="none"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9.5 9.5a2.5 2.5 0 115 0c0 1.5-2 2-2 4"
          />
          <circle cx="12" cy="17" r="1" fill="currentColor" stroke="none" />
        </svg>
      </button>
      <span className="ml-2 z-50">
        <Tooltip content={helpText} position="right" visible={show}>
          <span></span>
        </Tooltip>
      </span>
    </span>
  );
}
