import type { ReactNode } from "react";
import { forwardRef } from "react";
import Link from "next/link";

type ActionButtonProps = {
  onClick?: (event?: React.FormEvent) => void;
  variant?: "primary" | "secondary" | "success" | "danger" | "purple";
  size?: "sm" | "md" | "lg";
  className?: string;
  disabled?: boolean;
  children: ReactNode;
  title?: string;
  type?: "button" | "submit" | "reset";
  href?: string;
  style?: React.CSSProperties;
};

const ActionButton = forwardRef<HTMLButtonElement, ActionButtonProps>(
  (
    {
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
    },
    ref,
  ) => {
    const sizeClasses = {
      sm: "py-1.5 text-sm",
      md: "py-2 text-base",
      lg: "py-3 text-lg",
    };

    const hasCustomPadding = className.includes("px-");
    const paddingClasses = hasCustomPadding
      ? ""
      : {
          sm: "px-3",
          md: "px-4",
          lg: "px-6",
        }[size];

    const baseClasses = `${sizeClasses[size]} ${paddingClasses} rounded-lg transition-colors duration-200 font-medium justify-center items-center`;

    const variantClasses = {
      primary:
        "btn-primary disabled:bg-gray-300 disabled:text-gray-600 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-gray-300 disabled:hover:shadow-none disabled:transform-none",
      secondary:
        "btn-secondary disabled:bg-gray-300 disabled:text-gray-600 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-gray-300 disabled:hover:shadow-none disabled:transform-none",
      success:
        "btn-success disabled:bg-gray-300 disabled:text-gray-600 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-gray-300 disabled:hover:shadow-none disabled:transform-none",
      danger:
        "btn-danger disabled:bg-gray-300 disabled:text-gray-600 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-gray-300 disabled:hover:shadow-none disabled:transform-none",
      purple:
        "btn-purple disabled:bg-gray-300 disabled:text-gray-600 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-gray-300 disabled:hover:shadow-none disabled:transform-none",
    };

    const classes = `${baseClasses} ${variantClasses[variant]} ${disabled ? "cursor-not-allowed" : ""} ${className}`;

    if (href) {
      return (
        <Link href={href} className={classes} title={title} style={style}>
          {children}
        </Link>
      );
    }

    return (
      <button
        ref={ref}
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
  },
);

ActionButton.displayName = "ActionButton";

export default ActionButton;
