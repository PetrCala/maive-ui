import { describe, it, expect } from "vitest";
import { hasNObsColumn } from "@src/utils/dataUtils";

describe("hasNObsColumn", () => {
  it("detects a canonical n_obs column", () => {
    expect(hasNObsColumn([{ effect: 0.1, se: 0.2, n_obs: 100 }])).toBe(true);
  });

  it("is false for a two-column effect/se dataset", () => {
    expect(hasNObsColumn([{ effect: 0.1, se: 0.2 }])).toBe(false);
  });

  it("is false for empty or missing data", () => {
    expect(hasNObsColumn([])).toBe(false);
    expect(hasNObsColumn(undefined)).toBe(false);
  });

  it("ignores a study_id column when deciding", () => {
    expect(hasNObsColumn([{ effect: 0.1, se: 0.2, study_id: "a" }])).toBe(
      false,
    );
  });
});
