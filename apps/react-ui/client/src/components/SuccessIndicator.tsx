export default function SuccessIndicator() {
  return (
    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-green-100 border border-green-300 dark:bg-green-900/50 dark:border-green-700 p-0">
      <svg
        className="w-10 h-10 text-green-600 dark:text-green-300"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle
          cx="12"
          cy="12"
          r="11"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M8 12l2.5 2.5L16 9"
        />
      </svg>
    </span>
  );
}
