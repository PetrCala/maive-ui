import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import CONST from "@src/CONST";

/**
 * A reproducibility package names the version of the package that produced
 * its numbers and reinstalls exactly that one: phacking for RTMA (#489),
 * clubSandwich for MAIVE, where it supplies the cluster-robust covariance
 * behind every standard error (#576). That promise only holds if the version
 * the UI reports is the version the backend image actually installs, so read
 * the pins out of r-packages.txt instead of trusting the constants on their
 * own.
 *
 * The same list pins the packages the results themselves depend on (#574):
 * clubSandwich also supplies the CR2 variance and the Satterthwaite degrees of
 * freedom behind every RDT interval and p-value, and metafor sits underneath
 * it, so neither may float to whatever CRAN ships on the day the image is
 * rebuilt.
 *
 * process.cwd() is apps/react-ui/client when the suite runs.
 */
const R_PACKAGES_PATH = join(
  process.cwd(),
  "../../..",
  "apps/lambda-r-backend/r_scripts/r-packages.txt",
);

function readPackageEntries(): string[] {
  return readFileSync(R_PACKAGES_PATH, "utf-8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

const PINS = [
  {
    pkg: "phacking",
    reported: CONST.REPRODUCIBILITY.DEFAULTS.PHACKING_VERSION,
  },
  {
    pkg: "clubSandwich",
    reported: CONST.REPRODUCIBILITY.DEFAULTS.CLUBSANDWICH_VERSION,
  },
];

describe.each(PINS)("$pkg version pin", ({ pkg, reported }) => {
  it("pins the package to an exact version in the backend package list", () => {
    const entry = readPackageEntries().find((line) => line.startsWith(pkg));

    expect(entry).toBeDefined();
    // pak reads this file verbatim; a bare package name installs whatever CRAN
    // ships on the day the image is rebuilt.
    expect(entry).toMatch(new RegExp(`^${pkg}@\\d+(\\.\\d+)*$`));
  });

  it("reports the pinned version to the reproducibility package", () => {
    const entry = readPackageEntries().find((line) =>
      line.startsWith(`${pkg}@`),
    );
    const pinnedVersion = entry?.split("@")[1];

    expect(reported).toBe(pinnedVersion);
  });
});

describe("result-bearing package pins (#574)", () => {
  // pak reads this file verbatim, so a bare name takes whatever CRAN ships on
  // the day the image is rebuilt. A version ref (pkg@version) freezes it.
  it.each(["clubSandwich", "metafor"])("pins %s to an exact version", (pkg) => {
    const entry = readPackageEntries().find((line) =>
      line.startsWith(`${pkg}@`),
    );

    expect(entry).toBeDefined();
    expect(entry).toMatch(new RegExp(`^${pkg}@\\d+(\\.\\d+)*(-\\d+)?$`));
  });

  it("lists clubSandwich, which used to arrive only as a MAIVE dependency", () => {
    const names = readPackageEntries().map((line) => line.split("@")[0]);

    expect(names).toContain("clubSandwich");
  });
});
