import type { ReactNode } from "react";

type ActionButtonProps = {
  onClick?: (event?: React.FormEvent) => void;
  variant?: "primary" | "secondary" | "success" | "danger";
  size?: "sm" | "md" | "lg";
  className?: string;
  disabled?: boolean;
  children: ReactNode;
  title?: string;
  type?: "button" | "submit" | "reset";
  href?: string;
  style?: React.CSSProperties;
};

export default function ActionButton({
  onClick,
  variant = "primary",
  size = "md",
  className = "",
  disabled = false,
  children,
  title,
  type = "button",
  href,
  style,
}: ActionButtonProps) {
  const sizeClasses = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-base",
    lg: "px-6 py-3 text-lg",
  };

  const baseClasses = `${sizeClasses[size]} rounded-lg transition-colors duration-200 font-medium`;

  const variantClasses = {
    primary:
      "btn-primary disabled:bg-gray-300 disabled:text-gray-600 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-gray-300 disabled:hover:shadow-none disabled:transform-none",
    secondary:
      "btn-secondary disabled:bg-gray-300 disabled:text-gray-600 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-gray-300 disabled:hover:shadow-none disabled:transform-none",
    success:
      "interactive bg-green-600 text-white disabled:bg-gray-300 disabled:text-gray-600 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-gray-300 disabled:hover:shadow-none disabled:transform-none",
    danger:
      "interactive bg-red-600 text-white disabled:bg-gray-300 disabled:text-gray-600 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-gray-300 disabled:hover:shadow-none disabled:transform-none",
  };

  const classes = `${baseClasses} ${variantClasses[variant]} ${disabled ? "cursor-not-allowed" : ""} ${className}`;

  // If href is provided, render as a link
  if (href) {
    return (
      <a href={href} className={classes} title={title} style={style}>
        {children}
      </a>
    );
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={classes}
      title={title}
      type={type}
      style={style}
    >
      {children}
    </button>
  );
}
