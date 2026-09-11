import { describe, expect, it } from "vitest";
import { generateWrapperScript } from "@src/lib/reproducibility/generators/wrapperScript";
import type { ModelParameters, ModelResults } from "@src/types/api";
import type { VersionInfo } from "@src/types/reproducibility";

const versionInfo: VersionInfo = {
  uiVersion: "0.0.0",
  maiveTag: "0.2.5",
  gitCommitHash: "abc1234",
  gitRef: "abc1234",
  isExactCommit: true,
  rVersion: "4.4.1",
  phackingVersion: "0.2.1",
  clubSandwichVersion: "0.7.0",
  timestamp: "2026-01-01T00:00:00.000Z",
};

const parameters: ModelParameters = {
  modelType: "MAIVE",
  includeStudyDummies: false,
  includeStudyClustering: false,
  standardErrorTreatment: "not_clustered",
  computeAndersonRubin: false,
  maiveMethod: "PET-PEESE",
  weight: "equal_weights",
  shouldUseInstrumenting: true,
  useLogFirstStage: true,
  winsorize: 0,
  favorPositive: false,
};

const results: ModelResults = {
  // Values as they arrived in the browser from a run stored before the R
  // backend's JSON serializer switched to full precision (jsonlite digits = 4
  // rounded everything to 4 decimal places, #554).
  effectEstimate: 0.0879,
  standardError: 0.0473,
  isSignificant: false,
  andersonRubinCI: "NA",
  publicationBias: {
    eggerCoef: -1.6399,
    eggerSE: 1.9405,
    isSignificant: false,
    eggerBootCI: "NA",
    eggerAndersonRubinCI: "NA",
  },
  firstStageFStatistic: 2.1303,
  hausmanTest: {
    statistic: 0.7742,
    criticalValue: 3.8415,
    rejectsNull: false,
  },
  seInstrumented: [0.0224, 0.0221],
  funnelPlot: "",
  funnelPlotWidth: 400,
  funnelPlotHeight: 300,
  bootCI: "NA",
  bootSE: "NA",
};

