import { describe, expect, it } from "vitest";
import CONST from "@src/CONST";
import {
  generateReadme,
  generateVersionManifest,
} from "@src/lib/reproducibility/generators/readme";
import type { ModelParameters } from "@src/types/api";
import type { VersionInfo } from "@src/types/reproducibility";

const versionInfo: VersionInfo = {
  uiVersion: "0.9.4-0",
  maiveTag: "0.4.0",
  gitCommitHash: "abc1234",
  gitRef: "abc1234",
  isExactCommit: true,
  rVersion: "4.4.2",
  phackingVersion: "0.2.1",
  clubSandwichVersion: "0.7.0",
  timestamp: "2026-09-11T10:00:00.000Z",
};

const maiveParameters: ModelParameters = {
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

const rtmaParameters: ModelParameters = {
  ...maiveParameters,
  modelType: "RTMA",
  shouldUseInstrumenting: false,
  useLogFirstStage: false,
  favorPositive: true,
};

/** The text under one "## " heading, up to the next one */
const section = (readme: string, heading: string): string => {
  const start = readme.indexOf(`\n${heading}\n`);
  expect(start).toBeGreaterThanOrEqual(0);
  const rest = readme.slice(start + heading.length + 2);
  const end = rest.search(/\n## /);
  return end === -1 ? rest : rest.slice(0, end);
};

describe("generateReadme", () => {
  it("lists the files an RTMA script writes", () => {
    // The RTMA README promised the MAIVE outputs (funnel_plot.png and
    // maive_results.*), none of which an RTMA run writes.
    const readme = generateReadme(versionInfo, rtmaParameters, 40, 4242);

    const outputs = section(readme, "## Output Files");
    [
      "z_score_plot.png",
      "rtma_results.rds",
      "rtma_results.json",
      "session_info.txt",
    ].forEach((file) => expect(outputs).toContain(`\`${file}\``));
    expect(readme).not.toContain("funnel_plot.png");
    expect(readme).not.toContain("maive_results");

    expect(readme).toContain('readRDS("rtma_results.rds")');
    expect(section(readme, "## What the Script Does")).toContain(
      "Run the RTMA analysis",
    );
    // The script sources rtma_model.R and maive_model.R, which sources
    // funnel_plot.R; host.R (the Plumber entrypoint) is not shipped.
    const contents = section(readme, "## Package Contents");
    ["rtma_model.R", "maive_model.R", "funnel_plot.R"].forEach((file) =>
      expect(contents).toContain(`\`${file}\``),
    );
    expect(readme).not.toContain("host.R");
    expect(section(readme, "## License")).toContain(
      "(`rtma_model.R`, `maive_model.R`, `funnel_plot.R`)",
    );
  });

  it("names the R source files each package ships in its manifest", () => {
    const rtma = generateVersionManifest(versionInfo, rtmaParameters);
    const maive = generateVersionManifest(versionInfo, maiveParameters);
    const url = (file: string) =>
      `/blob/abc1234/${CONST.GITHUB.R_SCRIPTS_PATH}/${file}`;

    ["rtma_model.R", "maive_model.R", "funnel_plot.R"].forEach((file) =>
      expect(rtma).toContain(`${`${file}:`.padEnd(25)}`),
    );
    expect(rtma).toContain(url("rtma_model.R"));
    expect(maive).toContain(url("maive_model.R"));
    expect(maive).toContain(url("funnel_plot.R"));
    expect(maive).not.toContain("rtma_model.R");
    expect(rtma).not.toContain("host.R");
    expect(maive).not.toContain("host.R");
  });

  it("lists the settings each script runs with under ANALYSIS CONFIGURATION", () => {
    // An RTMA run reaches the export in the page's MAIVE-shaped parameters,
    // and its manifest used to list MAIVE Method, Weight Scheme, Log First
    // Stage and the rest, none of which an RTMA run has.
    const configuration = (manifest: string): string =>
      manifest.slice(
        manifest.indexOf("ANALYSIS CONFIGURATION"),
        manifest.indexOf("PACKAGE DEPENDENCIES"),
      );

    const rtma = configuration(
      generateVersionManifest(versionInfo, rtmaParameters, 4242),
    );
    expect(rtma).toContain("Model Type:              RTMA");
    expect(rtma).toContain("Favor Positive:          true");
    expect(rtma).toContain("Alpha Select:            0.05");
    expect(rtma).toContain("CI Level:                0.95");
    expect(rtma).toContain("Winsorize:               0%");
    expect(rtma).toContain("Sampler Seed:            4242");
    [
      "MAIVE Method",
      "Weight Scheme",
      "Use Instrumenting",
      "Study Dummies",
      "Study Clustering",
      "SE Treatment",
      "Anderson-Rubin",
      "Log First Stage",
    ].forEach((label) => expect(rtma).not.toContain(label));

    expect(
      configuration(generateVersionManifest(versionInfo, rtmaParameters, null)),
    ).toContain(
      "Sampler Seed:            2025 (default; the original run recorded no seed",
    );

    // The MAIVE lines are unchanged.
    const maive = configuration(
      generateVersionManifest(versionInfo, maiveParameters),
    );
    [
      "Model Type:              MAIVE",
      "MAIVE Method:            PET-PEESE",
      "Weight Scheme:           equal_weights",
      "Use Instrumenting:       true",
      "Study Dummies:           false",
      "Study Clustering:        false",
      "SE Treatment:            not_clustered",
      "Anderson-Rubin:          false",
      "Log First Stage:         true",
      "Winsorize:               0%",
    ].forEach((line) => expect(maive).toContain(line));
    expect(maive).not.toContain("Sampler Seed");
  });

  it("shows the verification lines an RTMA script prints", () => {
    const verifying = section(
      generateReadme(versionInfo, rtmaParameters, 40, 4242),
      "## Verifying Results",
    );

    expect(verifying).toContain("mu (mode) Match:");
    expect(verifying).toContain("tau CI upper Match:");
    expect(verifying).not.toContain("Egger Coefficient Match");
  });

  it("keeps the MAIVE outputs for a MAIVE package", () => {
    const readme = generateReadme(versionInfo, maiveParameters, 60);

    const outputs = section(readme, "## Output Files");
    [
      "funnel_plot.png",
      "maive_results.rds",
      "maive_results.json",
      "session_info.txt",
    ].forEach((file) => expect(outputs).toContain(`\`${file}\``));
    expect(readme).not.toContain("z_score_plot.png");
    expect(readme).not.toContain("rtma_model.R");
    expect(readme).not.toContain("host.R");
    const contents = section(readme, "## Package Contents");
    ["maive_model.R", "funnel_plot.R"].forEach((file) =>
      expect(contents).toContain(`\`${file}\``),
    );
    expect(section(readme, "## Verifying Results")).toContain(
      "Egger Coefficient Match:",
    );
  });
});
