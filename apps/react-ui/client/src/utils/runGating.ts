import CONST from "@src/CONST";
import type { ModelParameters } from "@src/types/api";

/**
 * Whether a run is too large for the synchronous request path (#528).
 *
 * RTMA runtime scales with the number of rows (k): above
 * CONST.RTMA_SYNC_ROW_LIMIT the interactive run is known to hit the Lambda
 * timeout wall no matter what the timeout is set to. Such runs must go
 * through the background queue; when queuing is unavailable, the run should
 * not be submitted at all. The other model types finish in seconds at any
 * supported size, so they are never gated.
 */
export const isTooLargeForSyncRun = (
  modelType: ModelParameters["modelType"],
  rowCount: number,
): boolean =>
  modelType === CONST.MODEL_TYPES.RTMA && rowCount > CONST.RTMA_SYNC_ROW_LIMIT;