describe("generateWrapperScript", () => {
  it("compares the local re-run at full precision or at the old 4-decimal precision", () => {
    // The backend serializes responses at full double precision since #554,
    // so a reproducible run matches expected_results.json directly. Runs
    // stored before that carry values the server rounded to 4 decimal places;
    // comparing those directly at a 1e-8 tolerance would fail on nearly every
    // run, so the script also accepts a match after rounding the local re-run
    // to the same precision.
    const script = generateWrapperScript(versionInfo, parameters, results, 60);

    expect(script).toContain(
      "abs(actual - expected) < tolerance || abs(round(actual, 4) - expected) < tolerance",
    );
    expect(script).toContain(
      "matches(results$effectEstimate, expected$effectEstimate)",
    );
    expect(script).toContain(
      "matches(results$standardError, expected$standardError)",
    );
    expect(script).toContain(
      "matches(results$publicationBias$eggerCoef, expected$publicationBias$eggerCoef)",
    );

    // Guard against a regression to a comparison that only ever passes for
    // one of the two precisions.
    expect(script).not.toContain(
      "abs(results$effectEstimate - expected$effectEstimate) < tolerance",
    );
    expect(script).not.toContain(
      "abs(round(results$effectEstimate, 4) - expected$effectEstimate) < tolerance",
    );
  });

  it("feeds the model full-precision input on the local re-run", () => {
    // The rounding above is a property of the API *response*. The input must
    // not be rounded on the way back in: jsonlite::toJSON() writes 4 decimal
    // places by default, which alters small standard errors before the refit
    // and defeats the point of an app that detects spurious precision (#489).
    // The backend serializes its own input with digits = NA (api_v1.R).
    const script = generateWrapperScript(versionInfo, parameters, results, 60);

    expect(script).toContain(
      'jsonlite::toJSON(data, dataframe = "rows", digits = NA)',
    );
    expect(script).toContain(
      "jsonlite::toJSON(parameters, auto_unbox = TRUE, digits = NA)",
    );
    expect(script).not.toContain('jsonlite::toJSON(data, dataframe = "rows")');
  });

  it("installs the clubSandwich version the analysis ran under, before MAIVE", () => {
    // clubSandwich supplies the cluster-robust covariance behind every MAIVE
    // standard error; it used to arrive unpinned as a MAIVE dependency (#576).
    const script = generateWrapperScript(versionInfo, parameters, results, 60);

    expect(script).toContain('clubsandwich_version <- "0.7.0"');
    expect(script).toContain('remotes::install_version(\n    "clubSandwich",');
    expect(script).toContain("version = clubsandwich_version,");
    expect(script).toContain("# clubSandwich:    0.7.0");
    expect(script).toMatch(/"clubSandwich",\s+# Cluster-robust covariance/);

    // Pinned before the MAIVE install, so install_github(upgrade = "never")
    // finds it and leaves it alone.
    expect(script.indexOf('clubsandwich_version <- "0.7.0"')).toBeLessThan(
      script.indexOf("remotes::install_github("),
    );
    // And before the generic installer, so that one never pulls the latest.
    expect(script.indexOf('clubsandwich_version <- "0.7.0"')).toBeLessThan(
      script.indexOf("required_packages <- c("),
    );
  });

  it("falls back to an unpinned clubSandwich install when no version was recorded", () => {
    const script = generateWrapperScript(
      { ...versionInfo, clubSandwichVersion: "unknown" },
      parameters,
      results,
      60,
    );

    expect(script).toContain(
      'install.packages("clubSandwich", repos = "https://cloud.r-project.org/")',
    );
    expect(script).toContain("does not record the clubSandwich version");
    expect(script).not.toContain("remotes::install_version(");
  });

  it("records sessionInfo() next to the results and points the mismatch hint at it", () => {
    // The hint used to say "Different R version" without recording which R,
    // MAIVE or clubSandwich the re-run used (#576).
    const script = generateWrapperScript(versionInfo, parameters, results, 60);

    expect(script).toContain('session_info_path <- "session_info.txt"');
    expect(script).toContain("capture.output(sessionInfo())");
    expect(script).toContain(
      "Web application ran under: R 4.4.1, MAIVE 0.2.5, clubSandwich 0.7.0",
    );
    // Written after the fit (so every package it touched is loaded) and before
    // the verification, so it exists even when that step fails.
    expect(script.indexOf("run_maive_model(")).toBeLessThan(
      script.indexOf("capture.output(sessionInfo())"),
    );
    expect(script.indexOf("capture.output(sessionInfo())")).toBeLessThan(
      script.indexOf("=== VERIFICATION ==="),
    );

    expect(script).toContain(
      "A different clubSandwich version (this run: 0.7.0)",
    );
    expect(script).toContain("A different R version (this run: 4.4.1)");
    expect(script).toContain("recorded in\\n");
    expect(script).toContain("session_info.txt, next to the results");
    expect(script).toContain("session_info.txt     - R and package versions");
  });

  it("refuses a model type it cannot write a runnable script for", () => {
    // RDT has no export path (#559); the generator used to emit a MAIVE script
    // with modelType = "RDT" that called run_maive_model() (#576).
    expect(() =>
      generateWrapperScript(
        versionInfo,
        { ...parameters, modelType: "RDT" },
        results,
        60,
      ),
    ).toThrow(
      /model type "RDT".*Supported model types: MAIVE, WAIVE, WLS, RTMA/,
    );
  });

  it("refuses a missing required parameter instead of writing undefined into R", () => {
    const without = (keys: Array<keyof ModelParameters>): ModelParameters => {
      const partial: Partial<ModelParameters> = { ...parameters };
      keys.forEach((key) => delete partial[key]);
      return partial as ModelParameters;
    };

    expect(() =>
      generateWrapperScript(versionInfo, without(["weight"]), results, 60),
    ).toThrow(/parameter "weight" missing/);

    expect(() =>
      generateWrapperScript(
        versionInfo,
        without(["weight", "maiveMethod"]),
        results,
        60,
      ),
    ).toThrow(/parameters "maiveMethod", "weight" missing/);
  });

  it("never interpolates undefined into a script it does emit", () => {
    const script = generateWrapperScript(versionInfo, parameters, results, 60);

    // `weight = "undefined"` is what a missing parameter used to become.
    expect(script).not.toMatch(/= "?undefined"?/);
  });

  it("pins a hyphenated clubSandwich version and compares it as a version", () => {
    // R reports a 0.7-1 release as 0.7.1, so the pin has to be compared with
    // package_version() rather than as a string, and the version pattern has
    // to accept the hyphen instead of falling back to an unpinned install.
    const script = generateWrapperScript(
      { ...versionInfo, clubSandwichVersion: "0.7-1" },
      parameters,
      results,
      60,
    );

    expect(script).toContain('clubsandwich_version <- "0.7-1"');
    expect(script).toContain('remotes::install_version(\n    "clubSandwich",');
    expect(script).not.toContain("does not record the clubSandwich version");
    expect(script).toContain(
      'utils::packageVersion("clubSandwich") == package_version(clubsandwich_version)',
    );
    expect(script).not.toMatch(
      /identical\(as\.character\(utils::packageVersion/,
    );
  });

  it("refuses version info that lacks a version the script names", () => {
    // A version info without clubSandwichVersion used to write the literal
    // string "undefined" into the header and the session info hint.
    const without = (key: keyof VersionInfo): VersionInfo => {
      const partial: Partial<VersionInfo> = { ...versionInfo };
      delete partial[key];
      return partial as VersionInfo;
    };

    expect(() =>
      generateWrapperScript(
        without("clubSandwichVersion"),
        parameters,
        results,
        60,
      ),
    ).toThrow(/version info is missing "clubSandwichVersion"/);
    expect(() =>
      generateWrapperScript(without("maiveTag"), parameters, results, 60),
    ).toThrow(/version info is missing "maiveTag"/);

    // A MAIVE script never names phacking, so it does not need that version,
    // and leaving it out writes nothing new into the script. (One R comment
    // uses the word "undefined" on its own, so count against a complete run.)
    const complete = generateWrapperScript(
      versionInfo,
      parameters,
      results,
      60,
    );
    const script = generateWrapperScript(
      without("phackingVersion"),
      parameters,
      results,
      60,
    );
    expect(script.split("undefined").length).toBe(
      complete.split("undefined").length,
    );
  });
});
