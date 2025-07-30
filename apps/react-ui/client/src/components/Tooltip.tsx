"use client";

import { useState, useRef, useEffect } from "react";

interface TooltipProps {
  children: React.ReactNode;
  content: string;
  position?: "top" | "bottom" | "left" | "right";
  className?: string;
  shouldShowArrow?: boolean;
  visible?: boolean; // if set, controls visibility externally
}

/**
 * Tooltip component that displays a tooltip with customizable content and position
 * when hovering over its child element. Supports optional arrow, custom className,
 * and controlled visibility.
 *
 * @param props - Tooltip component props
 * @param props.children - The element that triggers the tooltip on hover
 * @param props.content - The text or content to display inside the tooltip
 * @param props.position - Position of the tooltip relative to the trigger
 * @param props.className - Additional class names for the tooltip
 * @param props.shouldShowArrow - Whether to display an arrow on the tooltip
 * @param props.visible - If set, controls tooltip visibility externally. When undefined, the tooltip visibility is controlled by the component itself. When this is set to true, the bevavior is the same as when it is undefined. When set to false, the tooltip is not displayed.
 * @returns Tooltip component wrapping the children
 */
function Tooltip({
  children,
  content,
  position = "top",
  className = "",
  shouldShowArrow = false,
  visible,
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    setIsVisible(true);
  };

  const handleMouseLeave = () => {
    setIsVisible(false);
  };

  return (
    <div
      ref={triggerRef}
      className={`relative inline-block ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {isVisible && (visible !== undefined ? visible : true) && (
        <div
          className="absolute z-50 px-3 py-2 text-sm text-white bg-black dark:bg-gray-800 rounded-lg shadow-xl max-w-xs pointer-events-none transition-opacity duration-200 border border-gray-200 dark:border-gray-600 whitespace-normal"
          style={{
            left: "100%",
            top: "0",
            marginLeft: "10px",
            transform: "translateY(-50%)",
          }}
        >
          {content}
          {shouldShowArrow && (
            <div className="absolute w-2 h-2 bg-black dark:bg-gray-800 transform rotate-45 -top-1 -left-1 border-l border-t border-gray-200 dark:border-gray-600"></div>
          )}
        </div>
      )}
    </div>
  );
}

export type { TooltipProps };
export default Tooltip;
