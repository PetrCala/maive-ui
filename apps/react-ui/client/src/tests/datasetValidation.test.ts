import { describe, it, expect } from "vitest";
import {
  MAX_ROWS,
  canonicalizeRows,
  resolveColumns,
  validateDataset,
} from "@api/server/datasetValidation";

const maiveRow = (
  effect: number,
  se: number,
  nObs: number,
  studyId?: string,
) => {
  const row: Record<string, unknown> = { effect, se, n_obs: nObs };
  if (studyId !== undefined) {
    row.study_id = studyId;
  }
  return row;
};

describe("resolveColumns", () => {
  it("resolves canonical column names when present", () => {
    const columns = resolveColumns([{ effect: 1, se: 2, n_obs: 3 }]);
    expect(columns).toEqual({
      effect: "effect",
      se: "se",
      nObs: "n_obs",
      studyId: undefined,
      byName: true,
    });
  });

  it("resolves canonical names case-insensitively", () => {
    const row: Record<string, number> = { Effect: 1, SE: 2 };
    row.N_Obs = 3;
    const columns = resolveColumns([row]);
    expect(columns).toEqual({
      effect: "Effect",
      se: "SE",
      nObs: "N_Obs",
      studyId: undefined,
      byName: true,
    });
  });

  it("falls back to positional resolution for non-canonical names", () => {
    const columns = resolveColumns([{ b: 0.5, s: 0.1, n: 100, study: "A" }]);
    expect(columns).toEqual({
      effect: "b",
      se: "s",
      nObs: "n",
      studyId: "study",
      byName: false,
    });
  });

  it("falls back positionally for a 2-column (RTMA-shaped) row", () => {
    const columns = resolveColumns([{ b: 0.5, s: 0.1 }]);
    expect(columns).toEqual({
      effect: "b",
      se: "s",
      nObs: undefined,
      studyId: undefined,
      byName: false,
    });
  });

  it("returns null for an empty row", () => {
    expect(resolveColumns([{}])).toBeNull();
  });

  it("resolves a 2-column RTMA payload by name even with keys in swapped order (#488)", () => {
    // Same shape as the issue's repro: `se` is the first key, `effect` the
    // second, and `n_obs` is absent (RTMA is a 2-column model). Requiring
    // `n_obs` before trusting the names used to force this through the
    // positional branch, which read `se`'s values as `effect` and vice versa.
    const columns = resolveColumns([{ se: 0.12, effect: -0.4 }]);
    expect(columns).toEqual({
      effect: "effect",
      se: "se",
      nObs: undefined,
      studyId: undefined,
      byName: true,
    });
  });
});

const resolveColumnsOrThrow = (rows: Array<Record<string, unknown>>) => {
  const columns = resolveColumns(rows);
  if (!columns) {
    throw new Error("expected resolveColumns to resolve columns");
  }
  return columns;
};

describe("canonicalizeRows", () => {
  it("reorders swapped effect/se keys into canonical column order (#488)", () => {
    const rows = [
      { se: 0.12, effect: -0.4 },
      { se: 0.08, effect: 0.25 },
    ];
    const columns = resolveColumnsOrThrow(rows);
    expect(columns.byName).toBe(true);
    expect(canonicalizeRows(rows, columns)).toEqual([
      { effect: -0.4, se: 0.12 },
      { effect: 0.25, se: 0.08 },
    ]);
  });

  it("is a no-op reshuffle for already-canonical MAIVE rows", () => {
    const rows = [
      { effect: 0.1, se: 0.2, n_obs: 10, study_id: "A" },
      { effect: 0.3, se: 0.1, n_obs: 20, study_id: "B" },
    ];
    const columns = resolveColumnsOrThrow(rows);
    expect(canonicalizeRows(rows, columns)).toEqual(rows);
  });

  it("keeps positional resolution's column order for non-canonical names", () => {
    const rows = [{ b: 0.5, s: 0.1, n: 100, study: "A" }];
    const columns = resolveColumnsOrThrow(rows);
    expect(columns.byName).toBe(false);
    expect(canonicalizeRows(rows, columns)).toEqual([
      { effect: 0.5, se: 0.1, n_obs: 100, study_id: "A" },
    ]);
  });
});

