import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import Tooltip from "@components/Tooltip";

type Rect = { top: number; bottom: number };

/**
 * jsdom has no layout, so mock the rectangles the component measures. The
 * tooltip rectangle describes where the tooltip would sit before any shift.
 */
function mockRects({
  tooltip,
  trigger,
  header = { top: 0, bottom: 0 },
}: {
  tooltip: Rect;
  trigger: Rect;
  header?: Rect;
}) {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function mockRect(this: HTMLElement) {
      let rect = trigger;
      if (this.getAttribute("role") === "tooltip") {
        rect = tooltip;
      } else if (this.tagName === "HEADER") {
        rect = header;
      }
      return {
        top: rect.top,
        bottom: rect.bottom,
        height: rect.bottom - rect.top,
        left: 0,
        right: 0,
        width: 0,
        x: 0,
        y: rect.top,
        toJSON: () => ({}),
      } as DOMRect;
    },
  );
}

function setViewport(width: number, height: number) {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: width,
  });
  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    writable: true,
    value: height,
  });
}

function getTrigger(): HTMLElement {
  const wrapper = screen.getByText("trigger").parentElement;
  if (!wrapper) {
    throw new Error("Tooltip wrapper not found");
  }
  return wrapper;
}

function getArrow(tooltip: HTMLElement): HTMLElement | null {
  return tooltip.querySelector("div.rotate-45");
}

function renderAndHover(
  content: React.ReactNode = "Hint",
  props: Partial<React.ComponentProps<typeof Tooltip>> = {},
) {
  render(
    <Tooltip content={content} {...props}>
      <span>trigger</span>
    </Tooltip>,
  );
  act(() => {
    fireEvent.mouseEnter(getTrigger());
  });
  return screen.getByRole("tooltip");
}

describe("Tooltip", () => {
  beforeEach(() => {
    setViewport(1280, 720);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps the default centred placement when the tooltip fits", () => {
    mockRects({
      tooltip: { top: 300, bottom: 360 },
      trigger: { top: 320, bottom: 340 },
    });

    const tooltip = renderAndHover("Short hint");

    expect(tooltip).toHaveClass("sm:absolute");
    expect(tooltip.style.transform).toBe("translateY(-50%)");
    expect(tooltip.style.maxHeight).toBe("calc(100vh - 16px)");
    expect(tooltip.style.pointerEvents).toBe("none");
  });

  it("shifts a tall tooltip down when it would overflow the viewport top", () => {
    mockRects({
      tooltip: { top: -200, bottom: 300 },
      trigger: { top: 40, bottom: 60 },
    });

    const tooltip = renderAndHover();

    // Natural top is -200, so a shift of 208 puts the top at the 8px margin.
    expect(tooltip.style.transform).toBe("translateY(calc(-50% + 208px))");
  });

  it("shifts a tooltip up when it would overflow the viewport bottom", () => {
    mockRects({
      tooltip: { top: 500, bottom: 900 },
      trigger: { top: 690, bottom: 710 },
    });

    const tooltip = renderAndHover();

    // Natural bottom is 900 and the viewport allows 712, so shift up by 188.
    expect(tooltip.style.transform).toBe("translateY(calc(-50% + -188px))");
  });

  it("caps content taller than the viewport and keeps it inside the margins", () => {
    mockRects({
      tooltip: { top: -100, bottom: 1000 },
      trigger: { top: 440, bottom: 460 },
    });

    const tooltip = renderAndHover();

    // The 1100px box is capped at 704px; being centred, its top moves down by
    // 198 to 98 and its bottom (802) then has to come up by 90 to reach 712.
    expect(tooltip.style.maxHeight).toBe("calc(100vh - 16px)");
    expect(tooltip.style.transform).toBe("translateY(calc(-50% + -90px))");
  });

  it("keeps the arrow on the trigger after a shift and hides it when it cannot reach", () => {
    mockRects({
      tooltip: { top: -20, bottom: 180 },
      trigger: { top: 40, bottom: 60 },
    });
    const tooltip = renderAndHover("Hint", { shouldShowArrow: true });

    // Shift is 28, so the tooltip top lands at 8 and the trigger centre (50)
    // sits 42px below it; the 8px arrow is centred there.
    const arrow = getArrow(tooltip);
    expect(arrow).not.toBeNull();
    expect(arrow?.style.top).toBe("38px");
  });

  it("hides the arrow when the shift moves the tooltip away from the trigger", () => {
    mockRects({
      tooltip: { top: -400, bottom: 100 },
      trigger: { top: -160, bottom: -140 },
    });
    const tooltip = renderAndHover("Hint", { shouldShowArrow: true });

    expect(tooltip.style.transform).toBe("translateY(calc(-50% + 408px))");
    expect(getArrow(tooltip)).toBeNull();
  });

  it("keeps the tooltip below a header pinned to the top of the viewport", () => {
    const header = document.createElement("header");
    header.style.position = "fixed";
    document.body.appendChild(header);
    mockRects({
      tooltip: { top: 30, bottom: 330 },
      trigger: { top: 170, bottom: 190 },
      header: { top: 0, bottom: 69 },
    });

    const tooltip = renderAndHover();

    // The usable top is 69 + 8 = 77, so the tooltip moves down by 47.
    expect(tooltip.style.transform).toBe("translateY(calc(-50% + 47px))");
    expect(tooltip.style.maxHeight).toBe("calc(100vh - 85px)");
    header.remove();
  });

  it("keeps the fixed below-trigger layout on mobile", () => {
    setViewport(375, 812);
    mockRects({
      tooltip: { top: 0, bottom: 400 },
      trigger: { top: 100, bottom: 140 },
    });

    const tooltip = renderAndHover();

    expect(tooltip).toHaveClass("fixed");
    expect(tooltip.style.top).toBe("148px");
    expect(tooltip.style.transform).toBe("");
    expect(tooltip.style.maxHeight).toBe("");
  });

  it("does not render when visibility is controlled off", () => {
    render(
      <Tooltip content="Hint" visible={false}>
        <span>trigger</span>
      </Tooltip>,
    );
    fireEvent.mouseEnter(getTrigger());

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });
});
