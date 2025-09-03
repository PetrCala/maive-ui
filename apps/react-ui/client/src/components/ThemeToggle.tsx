"use client";

import { useTheme } from "@providers/ThemeProvider";
import HoverableIconButton from "@src/components/Buttons/HoverableIconButton";
import { FaMoon, FaSun } from "react-icons/fa";

type ThemeToggleProps = {
  className?: string;
  buttonClassName?: string;
};

export default function ThemeToggle({
  className = "",
  buttonClassName = "",
}: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <HoverableIconButton
      ariaLabel={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
      icon={theme === "light" ? <FaMoon /> : <FaSun />}
      onClick={toggleTheme}
      className={className}
      buttonClassName={buttonClassName}
    />
  );
}
