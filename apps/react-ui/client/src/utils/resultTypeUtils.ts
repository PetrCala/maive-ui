import type { ModelResults, RTMAResults } from "@src/types/api";

/**
 * Tell an RTMA result from a MAIVE/WAIVE/WLS one by its shape.
 *
 * The results page picks the renderer from the requested `modelType`, which it
 * always has to hand. The compare page may not: a run whose entry has been
 * removed from the local list still has a cached result and a jobId in the URL,
 * and guessing its model type wrong renders the wrong summary. The payload
 * itself is unambiguous, so read that instead: only RTMA reports `muCI`, and
 * only the others report `effectEstimate`.
 *
 * @param results A parsed run result of either shape
 * @returns True when the result came from an RTMA fit
 */
export const isRtmaResults = (
  results: ModelResults | RTMAResults,
): results is RTMAResults => "muCI" in results && results.muCI != null;
