import { describe, it, expect } from "vitest";
import { generateWrapperScript } from "@src/lib/reproducibility/generators/wrapperScript";
import type {
  ModelParameters,
  ModelResults,
  RTMAResults,
} from "@src/types/api";
import type { VersionInfo } from "@src/types/reproducibility";

const versionInfo: VersionInfo = {
  uiVersion: "0.6.16-0",
  maiveTag: "0.0.3.4",
  gitCommitHash: "abc1234",
  rVersion: "4.4.2",
  timestamp: "2026-08-09T10:00:00.000Z",
};

const rtmaParameters: ModelParameters = {
  modelType: "RTMA",
  includeStudyDummies: false,
  includeStudyClustering: false,
  standardErrorTreatment: "clustered_cr2",
  computeAndersonRubin: false,
  maiveMethod: "PET-PEESE",
  weight: "equal_weights",
  shouldUseInstrumenting: false,
  useLogFirstStage: false,
  winsorize: 0,
  favorPositive: true,
};

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
  seed: 4242,
};

/** A run stored before the backend started pinning and reporting a seed */
const withoutSeed = (results: RTMAResults): RTMAResults => {
  const legacy = { ...results };
  delete legacy.seed;
  return legacy;
};

// RTMA results travel through the export path in the ModelResults slot.
const asModelResults = (results: RTMAResults): ModelResults =>
  results as unknown as ModelResults;

const generate = (results: RTMAResults) =>
  generateWrapperScript(
    versionInfo,
    rtmaParameters,
    asModelResults(results),
    40,
  );

describe("generateWrapperScript (RTMA)", () => {
  it("passes the seed the run used into run_rtma_model", () => {
    const script = generate(rtmaResults);

    // The seed has to reach phacking_meta(), which run_rtma_model() reads out
    // of the parameters list; a bare set.seed() elsewhere in the file would
    // not survive a backend that re-seeds itself.
    expect(script).toContain("seed = 4242");
    expect(script).toMatch(/parameters <- list\([\s\S]*seed = 4242[\s\S]*\)/);
    expect(script).toContain("set.seed(parameters$seed)");
    // Still the JSON-string contract the Plumber-facing function expects.
    expect(script).toContain("jsonlite::toJSON(parameters, auto_unbox = TRUE)");
  });

  it("verifies at runtime that the fit honored the requested seed", () => {
    const script = generate(rtmaResults);

    expect(script).toContain("Seed requested:");
    expect(script).toContain("results$seed");
  });

  it("flags a run recorded before RTMA sampling was seeded", () => {
    const script = generate(withoutSeed(rtmaResults));

    expect(script).toContain("seed = 2025");
    expect(script).toContain("recorded no seed");
  });

  it("leaves the MAIVE script alone", () => {
    const maiveScript = generateWrapperScript(
      versionInfo,
      { ...rtmaParameters, modelType: "MAIVE", shouldUseInstrumenting: true },
      asModelResults(rtmaResults),
      40,
    );

    expect(maiveScript).toContain("run_maive_model(");
    expect(maiveScript).not.toContain("set.seed(parameters$seed)");
  });
});