describe("validateDataset: MAIVE-family", () => {
  it("accepts a valid dataset", () => {
    const data = [
      maiveRow(0.42, 0.11, 120),
      maiveRow(0.31, 0.06, 90),
      maiveRow(0.55, 0.2, 45),
      maiveRow(0.12, 0.04, 200),
    ];
    expect(validateDataset(data, "MAIVE")).toBeNull();
  });

  it("rejects a non-array payload", () => {
    expect(validateDataset({ not: "an array" }, "MAIVE")?.message).toMatch(
      /non-empty array/,
    );
  });

  it("rejects fewer than 4 rows", () => {
    const data = [maiveRow(0.4, 0.1, 100), maiveRow(0.3, 0.1, 90)];
    expect(validateDataset(data, "MAIVE")?.message).toMatch(/at least 4 rows/);
  });

  it("rejects more than MAX_ROWS rows", () => {
    const data = Array.from({ length: MAX_ROWS + 1 }, () =>
      maiveRow(0.4, 0.1, 100),
    );
    expect(validateDataset(data, "MAIVE")?.message).toMatch(/at most .* rows/);
  });

  it("accepts exactly MAX_ROWS rows", () => {
    const data = Array.from({ length: MAX_ROWS }, () =>
      maiveRow(0.4, 0.1, 100),
    );
    expect(validateDataset(data, "MAIVE")).toBeNull();
  });

  it("rejects a 2-column dataset (missing n_obs)", () => {
    const data = [
      { effect: 0.1, se: 0.1 },
      { effect: 0.2, se: 0.1 },
      { effect: 0.3, se: 0.1 },
      { effect: 0.4, se: 0.1 },
    ];
    expect(validateDataset(data, "MAIVE")?.message).toMatch(
      /3 or 4 columns; found 2/,
    );
  });

  it("rejects non-numeric effect values", () => {
    const data = [
      maiveRow(0.1, 0.1, 10),
      { effect: "not-a-number", se: 0.1, n_obs: 10 },
      maiveRow(0.3, 0.1, 10),
      maiveRow(0.4, 0.1, 10),
    ];
    expect(validateDataset(data, "MAIVE")?.message).toMatch(
      /effect.*non-numeric/,
    );
  });

  it("rejects non-positive se", () => {
    const data = [
      maiveRow(0.1, 0.1, 10),
      maiveRow(0.2, 0, 10),
      maiveRow(0.3, 0.1, 10),
      maiveRow(0.4, 0.1, 10),
    ];
    expect(validateDataset(data, "MAIVE")?.message).toMatch(/se.*positive/);
  });

  it("rejects non-positive-integer n_obs", () => {
    const data = [
      maiveRow(0.1, 0.1, 10),
      maiveRow(0.2, 0.1, 10.5),
      maiveRow(0.3, 0.1, 10),
      maiveRow(0.4, 0.1, 10),
    ];
    expect(validateDataset(data, "MAIVE")?.message).toMatch(
      /n_obs.*positive integers/,
    );
  });

  it("rejects too few rows relative to unique study ids", () => {
    const data = [
      maiveRow(0.1, 0.1, 10, "A"),
      maiveRow(0.2, 0.1, 10, "B"),
      maiveRow(0.3, 0.1, 10, "C"),
      maiveRow(0.4, 0.1, 10, "D"),
    ];
    expect(validateDataset(data, "MAIVE")?.message).toMatch(
      /unique study IDs plus 3/,
    );
  });

  it("rejects more than 4 columns when resolving positionally", () => {
    const data = [
      { a: 0.1, b: 0.1, c: 10, d: "A", e: 1 },
      { a: 0.2, b: 0.1, c: 10, d: "A", e: 1 },
      { a: 0.3, b: 0.1, c: 10, d: "B", e: 1 },
      { a: 0.4, b: 0.1, c: 10, d: "B", e: 1 },
    ];
    expect(validateDataset(data, "MAIVE")?.message).toMatch(
      /3 or 4 columns; found 5/,
    );
  });

  it("tolerates extra columns when canonical names are present", () => {
    const data = [
      { effect: 0.1, se: 0.1, n_obs: 10, note: "x" },
      { effect: 0.2, se: 0.1, n_obs: 10, note: "x" },
      { effect: 0.3, se: 0.1, n_obs: 10, note: "x" },
      { effect: 0.4, se: 0.1, n_obs: 10, note: "x" },
    ];
    expect(validateDataset(data, "MAIVE")).toBeNull();
  });

  it("rejects empty study_id values", () => {
    const data = [
      maiveRow(0.1, 0.1, 10, "A"),
      maiveRow(0.2, 0.1, 10, ""),
      maiveRow(0.3, 0.1, 10, "A"),
      maiveRow(0.4, 0.1, 10, "B"),
      maiveRow(0.5, 0.1, 10, "B"),
      maiveRow(0.6, 0.1, 10, "B"),
    ];
    expect(validateDataset(data, "MAIVE")?.message).toMatch(
      /study_id.*empty values/,
    );
  });
});

describe("validateDataset: RTMA", () => {
  it("accepts a 2-column effect/se dataset", () => {
    const data = [
      { effect: 0.1, se: 0.1 },
      { effect: 0.2, se: 0.2 },
    ];
    expect(validateDataset(data, "RTMA")).toBeNull();
  });

  it("does not require 4 rows", () => {
    const data = [{ effect: 0.1, se: 0.1 }];
    expect(validateDataset(data, "RTMA")).toBeNull();
  });

  it("still rejects non-positive se", () => {
    const data = [
      { effect: 0.1, se: 0.1 },
      { effect: 0.2, se: -1 },
    ];
    expect(validateDataset(data, "RTMA")?.message).toMatch(/se.*positive/);
  });

  it("does not misfire the se-positivity check when effect/se keys are swapped (#488)", () => {
    // Same repro shape as the issue: `se` named first, `effect` second, with
    // a negative effect value. Before the fix, positional fallback read the
    // `effect` values as `se` and tripped this check even though every real
    // `se` value is positive.
    const data = [
      { se: 0.12, effect: -0.4 },
      { se: 0.08, effect: 0.25 },
    ];
    expect(validateDataset(data, "RTMA")).toBeNull();
  });
});
