/**
 * InterpretationButton Component
 *
 * A reusable button component that displays interpretation text in a collapsible panel.
 * Designed to be placed at the top-right of section headers.
 */

import { useState } from "react";
import { FaChevronDown, FaCommentDots } from "react-icons/fa";

export type InterpretationButtonProps = {
  /** The interpretation text to display */
  interpretationText: string;
  /** Optional label to display instead of icon */
  label?: string;
  /** Whether to use icon (default) or text label */
  variant?: "icon" | "text";
  /** Whether the panel should be open by default */
  defaultOpen?: boolean;
  /** Additional CSS classes for the button */
  className?: string;
  /** Section identifier for accessibility */
  section?: string;
};

export default function InterpretationButton({
  interpretationText,
  label = "Quick interpretation",
  variant = "icon",
  defaultOpen = false,
  className = "",
  section = "section",
}: InterpretationButtonProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const handleToggle = () => {
    setIsOpen((prev) => !prev);
  };

  return (
    <div className={`interpretation-button-container ${className}`}>
      <button
        type="button"
        onClick={handleToggle}
        aria-expanded={isOpen}
        aria-label={`${isOpen ? "Hide" : "Show"} interpretation for ${section}`}
        className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 dark:text-blue-400 dark:hover:bg-blue-950/30 dark:hover:text-blue-300"
      >
        {variant === "icon" ? (
          <>
            <FaCommentDots className="h-3.5 w-3.5" aria-hidden="true" />
            <FaChevronDown
              className={`h-3 w-3 transition-transform duration-200 ${
                isOpen ? "rotate-180" : ""
              }`}
              aria-hidden="true"
            />
          </>
        ) : (
          <>
            <span>{label}</span>
            <FaChevronDown
              className={`h-3 w-3 transition-transform duration-200 ${
                isOpen ? "rotate-180" : ""
              }`}
              aria-hidden="true"
            />
          </>
        )}
      </button>

      {isOpen && (
        <div
          className="mt-3 rounded-lg border border-blue-100 bg-blue-50/50 p-4 text-sm leading-relaxed text-gray-700 shadow-sm dark:border-blue-900/30 dark:bg-blue-950/20 dark:text-gray-200"
          role="region"
          aria-label={`Interpretation for ${section}`}
        >
          {interpretationText}
        </div>
      )}
    </div>
  );
}
