import { useState } from "react";

type DownloadButtonProps = {
  onClick: () => void;
  className?: string;
  disabled?: boolean;
  children?: React.ReactNode;
  title?: string;
};

export default function DownloadButton({
  onClick,
  className = "",
  disabled = false,
  children, // eslint-disable-line @typescript-eslint/no-unused-vars
  title = "Download",
}: DownloadButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const buttonSize = "clamp(1.5rem, 1.5rem + 1vw, 2.5rem)";
  const iconSizeClass = "h-[55%] w-[55%]";

  const handleClick = () => {
    if (disabled || isLoading) {
      return;
    }

    setIsLoading(true);
    try {
      onClick();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled || isLoading}
      className={`inline-flex items-center justify-center text-sm font-medium bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors duration-200 text-white shadow-md hover:shadow-lg rounded-lg ${className}`}
      style={{
        width: buttonSize,
        height: buttonSize,
      }}
      title={title}
    >
      {isLoading ? (
        <svg
          className={`animate-spin text-white ${iconSizeClass}`}
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
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
      ) : (
        <svg
          className={iconSizeClass}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      )}
    </button>
  );
}
