"use client";

import { useState, useRef, useLayoutEffect, useCallback } from "react";

type TooltipProps = {
  children: React.ReactNode;
  content: string | React.ReactNode;
  position?: "top" | "bottom" | "left" | "right";
  className?: string;
  shouldShowArrow?: boolean;
  visible?: boolean; // if set, controls visibility externally
};

/** Minimum distance kept between the tooltip and the viewport edges (px). */
const VIEWPORT_MARGIN = 8;
/** Below this viewport width the tooltip switches to the mobile layout. */
const MOBILE_BREAKPOINT = 640;
/** Side length of the rotated square used as the arrow (px). */
const ARROW_SIZE = 8;

type DesktopPlacement = {
  /** Extra vertical shift applied on top of the default centring (px). */
  offsetY: number;
  /** Height of a header pinned to the top of the viewport (px). */
  topInset: number;
  /** Arrow top edge inside the tooltip, or null when it would fall outside. */
  arrowTop: number | null;
  /** Whether the content is taller than the tooltip box and has to scroll. */
  needsScroll: boolean;
};

const DEFAULT_PLACEMENT: DesktopPlacement = {
  offsetY: 0,
  topInset: 0,
  arrowTop: null,
  needsScroll: false,
};

function isSamePlacement(a: DesktopPlacement, b: DesktopPlacement): boolean {
  return (
    a.offsetY === b.offsetY &&
    a.topInset === b.topInset &&
    a.arrowTop === b.arrowTop &&
    a.needsScroll === b.needsScroll
  );
}

/**
 * The page header is sticky and sits above the tooltip's stacking context, so
 * anything placed under it is hidden. Treat its bottom edge as the usable top of
 * the viewport whenever it is pinned there.
 */
function getViewportTopInset(): number {
  const header = document.querySelector("header");
  if (!header) {
    return 0;
  }
  const { position } = window.getComputedStyle(header);
  if (position !== "sticky" && position !== "fixed") {
    return 0;
  }
  const rect = header.getBoundingClientRect();
  if (rect.top > 0 || rect.bottom <= 0) {
    return 0;
  }
  return rect.bottom;
}

function getDesktopTransform(offsetY: number): string {
  if (offsetY === 0) {
    return "translateY(-50%)";
  }
  return `translateY(calc(-50% + ${offsetY}px))`;
}

