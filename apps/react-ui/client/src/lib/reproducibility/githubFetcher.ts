/**
 * GitHub repository fetcher for R source code
 *
 * Fetches the actual backend R code from the GitHub repository
 * to ensure the reproducibility package contains the exact code that was deployed.
 */

import CONST from "@src/CONST";
import type { RCodeBundle } from "@src/types/reproducibility";

const {
  GITHUB: {
    OWNER: GITHUB_OWNER,
    REPO_UI: GITHUB_REPO,
    R_SCRIPTS_PATH: R_SCRIPTS_BASE_PATH,
  },
} = CONST;

/**
 * Fetches a file from GitHub using the raw content URL
 *
 * @param filePath - Path to the file in the repository
 * @param commitHash - Git commit hash or "latest" for master branch
 * @returns File content as string
 */
async function fetchRFileFromGitHub(
  filePath: string,
  commitHash = "latest",
): Promise<string> {
  // Use "master" branch if commitHash is "latest"
  const ref = commitHash === "latest" ? "master" : commitHash;

  // Try raw content URL first (faster, no rate limits for public repos)
  const rawUrl = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${ref}/${filePath}`;

  try {
    const response = await fetch(rawUrl);

    if (!response.ok) {
      throw new Error(
        `Failed to fetch from raw URL: ${response.status} ${response.statusText}`,
      );
    }

    return await response.text();
  } catch (rawError) {
    console.warn("Raw URL fetch failed, trying GitHub API:", rawError);

    // Fallback to GitHub API (has rate limits but more reliable)
    const apiUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filePath}?ref=${ref}`;

    try {
      const response = await fetch(apiUrl);

      if (!response.ok) {
        throw new Error(
          `GitHub API request failed: ${response.status} ${response.statusText}`,
        );
      }

      const data = (await response.json()) as { content: string };

      // GitHub API returns base64-encoded content
      if (data.content) {
        return atob(data.content);
      }

      throw new Error("No content in GitHub API response");
    } catch (apiError) {
      console.error("GitHub API fetch also failed:", apiError);
      throw new Error(
        `Failed to fetch ${filePath} from GitHub. Both raw URL and API failed. ` +
          `This may indicate the file doesn't exist at commit ${ref}, or there's a network issue.`,
      );
    }
  }
}

/**
 * Fetches all R source code files needed for reproducibility
 *
 * @param commitHash - Git commit hash or "latest" for master branch
 * @returns Bundle containing all R source code files
 */
async function fetchReproducibilityBundle(
  commitHash = "latest",
): Promise<RCodeBundle> {
  const files = [
    { key: "maiveModel", filename: "maive_model.R" },
    { key: "funnelPlot", filename: "funnel_plot.R" },
    { key: "hostHelpers", filename: "host.R" },
  ];

  const results: Partial<RCodeBundle> = {};

  // Fetch all files in parallel
  await Promise.all(
    files.map(async ({ key, filename }) => {
      const filePath = `${R_SCRIPTS_BASE_PATH}/${filename}`;
      try {
        const content = await fetchRFileFromGitHub(filePath, commitHash);
        results[key as keyof RCodeBundle] = content;
      } catch (error) {
        console.error(`Failed to fetch ${filename}:`, error);
        // For optional files like hostHelpers, we can continue without them
        if (key === "hostHelpers") {
          console.warn(`Skipping optional file ${filename}`);
        } else {
          throw error; // Re-throw for required files
        }
      }
    }),
  );

  // Validate that required files were fetched
  if (!results.maiveModel || !results.funnelPlot) {
    throw new Error("Failed to fetch required R source files");
  }

  return results as RCodeBundle;
}

/**
 * Cache for fetched code bundles (in-memory, per session)
 * Key: commit hash, Value: code bundle
 */
const bundleCache = new Map<string, RCodeBundle>();

/**
 * Fetches reproducibility bundle with caching
 *
 * @param commitHash - Git commit hash or "latest"
 * @returns Cached or freshly fetched code bundle
 */
export async function fetchRCodeBundle(
  commitHash = "latest",
): Promise<RCodeBundle> {
  // Check cache first
  if (bundleCache.has(commitHash)) {
    console.log(`Using cached code bundle for commit ${commitHash}`);
    return bundleCache.get(commitHash) ?? ({} as RCodeBundle);
  }

  // Fetch and cache
  console.log(`Fetching code bundle from GitHub for commit ${commitHash}...`);
  const bundle = await fetchReproducibilityBundle(commitHash);
  bundleCache.set(commitHash, bundle);

  return bundle;
}

/**
 * Gets the full GitHub URL for a file at a specific commit
 *
 * @param filePath - Path to the file in the repository
 * @param commitHash - Git commit hash
 * @returns GitHub URL for viewing the file
 */
export function getGitHubFileUrl(filePath: string, commitHash: string): string {
  return `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/blob/${commitHash}/${filePath}`;
}
