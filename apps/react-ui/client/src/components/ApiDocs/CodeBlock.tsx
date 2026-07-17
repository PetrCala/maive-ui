"use client";

import { useCallback, useState } from "react";
import { copyToClipboard } from "@src/utils/citationUtils";

type CodeBlockProps = {
  code: string;
  /** Accessible name for the copy button, e.g. "curl example". */
  label: string;
  className?: string;
};

const CodeBlock = ({ code, label, className = "" }: CodeBlockProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    void (async () => {
      const succeeded = await copyToClipboard(code);
      if (!succeeded) {
        return;
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    })();
  }, [code]);

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={handleCopy}
        aria-label={`Copy ${label}`}
        className="absolute right-2 top-2 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-xs font-medium text-secondary hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
        {copied ? "Copied!" : "Copy"}
      </button>
      <pre className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 pr-16 overflow-x-auto">
        <code className="text-sm font-mono text-gray-800 dark:text-gray-200 whitespace-pre">
          {code}
        </code>
      </pre>
    </div>
  );
};

export default CodeBlock;
