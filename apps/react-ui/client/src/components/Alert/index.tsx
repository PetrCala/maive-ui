import type { AlertProps } from "./types";
import CONST from "@src/CONST";

const Alert = ({
  message,
  type = CONST.ALERT_TYPES.INFO,
  className = "",
  onClick,
  standalone = false,
  role = "alert",
}: AlertProps) => {
  const getAlertStyles = () => {
    switch (type) {
      case CONST.ALERT_TYPES.WARNING:
        return "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-200";
      case CONST.ALERT_TYPES.INFO:
        return "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200";
      case CONST.ALERT_TYPES.ERROR:
        return "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200";
      case CONST.ALERT_TYPES.SUCCESS:
        return "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200";
      default:
        return "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-200";
    }
  };

  const getIcon = () => {
    switch (type) {
      case CONST.ALERT_TYPES.WARNING:
        return (
          <svg
            className="w-5 h-5 text-yellow-400 dark:text-yellow-300"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
        );
      case CONST.ALERT_TYPES.INFO:
        return (
          <svg
            className="w-5 h-5 text-blue-400 dark:text-blue-300"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              clipRule="evenodd"
            />
          </svg>
        );
      case CONST.ALERT_TYPES.ERROR:
        return (
          <svg
            className="w-5 h-5 text-red-400 dark:text-red-300"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
        );
      case CONST.ALERT_TYPES.SUCCESS:
        return (
          <svg
            className="w-5 h-5 text-green-400 dark:text-green-300"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div
      className={`flex items-start p-4 rounded-lg border ${getAlertStyles()} ${!!standalone ? "min-w-[250px] max-w-xs opacity-95" : ""} ${className} ${onClick ? "cursor-pointer" : "cursor-default"}`}
      onClick={onClick}
      role={role}
      aria-live={role === "status" ? "polite" : undefined}
    >
      <div className="flex-shrink-0 mr-3 mt-0.5">{getIcon()}</div>
      <div className="flex-1">
        <p className="text-sm font-medium">{message}</p>
      </div>
    </div>
  );
};

export default Alert;
