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
  gitRef: "abc1234",
  isExactCommit: true,
  rVersion: "4.4.2",
  phackingVersion: "0.2.1",
  clubSandwichVersion: "0.7.0",
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
    expect(script).toContain(
      "jsonlite::toJSON(parameters, auto_unbox = TRUE, digits = NA)",
    );
  });

  it("feeds the model full-precision input on the local re-run", () => {
    // jsonlite::toJSON() writes 4 decimal places by default, which rounds small
    // standard errors before phacking ever sees them and refits on different
    // data than the web application used (#489). The backend serializes its own
    // input with digits = NA (api_v1.R).
    const script = generate(rtmaResults);

    expect(script).toContain(
      'jsonlite::toJSON(data, dataframe = "rows", digits = NA)',
    );
    expect(script).not.toContain('jsonlite::toJSON(data, dataframe = "rows")');
  });

  it("verifies the fresh fit against expected_results.json", () => {
    // RTMA packages shipped the expectations file and never read it (#489).
    const script = generate(rtmaResults);

    expect(script).toContain("=== VERIFICATION ===");
    expect(script).toContain(
      'expected <- jsonlite::fromJSON("expected_results.json")',
    );

    // RTMA fields, not MAIVE's effect/SE/Egger ones.
    expect(script).toContain(
      "mu_match <- if (recorded(expected$mu)) matches(results$mu, expected$mu) else NA",
    );
    expect(script).toContain(
      "tau_match <- if (recorded(expected$tau)) matches(results$tau, expected$tau) else NA",
    );
    // The credible intervals are what the sampler seed moves, so both bounds
    // are checked rather than the point estimates alone.
    expect(script).toContain("matches(results$muCI[1], expected$muCI[1])");
    expect(script).toContain("matches(results$muCI[2], expected$muCI[2])");
    expect(script).toContain("matches(results$tauCI[1], expected$tauCI[1])");
    expect(script).toContain("matches(results$tauCI[2], expected$tauCI[2])");
    expect(script).toContain(
      "matches(results$unadjustedMean, expected$unadjustedMean)",
    );

    expect(script).toContain("\\u2713 PASS");
    expect(script).toContain("\\u2717 FAIL");
    expect(script).toContain(
      "\\u2713 All key results match! Reproducibility confirmed.",
    );

    expect(script).not.toContain("expected$effectEstimate");
  });

  it("installs the phacking version the analysis ran under", () => {
    // An unpinned install refits RTMA with whatever CRAN ships that day (#489).
    const script = generate(rtmaResults);

    expect(script).toContain('phacking_version <- "0.2.1"');
    expect(script).toContain('remotes::install_version(\n    "phacking",');
    expect(script).toContain("version = phacking_version,");
    expect(script).toContain("# phacking:        0.2.1");
    expect(script).not.toContain(
      'install.packages("phacking", repos = "https://cloud.r-project.org/")',
    );
  });

  it("falls back to an unpinned install when no phacking version was recorded", () => {
    const script = generateWrapperScript(
      { ...versionInfo, phackingVersion: "unknown" },
      rtmaParameters,
      asModelResults(rtmaResults),
      40,
    );

    expect(script).toContain(
      'install.packages("phacking", repos = "https://cloud.r-project.org/")',
    );
    expect(script).toContain("does not record the phacking version");
    expect(script).not.toContain("remotes::install_version(");
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

  it("lists the packages maive_model.R attaches without pinning them", () => {
    // The RTMA script sources maive_model.R for winsorize_percent, and that
    // file attaches clubSandwich and metafor; neither was listed, so the
    // script failed on a machine without clubSandwich (#576). They do not
    // enter the RTMA fit, so they are installed but not pinned.
    const script = generate(rtmaResults);

    expect(script).toMatch(/required_packages <- c\([\s\S]*"clubSandwich"/);
    expect(script).toMatch(/required_packages <- c\([\s\S]*"metafor"/);
    expect(script).not.toContain("clubsandwich_version");
  });

  it("records sessionInfo() next to the results", () => {
    const script = generate(rtmaResults);

    expect(script).toContain('session_info_path <- "session_info.txt"');
    expect(script).toContain("capture.output(sessionInfo())");
    expect(script).toContain(
      "Web application ran under: R 4.4.2, phacking 0.2.1",
    );
    expect(script.indexOf("run_rtma_model(")).toBeLessThan(
      script.indexOf("capture.output(sessionInfo())"),
    );
    expect(script).toContain("session_info.txt, next to the results");
    expect(script).toContain("session_info.txt       - R and package versions");
  });

  it("refuses a missing required RTMA parameter", () => {
    const withoutFavor: Partial<ModelParameters> = { ...rtmaParameters };
    delete withoutFavor.favorPositive;

    expect(() =>
      generateWrapperScript(
        versionInfo,
        withoutFavor as ModelParameters,
        asModelResults(rtmaResults),
        40,
      ),
    ).toThrow(/RTMA run: parameter "favorPositive" missing/);
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

  it("pins a hyphenated phacking version and compares it as a version", () => {
    // R reports a 0.2-1 release as 0.2.1, so a string comparison would
    // reinstall a correct phacking on every run.
    const script = generateWrapperScript(
      { ...versionInfo, phackingVersion: "0.2-1" },
      rtmaParameters,
      asModelResults(rtmaResults),
      40,
    );

    expect(script).toContain('phacking_version <- "0.2-1"');
    expect(script).toContain('remotes::install_version(\n    "phacking",');
    expect(script).not.toContain("does not record the phacking version");
    expect(script).toContain(
      'utils::packageVersion("phacking") == package_version(phacking_version)',
    );
    expect(script).not.toMatch(
      /identical\(as\.character\(utils::packageVersion/,
    );
  });

  it("refuses version info without the phacking version", () => {
    const without = (key: keyof VersionInfo): VersionInfo => {
      const partial: Partial<VersionInfo> = { ...versionInfo };
      delete partial[key];
      return partial as VersionInfo;
    };

    expect(() =>
      generateWrapperScript(
        without("phackingVersion"),
        rtmaParameters,
        asModelResults(rtmaResults),
        40,
      ),
    ).toThrow(/version info is missing "phackingVersion"/);

    // clubSandwich enters an RTMA script unpinned, so its version is optional.
    const script = generateWrapperScript(
      without("clubSandwichVersion"),
      rtmaParameters,
      asModelResults(rtmaResults),
      40,
    );
    expect(script).not.toContain("undefined");
  });
});
