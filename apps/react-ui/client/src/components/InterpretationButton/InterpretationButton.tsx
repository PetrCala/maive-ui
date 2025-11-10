/**
 * InterpretationButton Component
 *
 * A reusable button component that displays interpretation text in an overlay panel.
 * Designed to be placed at the top-right of section headers.
 */

import { useState, useRef, useEffect } from "react";
import { FaCommentDots } from "react-icons/fa";

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
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const handleToggle = () => {
    setIsOpen((prev) => !prev);
  };

  // Close on click outside
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (
        panelRef.current &&
        buttonRef.current &&
        !panelRef.current.contains(event.target as Node) &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  return (
    <div className={`interpretation-button-container relative ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        aria-expanded={isOpen}
        aria-label={`${isOpen ? "Hide" : "Show"} interpretation for ${section}`}
        className="inline-flex items-center justify-center rounded-full p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-1 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
        title={`${isOpen ? "Hide" : "Show"} interpretation`}
      >
        {variant === "icon" ? (
          <FaCommentDots className="h-4 w-4" aria-hidden="true" />
        ) : (
          <span className="text-sm font-medium">{label}</span>
        )}
      </button>

      {isOpen && (
        <div
          ref={panelRef}
          className="absolute right-0 top-full z-50 mt-2 w-[min(24rem,calc(100vw-2rem))] sm:w-96 rounded-lg border border-primary surface-elevated px-3 py-3 text-sm leading-relaxed shadow-lg"
          role="region"
          aria-label={`Interpretation for ${section}`}
        >
          {label && (
            <div className="mb-2 text-[0.6875rem] font-medium text-gray-500 dark:text-gray-400">
              {label}
            </div>
          )}
          {interpretationText}
        </div>
      )}
    </div>
  );
}
