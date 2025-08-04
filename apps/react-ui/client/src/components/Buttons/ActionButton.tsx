import { ReactNode } from "react";

interface ActionButtonProps {
  onClick: () => void;
  variant?: "primary" | "secondary" | "success" | "danger";
  className?: string;
  disabled?: boolean;
  children: ReactNode;
  title?: string;
}

export default function ActionButton({
  onClick,
  variant = "primary",
  className = "",
  disabled = false,
  children,
  title,
}: ActionButtonProps) {
  const baseClasses =
    "px-4 py-2 rounded-lg transition-colors duration-200 font-medium";

  const variantClasses = {
    primary: "btn-primary disabled:bg-primary-400 disabled:cursor-not-allowed",
    secondary: "btn-secondary disabled:bg-gray-400 disabled:cursor-not-allowed",
    success: "bg-green-600 hover:bg-green-700 text-white disabled:bg-green-400",
    danger: "bg-red-600 hover:bg-red-700 text-white disabled:bg-red-400",
  };

  const classes = `${baseClasses} ${variantClasses[variant]} ${disabled ? "cursor-not-allowed" : ""} ${className}`;

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={classes}
      title={title}
    >
      {children}
    </button>
  );
}
