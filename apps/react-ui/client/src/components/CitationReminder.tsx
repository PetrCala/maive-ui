"use client";

import TEXT from "@src/lib/text";

type CitationReminderProps = {
  className?: string;
  variant?: "default" | "compact";
};

const CitationReminder = ({
  className = "",
  variant = "default",
}: CitationReminderProps) => {
  if (variant === "compact") {
    return (
      <div
        className={`p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg ${className}`}
      >
        <div className="flex items-center space-x-2">
          <div className="flex-shrink-0 text-blue-600 dark:text-blue-400">
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <p className="text-xs text-blue-800 dark:text-blue-200">
            <span className="font-medium">Citation:</span>{" "}
            {TEXT.citation.reminder.text}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg ${className}`}
    >
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0 text-blue-600 dark:text-blue-400">
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <div className="text-sm text-blue-800 dark:text-blue-200">
          <p className="font-medium mb-1">{TEXT.citation.reminder.title}</p>
          <p>{TEXT.citation.reminder.text}</p>
        </div>
      </div>
    </div>
  );
};

export default CitationReminder;
