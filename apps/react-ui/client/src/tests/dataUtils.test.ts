import { describe, it, expect } from "vitest";
import { buildRtmaResultsCsvRows, hasNObsColumn } from "@src/utils/dataUtils";
import type { RTMAResults } from "@src/types/api";

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

describe("buildRtmaResultsCsvRows", () => {
  const rtmaResults: RTMAResults = {
    mu: 0.12,
    muCI: [0.07, 0.31],
    tau: 0.03,
    tauCI: [0.01, 0.16],
    zScorePlot: "data:image/png;base64,xxx",
    zScorePlotWidth: 600,
    zScorePlotHeight: 400,
    nonaffirmativeCount: 26,
    nonaffirmativeProportion: 0.65,
    warnings: [],
    diagnostics: {
      optimConverged: false,
      rHat: { mu: 1.043, tau: 1.002 },
      nEff: { mu: 312, tau: 1548 },
      divergences: 12,
    },
  };

  const valueOf = (rows: Array<[string, string]>, metric: string) =>
    rows.find(([label]) => label === metric)?.[1];

  it("exports the diagnostics alongside the estimates they qualify", () => {
    const rows = buildRtmaResultsCsvRows(rtmaResults);

    expect(valueOf(rows, "Mode Optimisation Converged")).toBe("false");
    expect(valueOf(rows, "R-hat (mu)")).toBe("1.043");
    expect(valueOf(rows, "R-hat (tau)")).toBe("1.002");
    expect(valueOf(rows, "Effective Draws (mu)")).toBe("312");
    expect(valueOf(rows, "Effective Draws (tau)")).toBe("1548");
    expect(valueOf(rows, "Divergent Transitions")).toBe("12");
  });

  it("exports zero divergences rather than dropping the row", () => {
    const rows = buildRtmaResultsCsvRows({
      ...rtmaResults,
      diagnostics: {
        optimConverged: true,
        rHat: { mu: 1.001, tau: 1.002 },
        nEff: { mu: 1420, tau: 1548 },
        divergences: 0,
      },
    });

    expect(valueOf(rows, "Divergent Transitions")).toBe("0");
    expect(valueOf(rows, "Mode Optimisation Converged")).toBe("true");
  });

  it("omits diagnostics rows for a run stored before they existed", () => {
    const legacy = { ...rtmaResults };
    delete legacy.diagnostics;

    const rows = buildRtmaResultsCsvRows(legacy);

    expect(valueOf(rows, "Mode Optimisation Converged")).toBeUndefined();
    expect(valueOf(rows, "Divergent Transitions")).toBeUndefined();
    expect(valueOf(rows, "Corrected Effect (mu)")).toBe("0.12");
  });

  it("never reports phacking's se_mean as a standard error", () => {
    const rows = buildRtmaResultsCsvRows(rtmaResults);

    expect(
      rows.filter(([label]) => /standard error/i.test(label)),
    ).toHaveLength(0);
  });
});
