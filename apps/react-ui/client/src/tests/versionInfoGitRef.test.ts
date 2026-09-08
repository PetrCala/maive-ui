// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockReq, createMockRes } from "@tests/helpers/nextApiMocks";
import {
  describeGitRef,
  generateVersionManifest,
  gitRefUrl,
} from "@src/lib/reproducibility/generators/readme";
import type { VersionInfo } from "@src/types/reproducibility";
import CONFIG from "@src/CONFIG";
import CONST from "@src/CONST";

// Reproducibility packages used to print "latest" into /commit/ and /blob/
// URLs whenever the deployment had no commit hash, so every package shipped
// dead links (#555). The hash now comes from GIT_COMMIT_HASH on the UI
// Lambda, and when it is absent the package says so and links the branch.

const ENV_KEYS = ["GIT_COMMIT_HASH", "NEXT_PUBLIC_GIT_COMMIT_HASH"] as const;
const savedEnv: Record<string, string | undefined> = {};

const SHA = "0123456789abcdef0123456789abcdef01234567";

const versionInfoWith = (overrides: Partial<VersionInfo>): VersionInfo => ({
  uiVersion: "1.0.0",
  maiveTag: "v0.2.5",
  gitCommitHash: "unknown",
  gitRef: CONST.GITHUB.DEFAULT_BRANCH,
  isExactCommit: false,
  rVersion: "4.4.1",
  phackingVersion: "0.2.1",
  clubSandwichVersion: "0.7.0",
  timestamp: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

beforeEach(() => {
  ENV_KEYS.forEach((key) => {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  });
  vi.resetModules();
});

afterEach(() => {
  ENV_KEYS.forEach((key) => {
    if (savedEnv[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = savedEnv[key];
    }
  });
});

describe("GET /api/get-version-info", () => {
  it("reports the deployed commit when GIT_COMMIT_HASH is set", async () => {
    process.env.GIT_COMMIT_HASH = SHA;
    const { default: handler } = await import(
      "@src/pages/api/get-version-info"
    );
    const res = createMockRes<VersionInfo | { error: string }>();
    handler(createMockReq({ method: "GET" }), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      gitCommitHash: SHA,
      gitRef: SHA,
      isExactCommit: true,
    });
  });

  it("falls back to the default branch, never to a fake ref, when unset", async () => {
    const { default: handler } = await import(
      "@src/pages/api/get-version-info"
    );
    const res = createMockRes<VersionInfo | { error: string }>();
    handler(createMockReq({ method: "GET" }), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      gitCommitHash: "unknown",
      gitRef: CONST.GITHUB.DEFAULT_BRANCH,
      isExactCommit: false,
    });
    expect(JSON.stringify(res.body)).not.toContain("latest");
  });

  it("ignores a value that is not a commit hash", async () => {
    process.env.GIT_COMMIT_HASH = "latest";
    const { default: handler } = await import(
      "@src/pages/api/get-version-info"
    );
    const res = createMockRes<VersionInfo | { error: string }>();
    handler(createMockReq({ method: "GET" }), res);

    expect(res.body).toMatchObject({
      gitCommitHash: "unknown",
      gitRef: CONST.GITHUB.DEFAULT_BRANCH,
    });
  });
});

describe("reproducibility package git references", () => {
  const parameters = { ...CONFIG.DEFAULT_MODEL_PARAMETERS };

  it("link the exact commit when it is known", () => {
    const info = versionInfoWith({
      gitCommitHash: SHA,
      gitRef: SHA,
      isExactCommit: true,
    });
    expect(describeGitRef(info)).toBe(SHA);
    expect(gitRefUrl(info)).toBe(
      `${CONST.LINKS.APP_GITHUB.HOMEPAGE}/commit/${SHA}`,
    );
    const manifest = generateVersionManifest(info, parameters);
    expect(manifest).toContain(
      `/blob/${SHA}/${CONST.GITHUB.R_SCRIPTS_PATH}/maive_model.R`,
    );
  });

  it("link the branch and say the commit is unknown otherwise", () => {
    const info = versionInfoWith({});
    expect(describeGitRef(info)).toContain("not recorded");
    expect(gitRefUrl(info)).toBe(
      `${CONST.LINKS.APP_GITHUB.HOMEPAGE}/tree/${CONST.GITHUB.DEFAULT_BRANCH}`,
    );
    const manifest = generateVersionManifest(info, parameters);
    expect(manifest).toContain(
      `/blob/${CONST.GITHUB.DEFAULT_BRANCH}/${CONST.GITHUB.R_SCRIPTS_PATH}/funnel_plot.R`,
    );
    expect(manifest).not.toContain("/commit/");
    expect(manifest).not.toContain("latest");
  });
});
