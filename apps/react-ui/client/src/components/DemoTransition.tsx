export default function DemoTransition() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 flex flex-col items-center w-full max-w-md mx-auto animate-fade-in">
        <svg
          className="animate-spin h-12 w-12 text-purple-600 dark:text-purple-400 mb-4"
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
        <span className="text-lg font-medium text-gray-700 dark:text-gray-200 text-center">
          Loading Demo Data...
        </span>
      </div>
    </div>
  );
}
