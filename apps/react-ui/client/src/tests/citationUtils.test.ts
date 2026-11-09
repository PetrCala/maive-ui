import { describe, it, expect } from "vitest";
import {
  API_DOCS_CITATIONS,
  getCitationsForModel,
} from "@src/utils/citationUtils";

describe("getCitationsForModel", () => {
  it("returns only the MAIVE paper for MAIVE, WAIVE and by default", () => {
    for (const modelType of ["MAIVE", "WAIVE", undefined] as const) {
      const citations = getCitationsForModel(modelType);
      expect(citations).toHaveLength(1);
      expect(citations[0].key).toBe("maive");
      expect(citations[0].role).toBeUndefined();
      expect(citations[0].formats.apa).toContain("10.1038/s41467-025-63261-0");
    }
    // The method only matters for WLS.
    expect(getCitationsForModel("MAIVE", "EK").map((c) => c.key)).toEqual([
      "maive",
    ]);
  });

  it("cites Stanley & Doucouliagos as the method for a conventional PET-PEESE run", () => {
    // A WLS run is conventional PET-PEESE (or PET, PEESE), which is not the
    // MAIVE paper's method; the app is credited as the application (#597).
    // With no method given, WLS defaults to PET-PEESE.
    for (const method of ["PET-PEESE", "PET", "PEESE", undefined] as const) {
      const citations = getCitationsForModel("WLS", method);
      expect(citations.map((c) => c.key)).toEqual(["petpeese", "maive"]);
      expect(citations.map((c) => c.role)).toEqual(["Method", "Application"]);
      expect(citations[0].shortText).toBe(
        "Stanley & Doucouliagos, Research Synthesis Methods, 2014.",
      );
      for (const format of ["apa", "bibtex", "ris", "plain"] as const) {
        expect(citations[0].formats[format]).toContain("10.1002/jrsm.1095");
      }
    }
  });

  it("cites Bom & Rachinger as the method for a conventional EK run", () => {
    const citations = getCitationsForModel("WLS", "EK");
    expect(citations.map((c) => c.key)).toEqual(["ek", "maive"]);
    expect(citations.map((c) => c.role)).toEqual(["Method", "Application"]);
    expect(citations[0].shortText).toBe(
      "Bom & Rachinger, Research Synthesis Methods, 2019.",
    );
    for (const format of ["apa", "bibtex", "ris", "plain"] as const) {
      expect(citations[0].formats[format]).toContain("10.1002/jrsm.1352");
    }
    expect(citations[0].url).toBe("https://doi.org/10.1002/jrsm.1352");
  });

  it("uses hyphens, not dashes, in the page ranges of every format", () => {
    for (const method of ["PET-PEESE", "EK"] as const) {
      for (const citation of getCitationsForModel("WLS", method)) {
        for (const text of Object.values(citation.formats)) {
          expect(text).not.toMatch(/[\u2013\u2014]/);
        }
      }
    }
  });

  it("leaves RTMA and RDT alone whatever the method", () => {
    expect(getCitationsForModel("RTMA", "EK").map((c) => c.key)).toEqual([
      "rtma",
      "phacking",
      "maive",
    ]);
    expect(getCitationsForModel("RDT", "EK")).toEqual([]);
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
      "petpeese",
      "ek",
      "rtma",
      "phacking",
    ]);
    expect(API_DOCS_CITATIONS.every((c) => Boolean(c.role))).toBe(true);
    expect(API_DOCS_CITATIONS[0].role).toBe(
      "MAIVE and WAIVE models; application for WLS and RTMA",
    );
  });
});