/**
 * Tooltip component that displays a tooltip with customizable content and position
 * when hovering over its child element. Supports optional arrow, custom className,
 * and controlled visibility.
 *
 * On desktop the tooltip sits to the right of the trigger, vertically centred on
 * it. After it mounts it is measured and, when it would leave the viewport, shifted
 * so that it stays at least a small margin inside the top and bottom edges. Content
 * taller than the viewport is capped and scrolls inside the tooltip. On mobile it
 * is rendered fixed below the trigger.
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
  position = "top", // eslint-disable-line @typescript-eslint/no-unused-vars
  className = "",
  shouldShowArrow = false,
  visible,
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [placement, setPlacement] =
    useState<DesktopPlacement>(DEFAULT_PLACEMENT);
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  // Mirrors the shift currently painted in the DOM so a measurement can undo it.
  const appliedOffsetRef = useRef(0);

  const shown = isVisible && (visible ?? true);
  const isMobile =
    typeof window !== "undefined" && window.innerWidth < MOBILE_BREAKPOINT;

  const handleMouseEnter = () => {
    setIsVisible(true);
  };

  const handleMouseLeave = () => {
    setIsVisible(false);
  };

  const updatePlacement = useCallback(() => {
    const tooltip = tooltipRef.current;
    const trigger = triggerRef.current;
    if (!tooltip || !trigger || isMobile) {
      appliedOffsetRef.current = 0;
      setPlacement(DEFAULT_PLACEMENT);
      return;
    }

    const rect = tooltip.getBoundingClientRect();
    const topInset = getViewportTopInset();
    const viewportTop = topInset + VIEWPORT_MARGIN;
    const viewportBottom = window.innerHeight - VIEWPORT_MARGIN;
    // The height cap may not be painted yet when the inset was just discovered.
    // The box is centred on the trigger, so a shorter box starts lower by half
    // the difference; fold that in so the first placement is already final.
    const height = Math.min(rect.height, viewportBottom - viewportTop);
    // Undo the shift that is already painted so we reason about the natural spot.
    const naturalTop =
      rect.top - appliedOffsetRef.current + (rect.height - height) / 2;
    const naturalBottom = naturalTop + height;

    let offsetY = 0;
    if (naturalBottom > viewportBottom) {
      offsetY = viewportBottom - naturalBottom;
    }
    // The top edge wins: a tooltip taller than the viewport keeps its first lines.
    if (naturalTop + offsetY < viewportTop) {
      offsetY = viewportTop - naturalTop;
    }

    const triggerRect = trigger.getBoundingClientRect();
    const anchorY = triggerRect.top + triggerRect.height / 2;
    const tooltipTop = naturalTop + offsetY;
    const arrowTop = anchorY - tooltipTop - ARROW_SIZE / 2;
    const arrowFits =
      arrowTop >= ARROW_SIZE / 2 && arrowTop <= height - ARROW_SIZE * 1.5;

    const contentEl = contentRef.current;
    const needsScroll = contentEl
      ? contentEl.scrollHeight > contentEl.clientHeight
      : false;

    appliedOffsetRef.current = offsetY;
    const next: DesktopPlacement = {
      offsetY,
      topInset,
      arrowTop: arrowFits ? arrowTop : null,
      needsScroll,
    };
    setPlacement((prev) => (isSamePlacement(prev, next) ? prev : next));
  }, [isMobile]);

  useLayoutEffect(() => {
    if (!shown) {
      appliedOffsetRef.current = 0;
      setPlacement(DEFAULT_PLACEMENT);
      return undefined;
    }
    updatePlacement();
    window.addEventListener("resize", updatePlacement);
    window.addEventListener("scroll", updatePlacement, true);
    // Re-measure when the content changes size (e.g. late-loading rich text).
    const observer =
      typeof ResizeObserver !== "undefined" && tooltipRef.current
        ? new ResizeObserver(updatePlacement)
        : null;
    if (observer && tooltipRef.current) {
      observer.observe(tooltipRef.current);
    }
    return () => {
      window.removeEventListener("resize", updatePlacement);
      window.removeEventListener("scroll", updatePlacement, true);
      observer?.disconnect();
    };
  }, [shown, updatePlacement]);

  const textStyle: React.CSSProperties = {
    wordWrap: "break-word",
    overflowWrap: "break-word",
    hyphens: "auto",
    lineHeight: "1.4",
    whiteSpace: "pre-line",
  };

  const boxStyle: React.CSSProperties = isMobile
    ? {
        top: triggerRef.current
          ? `${triggerRef.current.getBoundingClientRect().bottom + 8}px`
          : undefined,
        maxWidth: "calc(100vw - 2rem)",
        ...textStyle,
      }
    : {
        marginLeft: "10px",
        transform: getDesktopTransform(placement.offsetY),
        maxWidth: "min(280px, 90vw)",
        minWidth: "min(200px, 80vw)",
        maxHeight: `calc(100vh - ${placement.topInset + VIEWPORT_MARGIN * 2}px)`,
        display: "flex",
        flexDirection: "column",
        // Let the pointer reach the tooltip only when there is something to scroll.
        pointerEvents: placement.needsScroll ? "auto" : "none",
        ...textStyle,
      };

  const arrow = (() => {
    if (!shouldShowArrow) {
      return null;
    }
    if (isMobile) {
      return (
        <div className="absolute w-2 h-2 surface-elevated transform rotate-45 -top-1 -left-1 border-l border-t border-primary"></div>
      );
    }
    if (placement.arrowTop === null) {
      return null;
    }
    return (
      <div
        className="absolute w-2 h-2 surface-elevated transform rotate-45 -left-1 border-l border-b border-primary"
        style={{ top: `${placement.arrowTop}px` }}
      ></div>
    );
  })();

  return (
    <div
      ref={triggerRef}
      className={`relative inline-block ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {shown && (
        <div
          ref={tooltipRef}
          role="tooltip"
          className="fixed sm:absolute left-4 right-4 sm:left-full sm:right-auto sm:top-0 z-50 px-3 py-2 text-sm surface-elevated rounded-lg shadow-xl pointer-events-none transition-opacity duration-200 border border-primary w-auto sm:w-auto"
          style={boxStyle}
        >
          {isMobile ? (
            content
          ) : (
            <div
              ref={contentRef}
              style={{
                minHeight: 0,
                overflowY: placement.needsScroll ? "auto" : "visible",
              }}
            >
              {content}
            </div>
          )}
          {arrow}
        </div>
      )}
    </div>
  );
}

export type { TooltipProps };
export default Tooltip;
