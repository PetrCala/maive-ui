import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { addRSourceFiles } from "@src/lib/reproducibility";
import { packagedRSourceFiles } from "@src/lib/reproducibility/generators/readme";
import type { RCodeBundle } from "@src/types/reproducibility";

const bundle: RCodeBundle = {
  maiveModel: "# maive_model.R",
  funnelPlot: "# funnel_plot.R",
  rtmaModel: "# rtma_model.R",
};

const shipped = (modelType: string): string[] => {
  const zip = new JSZip();
  addRSourceFiles(zip, bundle, modelType);
  return Object.keys(zip.files).sort();
};

describe("addRSourceFiles", () => {
  it("ships only the R files a MAIVE-family script sources", () => {
    // host.R and rtma_model.R used to ride along in every package without
    // being listed in the README or sourced by anything (#576).
    ["MAIVE", "WAIVE", "WLS"].forEach((modelType) =>
      expect(shipped(modelType)).toEqual(["funnel_plot.R", "maive_model.R"]),
    );
  });

  it("ships rtma_model.R and what it sources in an RTMA package", () => {
    expect(shipped("RTMA")).toEqual([
      "funnel_plot.R",
      "maive_model.R",
      "rtma_model.R",
    ]);
  });

  it("ships exactly the files the README and manifest describe", () => {
    ["MAIVE", "WAIVE", "WLS", "RTMA"].forEach((modelType) =>
      expect(shipped(modelType)).toEqual(
        packagedRSourceFiles(modelType)
          .map(({ file }) => file)
          .sort(),
      ),
    );
  });

  it("refuses an RTMA package whose rtma_model.R could not be fetched", () => {
    // The fetch treats rtma_model.R as optional because a MAIVE package does
    // not need it; an RTMA package without it could not run.
    const withoutRtma: RCodeBundle = {
      maiveModel: bundle.maiveModel,
      funnelPlot: bundle.funnelPlot,
    };
    expect(() => addRSourceFiles(new JSZip(), withoutRtma, "RTMA")).toThrow(
      /rtma_model\.R/,
    );
    expect(() =>
      addRSourceFiles(new JSZip(), withoutRtma, "MAIVE"),
    ).not.toThrow();
  });
});
