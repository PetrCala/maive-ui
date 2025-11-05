import type { NextApiRequest, NextApiResponse } from "next";
import { readFileSync } from "fs";
import { join } from "path";
import type { VersionInfo } from "@src/types/reproducibility";

/**
 * API endpoint that returns version information for reproducibility packages
 *
 * This includes:
 * - UI version from package.json
 * - MAIVE R package tag
 * - Git commit hash
 * - R version
 * - Current timestamp
 */

// Cache version info to avoid repeated file reads
let cachedVersionInfo: VersionInfo | null = null;

function getVersionInfo(): VersionInfo {
  if (cachedVersionInfo) {
    return {
      ...cachedVersionInfo,
      timestamp: new Date().toISOString(),
    };
  }

  // Read UI version from package.json
  const packageJsonPath = join(process.cwd(), "package.json");
  const packageJsonContent = readFileSync(packageJsonPath, "utf-8");
  const packageJson = JSON.parse(packageJsonContent) as { version?: string };
  const uiVersion =
    typeof packageJson.version === "string" ? packageJson.version : "unknown";

  // Get MAIVE tag from environment variable (set during build/deployment)
  // Falls back to reading from release workflow file if not set
  const maiveTag = process.env.MAIVE_TAG ?? "0.0.3.4"; // Default to current version

  // Get git commit hash from environment variable (set during build)
  // Falls back to "latest" if not available
  const gitCommitHash =
    process.env.GIT_COMMIT_HASH ??
    process.env.NEXT_PUBLIC_GIT_COMMIT_HASH ??
    "latest";

  // Get R version from environment variable (set during build)
  const rVersion = process.env.R_VERSION ?? "4.4.1"; // Default to current version

  cachedVersionInfo = {
    uiVersion,
    maiveTag,
    gitCommitHash,
    rVersion,
    timestamp: new Date().toISOString(),
  };

  return cachedVersionInfo;
}

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<VersionInfo | { error: string }>,
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const versionInfo = getVersionInfo();
    res.status(200).json(versionInfo);
  } catch (error) {
    console.error("Error getting version info:", error);
    res.status(500).json({ error: "Failed to retrieve version information" });
  }
}
