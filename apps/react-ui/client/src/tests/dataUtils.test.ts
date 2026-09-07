import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import {
  buildRtmaResultsCsvRows,
  hasNObsColumn,
  parseLocalizedNumber,
  processUploadedFile,
} from "@src/utils/dataUtils";
import type { RTMAResults } from "@src/types/api";

describe("parseLocalizedNumber", () => {
  it("keeps decimal commas and dots for measurements", () => {
    expect(parseLocalizedNumber("0,5")).toBe(0.5);
    expect(parseLocalizedNumber("0.5")).toBe(0.5);
    expect(parseLocalizedNumber("-1,25")).toBe(-1.25);
    expect(parseLocalizedNumber("1.234,5")).toBe(1234.5);
    expect(parseLocalizedNumber("1,234.5")).toBe(1234.5);
  });

  it("returns null for empty or non-numeric input", () => {
    expect(parseLocalizedNumber("")).toBeNull();
    expect(parseLocalizedNumber("   ")).toBeNull();
    expect(parseLocalizedNumber(null)).toBeNull();
    expect(parseLocalizedNumber(undefined)).toBeNull();
    expect(parseLocalizedNumber("abc")).toBeNull();
    expect(parseLocalizedNumber("abc", { integer: true })).toBeNull();
  });

  describe("with the integer option", () => {
    it("reads a single separator followed by three digits as thousands", () => {
      expect(parseLocalizedNumber("1,274", { integer: true })).toBe(1274);
      expect(parseLocalizedNumber("1.274", { integer: true })).toBe(1274);
      expect(parseLocalizedNumber("12,345", { integer: true })).toBe(12345);
      expect(parseLocalizedNumber("12.345", { integer: true })).toBe(12345);
      expect(parseLocalizedNumber("999,999", { integer: true })).toBe(999999);
    });

    it("reads grouped thousands with either separator", () => {
      expect(parseLocalizedNumber("1,234,567", { integer: true })).toBe(
        1234567,
      );
      expect(parseLocalizedNumber("1.234.567", { integer: true })).toBe(
        1234567,
      );
    });

    it("accepts space and non-breaking space separators", () => {
      expect(parseLocalizedNumber("1 274", { integer: true })).toBe(1274);
      expect(parseLocalizedNumber("1\u00a0274", { integer: true })).toBe(1274);
    });

    it("still parses values that cannot be thousands groups", () => {
      expect(parseLocalizedNumber("1274.0", { integer: true })).toBe(1274);
      expect(parseLocalizedNumber("1274", { integer: true })).toBe(1274);
      expect(parseLocalizedNumber(1274, { integer: true })).toBe(1274);
      expect(parseLocalizedNumber("12,5", { integer: true })).toBe(12.5);
      expect(parseLocalizedNumber("1,2345", { integer: true })).toBe(1.2345);
      expect(parseLocalizedNumber("0.5", { integer: true })).toBe(0.5);
    });

    it("does not change how effect values are parsed without the option", () => {
      expect(parseLocalizedNumber("0,5")).toBe(0.5);
      expect(parseLocalizedNumber("1,274")).toBe(1.274);
    });
  });
});

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

describe("processUploadedFile", () => {
  const buildWorkbookFile = (
    filename: string,
    bookType: XLSX.BookType,
    mimeType: string,
  ): File => {
    const worksheet = XLSX.utils.aoa_to_sheet([
      ["effect", "se", "n_obs"],
      [0.5, 0.1, 100],
      [0.3, 0.2, 200],
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Data");
    const buffer = XLSX.write(workbook, {
      bookType,
      type: "array",
    }) as ArrayBuffer;

    return new File([buffer], filename, { type: mimeType });
  };

  it("parses a macro-enabled workbook the same way as a plain one", async () => {
    const parsed = await processUploadedFile(
      buildWorkbookFile(
        "study.xlsm",
        "xlsm",
        "application/vnd.ms-excel.sheet.macroEnabled.12",
      ),
    );

    expect(parsed.hasHeaders).toBe(true);
    expect(parsed.columnNames).toEqual(["effect", "se", "n_obs"]);
    expect(parsed.data).toEqual([
      { effect: 0.5, se: 0.1, n_obs: 100 },
      { effect: 0.3, se: 0.2, n_obs: 200 },
    ]);
  });

  it("parses a macro-enabled workbook whose type the browser did not report", async () => {
    const parsed = await processUploadedFile(
      buildWorkbookFile("study.xlsm", "xlsm", ""),
    );

    expect(parsed.columnNames).toEqual(["effect", "se", "n_obs"]);
    expect(parsed.data).toHaveLength(2);
  });
});
