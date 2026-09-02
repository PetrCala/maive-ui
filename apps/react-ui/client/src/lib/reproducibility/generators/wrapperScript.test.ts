import { describe, expect, it } from "vitest";
import { generateWrapperScript } from "@src/lib/reproducibility/generators/wrapperScript";
import type { ModelParameters, ModelResults } from "@src/types/api";
import type { VersionInfo } from "@src/types/reproducibility";

const versionInfo: VersionInfo = {
  uiVersion: "0.0.0",
  maiveTag: "0.2.5",
  gitCommitHash: "abc1234",
  rVersion: "4.4.1",
  phackingVersion: "0.2.1",
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
  useLogFirstStage: false,
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
});
