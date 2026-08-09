import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import CONST from "@src/CONST";

/**
 * An RTMA reproducibility package names the phacking version it ran under and
 * reinstalls exactly that one (#489). That promise only holds if the version
 * the UI reports is the version the backend image actually installs, so read
 * the pin out of r-packages.txt instead of trusting the constant on its own.
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

describe("phacking version pin", () => {
  it("pins phacking to an exact version in the backend package list", () => {
    const entry = readPackageEntries().find((line) =>
      line.startsWith("phacking"),
    );

    expect(entry).toBeDefined();
    // pak reads this file verbatim; "phacking" alone installs whatever CRAN
    // ships on the day the image is rebuilt.
    expect(entry).toMatch(/^phacking@\d+(\.\d+)*$/);
  });

  it("reports the pinned version to the reproducibility package", () => {
    const entry = readPackageEntries().find((line) =>
      line.startsWith("phacking@"),
    );
    const pinnedVersion = entry?.split("@")[1];

    expect(CONST.REPRODUCIBILITY.DEFAULTS.PHACKING_VERSION).toBe(pinnedVersion);
  });
});
