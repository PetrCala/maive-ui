"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import TEXT from "@src/lib/text";
import Link from "next/link";
import {
  copyToClipboard,
  getCitationsForModel,
  type Citation,
  type CitationFormat,
} from "@src/utils/citationUtils";

type CitationBoxProps = {
  className?: string;
  variant?: "compact" | "full";
  onClose?: () => void;
  useBlueStyling?: boolean;
  /**
   * Which references to show. Defaults to the MAIVE paper alone; results
   * pages pass getCitationsForModel(modelType) so RTMA runs credit Mathur's
   * method ahead of the app.
   */
  citations?: Citation[];
};

const CitationBox = ({
  className = "",
  variant = "full",
  onClose,
  useBlueStyling = false,
  citations,
}: CitationBoxProps) => {
  // Copy feedback is tracked per citation and format ("maive:apa").
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const citationList = useMemo(
    () => citations ?? getCitationsForModel(),
    [citations],
  );

  const handleCopy = useCallback(
    (citation: Citation, format: CitationFormat) => {
      void (async () => {
        const succeeded = await copyToClipboard(citation.formats[format]);
        if (!succeeded) {
          return;
        }
        setCopiedKey(`${citation.key}:${format}`);
        setTimeout(() => setCopiedKey(null), 2000);
      })();
    },
    [],
  );

  useEffect(() => {
    if (!onClose) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      // Find the modal root element
      // The modal root is the parent of this CitationBox, which is rendered inside a div with className containing 'rounded-xl'
      // We'll look for the closest parent with that class
      const modalRoot = document.querySelector(".rounded-xl.max-w-2xl");
      if (!modalRoot) {
        return;
      }

      // If the click target is not inside the modal root, close
      if (event.target instanceof Node && !modalRoot.contains(event.target)) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside, true);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside, true);
    };
  }, [onClose]);

  if (variant === "compact") {
    return (
      <div
        className={`${
          useBlueStyling
            ? "bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800"
            : "bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700"
        } rounded-lg p-4 ${className}`}
      >
        <div className="flex flex-col gap-2">
          {citationList.map((citation) => (
            <div
              key={citation.key}
              className="flex items-center justify-between gap-4"
            >
              <div
                className={`text-sm ${
                  useBlueStyling
                    ? "text-blue-800 dark:text-blue-200"
                    : "text-gray-700 dark:text-gray-300"
                }`}
              >
                <span className="font-medium">
                  {citation.role ?? "Citation"}:
                </span>{" "}
                {citation.shortText}
              </div>
              <button
                onClick={() => handleCopy(citation, "plain")}
                className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 text-sm font-medium transition-colors shrink-0"
              >
                {copiedKey === `${citation.key}:plain`
                  ? TEXT.citation.copied
                  : TEXT.citation.copy}
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`${
        useBlueStyling
          ? "bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800"
          : "bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800/50 dark:to-gray-700/50 border border-gray-200 dark:border-gray-700"
      } rounded-xl p-6 ${className}`}
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            {TEXT.citation.title}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {citationList.length > 1
              ? TEXT.citation.descriptionMulti
              : TEXT.citation.description}
          </p>
        </div>
        <div className="text-blue-600 dark:text-blue-400">
          {!!onClose ? (
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors rounded-full p-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          ) : (
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-5">
        {citationList.map((citation) => (
          <div key={citation.key}>
            {citation.role ? (
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
                {citation.role}
              </p>
            ) : null}

            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 mb-3 border border-gray-200 dark:border-gray-700">
              <p className="text-gray-800 dark:text-gray-200 text-sm leading-relaxed">
                {citation.formats.apa}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {(["apa", "bibtex", "ris", "plain"] as CitationFormat[]).map(
                (format) => (
                  <button
                    key={format}
                    onClick={() => handleCopy(citation, format)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      copiedKey === `${citation.key}:${format}`
                        ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 border border-green-300 dark:border-green-700"
                        : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-300 dark:hover:border-blue-600"
                    }`}
                  >
                    {copiedKey === `${citation.key}:${format}`
                      ? TEXT.citation.copied
                      : format.toUpperCase()}
                  </button>
                ),
              )}
            </div>

            <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
              <Link
                href={citation.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                {citation.key === "phacking"
                  ? TEXT.citation.viewPackage
                  : TEXT.citation.viewPaper}
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CitationBox;
