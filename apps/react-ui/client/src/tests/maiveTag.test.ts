import { describe, it, expect } from "vitest";
import { formatMaiveTagForDisplay, maiveSourceHref } from "@src/lib/maiveTag";

const REPO = "https://github.com/PetrCala/MAIVE";

describe("formatMaiveTagForDisplay", () => {
  it("adds a leading v to a bare version", () => {
    expect(formatMaiveTagForDisplay("0.4.0")).toBe("v0.4.0");
  });

  it("keeps a tag that already has one", () => {
    expect(formatMaiveTagForDisplay("v0.2.5")).toBe("v0.2.5");
  });

  it("passes unknown through", () => {
    expect(formatMaiveTagForDisplay("unknown")).toBe("unknown");
  });
});

describe("maiveSourceHref", () => {
  it("links to the tag exactly as written, without adding a v", () => {
    expect(maiveSourceHref("0.4.0", REPO)).toBe(`${REPO}/tree/0.4.0`);
  });

  it("keeps a v tag as it is", () => {
    expect(maiveSourceHref("v0.2.5", REPO)).toBe(`${REPO}/tree/v0.2.5`);
  });

  it("links to the repository until the tag is known", () => {
    expect(maiveSourceHref("unknown", REPO)).toBe(REPO);
  });
});
