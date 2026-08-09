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
  // Values as they arrive in the browser: already rounded to 4 decimal
  // places by the R backend's JSON serializer (jsonlite digits = 4).
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
  it("rounds the local re-run before comparing against expected_results.json", () => {
    // MAIVE >= 0.2.5 returns effectEstimate/standardError/eggerCoef at full
    // double precision from a local re-run, while expected_results.json is
    // the API response the browser received, which the server always rounds
    // to 4 decimal places. Comparing the two directly at a 1e-8 tolerance
    // would fail on nearly every reproducible run; the script must round the
    // local re-run to the same precision before comparing.
    const script = generateWrapperScript(versionInfo, parameters, results, 60);

    expect(script).toContain(
      "abs(round(results$effectEstimate, 4) - expected$effectEstimate) < tolerance",
    );
    expect(script).toContain(
      "abs(round(results$standardError, 4) - expected$standardError) < tolerance",
    );
    expect(script).toContain(
      "abs(round(results$publicationBias$eggerCoef, 4) - expected$publicationBias$eggerCoef) < tolerance",
    );

    // Guard against a regression back to the old unrounded comparison.
    expect(script).not.toContain(
      "abs(results$effectEstimate - expected$effectEstimate) < tolerance",
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
