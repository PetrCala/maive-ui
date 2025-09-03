import type { ReactNode } from "react";

type LoadingCardProps = {
  title: string;
  subtitle?: string;
  color?: "blue" | "purple";
  size?: "sm" | "md" | "lg";
  className?: string;
  children?: ReactNode;
  showSpinner?: boolean;
};

export default function LoadingCard({
  title,
  subtitle,
  color = "blue",
  size = "md",
  className = "",
  children,
  showSpinner = true,
}: LoadingCardProps) {
  const sizeClasses = {
    sm: "p-6 max-w-sm",
    md: "p-8 max-w-md",
    lg: "p-10 max-w-lg",
  };

  const spinnerSizeClasses = {
    sm: "h-8 w-8",
    md: "h-12 w-12",
    lg: "h-16 w-16",
  };

  const textSizeClasses = {
    sm: "text-base",
    md: "text-lg",
    lg: "text-xl",
  };

  const subtitleSizeClasses = {
    sm: "text-sm",
    md: "text-sm",
    lg: "text-base",
  };

  const colorClasses = {
    blue: "text-blue-600 dark:text-blue-400",
    purple: "text-purple-600 dark:text-purple-400",
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 flex flex-col items-center w-full transition-all duration-500 opacity-100 scale-100 animate-fade-in">
      <div
        className={`${sizeClasses[size]} flex flex-col items-center ${className}`}
      >
        {showSpinner && (
          <svg
            className={`animate-spin ${spinnerSizeClasses[size]} ${colorClasses[color]} mb-4`}
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
            ></path>
          </svg>
        )}

        <span
          className={`${textSizeClasses[size]} font-medium text-gray-700 dark:text-gray-200 text-center`}
        >
          {title}
        </span>

        {subtitle && (
          <span
            className={`${subtitleSizeClasses[size]} text-gray-500 dark:text-gray-400 mt-2 text-center`}
          >
            {subtitle}
          </span>
        )}

        {children}
      </div>
    </div>
  );
}
