/**
 * The MAIVE tag the backend pins (package.json `maiveTag`, served by
 * /api/get-version-info), as the footer shows it and links to its source.
 * It reads "unknown" until the version info has loaded.
 */
const UNKNOWN_TAG = "unknown";

/** The tag for display, with a leading "v" ("0.4.0" shows as "v0.4.0"). */
export const formatMaiveTagForDisplay = (tag: string): string => {
  if (tag === UNKNOWN_TAG) {
    return UNKNOWN_TAG;
  }
  return tag.startsWith("v") ? tag : `v${tag}`;
};

/**
 * The GitHub page for the pinned source: the repository until the tag is
 * known, then the tree at that tag. A tag is a git ref, so it is used exactly
 * as written: the GitHub-only 0.4.0 release has no "v", and adding one would
 * point at a tag that does not exist.
 */
export const maiveSourceHref = (tag: string, repoUrl: string): string => {
  if (tag === UNKNOWN_TAG) {
    return repoUrl;
  }
  return `${repoUrl}/tree/${tag}`;
};
