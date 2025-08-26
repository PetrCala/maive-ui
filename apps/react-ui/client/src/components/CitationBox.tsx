"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import CONST from "@src/CONST";
import TEXT from "@src/lib/text";

type CitationFormat = "apa" | "bibtex" | "ris" | "plain";

type CitationBoxProps = {
  className?: string;
  variant?: "compact" | "full";
  onClose?: () => void;
};

const CitationBox = ({
  className = "",
  variant = "full",
  onClose,
}: CitationBoxProps) => {
  const [copiedFormat, setCopiedFormat] = useState<CitationFormat | null>(null);

  const citations = useMemo(
    () => ({
      apa: "Irsova, Z., Bom, P. R. D., Havranek, T., & Rachinger, H. (2025). Spurious Precision in Meta-Analysis of Observational Research. Nature Communications, DOI: 10.1038/s41467-025-63261-0.",
      bibtex: `@article{irsova2025spurious,
  title={Spurious Precision in Meta-Analysis of Observational Research},
  author={Irsova, Zuzana and Bom, Pedro R. D. and Havranek, Tomas and Rachinger, Heiko},
  journal={Nature Communications},
  year={2025},
  doi={10.1038/s41467-025-63261-0}
}`,
      ris: `TY  - JOUR
TI  - Spurious Precision in Meta-Analysis of Observational Research
AU  - Irsova, Zuzana
AU  - Bom, Pedro R. D.
AU  - Havranek, Tomas
AU  - Rachinger, Heiko
PY  - 2025
JO  - Nature Communications
DO  - 10.1038/s41467-025-63261-0
ER  -`,
      plain:
        "Irsova, Z., Bom, P. R. D., Havranek, T., & Rachinger, H. Spurious Precision in Meta-Analysis of Observational Research. Nature Communications 2025, DOI: 10.1038/s41467-025-63261-0.",
    }),
    [],
  );

  const handleCopy = useCallback(
    (format: CitationFormat) => {
      void (async () => {
        try {
          await navigator.clipboard.writeText(citations[format]);
          setCopiedFormat(format);
          setTimeout(() => setCopiedFormat(null), 2000);
        } catch (err) {
          console.error("Failed to copy citation:", err);
          // Fallback for older browsers
          const textArea = document.createElement("textarea");
          textArea.value = citations[format];
          document.body.appendChild(textArea);
          textArea.select();
          document.execCommand("copy");
          document.body.removeChild(textArea);
          setCopiedFormat(format);
          setTimeout(() => setCopiedFormat(null), 2000);
        }
      })();
    },
    [citations],
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
        className={`bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 ${className}`}
      >
        <div className="flex items-center justify-between">
          <div className="text-sm text-blue-800 dark:text-blue-200">
            <span className="font-medium">Citation:</span> Irsova et al., Nature
            Communications, 2025.
          </div>
          <button
            onClick={() => handleCopy("plain")}
            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 text-sm font-medium transition-colors"
          >
            {copiedFormat === "plain" ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6 ${className}`}
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            {TEXT.citation.title}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {TEXT.citation.description}
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

      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 mb-4 border border-gray-200 dark:border-gray-700">
        <p className="text-gray-800 dark:text-gray-200 text-sm leading-relaxed">
          {citations.apa}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["apa", "bibtex", "ris", "plain"] as CitationFormat[]).map(
          (format) => (
            <button
              key={format}
              onClick={() => handleCopy(format)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                copiedFormat === format
                  ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 border border-green-300 dark:border-green-700"
                  : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-300 dark:hover:border-blue-600"
              }`}
            >
              {copiedFormat === format
                ? TEXT.citation.copied
                : format.toUpperCase()}
            </button>
          ),
        )}
      </div>

      <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
        <a
          href={CONST.MAIVE_PAPER_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 dark:text-blue-400 hover:underline"
        >
          {TEXT.citation.viewPaper}
        </a>
      </div>
    </div>
  );
};

export default CitationBox;
