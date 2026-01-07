/**
 * Removes ANSI escape codes and other terminal formatting artifacts from error messages.
 *
 * This is needed because backend layers (R + cli) may emit styled output (e.g. bold),
 * which can leak into JSON error strings and render as "weird characters" in the UI.
 */
export function cleanCliErrorMessage(input: string): string {
  const withoutAnsi = input
    // ANSI CSI sequences, e.g. \u001b[1m, \u001b[22m
    .replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, "")
    // ANSI OSC sequences, e.g. \u001b]...<BEL> or \u001b]...\u001b\\
    .replace(/\u001b\][^\u0007]*(?:\u0007|\u001b\\)/g, "");

  const withoutCliMarkers = withoutAnsi
    // cli often prefixes errors with a cross marker in terminal output
    .replace(/^\s*✖\s*/gm, "")
    .trim();

  // If a layer prepended a generic server prefix, keep only the meaningful MAIVE message.
  return withoutCliMarkers.replace(/^internal server error:\s*/i, "");
}
