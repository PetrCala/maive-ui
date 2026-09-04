import type { RDTResults, RTMAResults, RunResults } from "@src/types/api";

/**
 * Tell an RDT result from the others by its `model` field.
 *
 * RDT reports neither `muCI` nor `effectEstimate`, so the shape test below
 * would file it under MAIVE and render a diagnostic as an estimate (#559).
 * The backend names the model in the payload for exactly this reason, so
 * check this guard first, before isRtmaResults.
 *
 * @param results A parsed run result of any shape
 * @returns True when the result came from the Residual Discontinuity Test
 */
export const isRdtResults = (results: RunResults): results is RDTResults =>
  "model" in results && results.model === "RDT";

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
export const isRtmaResults = (results: RunResults): results is RTMAResults =>
  "muCI" in results && results.muCI != null;
