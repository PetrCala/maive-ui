// The constant-se guard, shared by the browser's validation page (advisory
// warning, before the model is chosen) and the server-side dataset validation
// (hard refusal at submit, once the model type is known). Pure TypeScript with
// no server imports, so the page can bundle it (#572).

// Relative spread below which a standard-error column counts as constant.
// Deliberately loose: the second stage was seen to fail on relative spreads up
// to ~6e-06 (#564), and no reported standard-error column is constant to five
// significant digits across every estimate. Keep in sync with the R backend's
// two copies of the same rule: SE_DEGENERATE_RELATIVE_TOLERANCE in
// maive_model.R and RDT_SE_DEGENERATE_RELATIVE_TOLERANCE in rdt_model.R.
export const SE_DEGENERATE_RELATIVE_TOLERANCE = 1e-5;

/**
 * The tolerance expressed as "one part in N", formatted for prose
 * ("100,000"). Derived from the constant so the wording can never drift from
 * the rule it describes.
 */
export const formatSeDegenerateOnePartIn = (): string =>
  Math.round(1 / SE_DEGENERATE_RELATIVE_TOLERANCE).toLocaleString("en-US");

export type DegenerateSeSummary = {
  /** Finite values inspected. */
  count: number;
  /** The first finite value, for the message. */
  first: number;
};

const toFiniteNumber = (value: unknown): number | null => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

/**
 * Detects a standard-error column that carries no usable variation. Every
 * MAIVE-family model regresses the effects on their standard errors, so a
 * constant column is collinear with the intercept: the R package drops the
 * aliased coefficient and then indexes it anyway, which used to reach callers
 * as a "subscript out of bounds" 500 (#564). Mirrors `se_column_is_degenerate`
 * in the R backend.
 *
 * The test is a relative one, so it also catches columns that are not
 * literally constant (0.1 next to 0.1000005). Non-finite entries are skipped.
 * Returns a summary for the message when the column is degenerate, null
 * otherwise.
 *
 * Min/max are taken in a single pass: `Math.min(...values)` would spread up to
 * MAX_ROWS arguments, past the engine's argument limit.
 */
export const summarizeDegenerateSeColumn = (
  values: unknown[],
): DegenerateSeSummary | null => {
  let count = 0;
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  let first = 0;

  values.forEach((raw) => {
    const value = toFiniteNumber(raw);
    if (value === null) {
      return;
    }
    if (count === 0) {
      first = value;
    }
    count += 1;
    min = Math.min(min, value);
    max = Math.max(max, value);
  });

  if (count < 2) {
    return null;
  }

  const scale = Math.max(Math.abs(min), Math.abs(max));
  if (scale === 0 || max - min > SE_DEGENERATE_RELATIVE_TOLERANCE * scale) {
    return null;
  }

  return { count, first };
};

/**
 * The factual half of the message: "its 400 values vary by less than one part
 * in 100,000 (the first is 0.1)". True for a literally constant column and for
 * a relative-tolerance refusal alike, unlike the earlier "are all 0.1" (#572).
 * `label` names the column as the caller's audience knows it.
 */
export const describeDegenerateSeColumn = (
  label: string,
  summary: DegenerateSeSummary,
): string =>
  `The ${label} column has no usable variation: its ${summary.count} values ` +
  `vary by less than one part in ${formatSeDegenerateOnePartIn()} ` +
  `(the first is ${Number(summary.first.toPrecision(6))}).`;
