import { describe, it, expect } from "vitest";
import {
  API_DOCS_CITATIONS,
  getCitationsForModel,
} from "@src/utils/citationUtils";

describe("getCitationsForModel", () => {
  it("returns only the MAIVE paper for MAIVE-family models and by default", () => {
    for (const modelType of ["MAIVE", "WAIVE", "WLS", undefined] as const) {
      const citations = getCitationsForModel(modelType);
      expect(citations).toHaveLength(1);
      expect(citations[0].key).toBe("maive");
      expect(citations[0].role).toBeUndefined();
      expect(citations[0].formats.apa).toContain("10.1038/s41467-025-63261-0");
    }
  });

  it("puts Mathur's method first for RTMA, then software, then the app", () => {
    const citations = getCitationsForModel("RTMA");
    expect(citations.map((c) => c.key)).toEqual(["rtma", "phacking", "maive"]);
    expect(citations.map((c) => c.role)).toEqual([
      "Method",
      "Software",
      "Application",
    ]);
  });

  it("cites the published RTMA article, not the OSF preprint", () => {
    const [method] = getCitationsForModel("RTMA");
    for (const format of ["apa", "bibtex", "ris", "plain"] as const) {
      expect(method.formats[format]).toContain("10.1002/jrsm.1701");
    }
    expect(method.formats.apa).toContain("Research Synthesis Methods");
    expect(method.formats.apa).not.toContain("OSF");
  });

  it("includes the phacking package DOI in the software citation", () => {
    const software = getCitationsForModel("RTMA")[1];
    for (const format of ["apa", "bibtex", "ris", "plain"] as const) {
      expect(software.formats[format]).toContain(
        "10.32614/CRAN.package.phacking",
      );
    }
  });

  it("covers every model family in the API docs citations", () => {
    expect(API_DOCS_CITATIONS.map((c) => c.key)).toEqual([
      "maive",
      "rtma",
      "phacking",
    ]);
    expect(API_DOCS_CITATIONS.every((c) => Boolean(c.role))).toBe(true);
  });
});
