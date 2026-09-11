import { describe, expect, it } from "vitest";
import { generateReadme } from "@src/lib/reproducibility/generators/readme";
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
    expect(section(readme, "## Package Contents")).toContain("`rtma_model.R`");
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
    expect(section(readme, "## Verifying Results")).toContain(
      "Egger Coefficient Match:",
    );
  });
});
