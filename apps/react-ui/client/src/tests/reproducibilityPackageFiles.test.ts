import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { addRSourceFiles } from "@src/lib/reproducibility";
import { packagedRSourceFiles } from "@src/lib/reproducibility/generators/readme";
import { rtmaPackageParameters } from "@src/lib/reproducibility/generators/rtmaSettings";
import type { ModelParameters } from "@src/types/api";
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

describe("rtmaPackageParameters", () => {
  // What the results page hands the export for an RTMA run: the MAIVE-shaped
  // page object (toPageParameters), MAIVE keys filled with page defaults.
  const pageParameters: ModelParameters = {
    modelType: "RTMA",
    includeStudyDummies: false,
    includeStudyClustering: false,
    standardErrorTreatment: "clustered_cr2",
    computeAndersonRubin: false,
    maiveMethod: "PET-PEESE",
    weight: "equal_weights",
    shouldUseInstrumenting: false,
    useLogFirstStage: true,
    winsorize: 5,
    favorPositive: false,
  };

  it("exports only the RTMA settings the script runs with", () => {
    expect(rtmaPackageParameters(pageParameters, 4242)).toEqual({
      modelType: "RTMA",
      favorPositive: false,
      alphaSelect: 0.05,
      ciLevel: 0.95,
      winsorize: 5,
      seed: 4242,
    });
  });

  it("records the seed the script falls back to when the run recorded none", () => {
    expect(rtmaPackageParameters(pageParameters, null).seed).toBe(2025);
  });
});
