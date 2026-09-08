import { describe, it, expect } from "vitest";
import {
  SE_DEGENERATE_RELATIVE_TOLERANCE,
  describeDegenerateSeColumn,
  formatSeDegenerateOnePartIn,
  summarizeDegenerateSeColumn,
} from "@src/lib/seVariation";

describe("summarizeDegenerateSeColumn", () => {
  it("flags a literally constant column", () => {
    expect(summarizeDegenerateSeColumn([0.1, 0.1, 0.1, 0.1])).toEqual({
      count: 4,
      first: 0.1,
    });
  });

  it("flags a column whose spread is below the relative tolerance", () => {
    // The issue's example: two distinct values five parts per million apart.
    const values = Array.from({ length: 400 }, (_, index) =>
      index % 2 === 0 ? 0.1 : 0.1000005,
    );
    expect(summarizeDegenerateSeColumn(values)).toEqual({
      count: 400,
      first: 0.1,
    });
  });

  it("accepts a column with 1% variation", () => {
    expect(summarizeDegenerateSeColumn([0.1, 0.101, 0.1, 0.101])).toBeNull();
  });

  it("accepts a column just above the tolerance", () => {
    const spread = SE_DEGENERATE_RELATIVE_TOLERANCE * 2;
    expect(summarizeDegenerateSeColumn([0.1, 0.1 * (1 + spread)])).toBeNull();
  });

  it("ignores non-finite and non-numeric entries", () => {
    expect(
      summarizeDegenerateSeColumn([0.1, "abc", null, Infinity, "0.1"]),
    ).toEqual({ count: 2, first: 0.1 });
  });

  it("needs at least two finite values", () => {
    expect(summarizeDegenerateSeColumn([0.1])).toBeNull();
    expect(summarizeDegenerateSeColumn([])).toBeNull();
  });

  it("never flags an all-zero column (left to the positivity check)", () => {
    expect(summarizeDegenerateSeColumn([0, 0, 0])).toBeNull();
  });
});

describe("describeDegenerateSeColumn", () => {
  it("derives 'one part in N' from the tolerance", () => {
    expect(formatSeDegenerateOnePartIn()).toBe(
      Math.round(1 / SE_DEGENERATE_RELATIVE_TOLERANCE).toLocaleString("en-US"),
    );
    expect(formatSeDegenerateOnePartIn()).toBe("100,000");
  });

  it("states the spread rather than claiming the values are all equal (#572)", () => {
    const message = describeDegenerateSeColumn("`se`", {
      count: 400,
      first: 0.1,
    });
    expect(message).toBe(
      "The `se` column has no usable variation: its 400 values vary by less than one part in 100,000 (the first is 0.1).",
    );
    expect(message).not.toMatch(/are all/);
  });

  it("rounds the first value to six significant digits", () => {
    expect(
      describeDegenerateSeColumn("se", { count: 3, first: 0.123456789 }),
    ).toContain("(the first is 0.123457)");
  });
});
