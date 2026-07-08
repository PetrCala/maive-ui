import type { NextApiRequest, NextApiResponse } from "next";
import type { SubmitRunResponse, GetRunResponse } from "@src/types/api";
import {
  MAX_BATCH_IDS,
  batchGetRunStatuses,
  getRunsQueueConfig,
  getRunsStoreConfig,
  parseIdsParam,
  submitRun,
} from "@api/server/runsService";

// Allow larger request bodies than Next.js's 1mb default so we can accept a
// dataset and decide whether to queue it or signal the synchronous fallback.
// Bounded by the Lambda sync payload limit (~6mb).
export const config = {
  api: {
    bodyParser: {
      sizeLimit: "6mb",
    },
  },
};

const handler = async (
  req: NextApiRequest,
  res: NextApiResponse<
    SubmitRunResponse | GetRunResponse[] | { error: string }
  >,
) => {
  const store = getRunsStoreConfig();
  if (!store) {
    return res.status(503).json({ error: "Async runs are not configured." });
  }

  // GET /api/runs?ids=a,b,c — batch status lookup for the My Runs list / watcher.
  if (req.method === "GET") {
    const ids = parseIdsParam(req.query.ids, MAX_BATCH_IDS);
    if (ids.length === 0) {
      return res.status(200).json([]);
    }
    try {
      const runs = await batchGetRunStatuses(store.ddb, store.tableName, ids);
      return res.status(200).json(runs);
    } catch (error) {
      console.error("Failed to batch-fetch runs", error);
      return res.status(500).json({ error: "Failed to fetch runs." });
    }
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const queue = getRunsQueueConfig();
  if (!queue) {
    return res.status(503).json({ error: "Async runs are not configured." });
  }

  const { data, parameters, dataId, modelType } = (req.body ?? {}) as {
    data?: unknown;
    parameters?: unknown;
    dataId?: string;
    modelType?: string;
  };

  if (!data || !parameters || !modelType) {
    return res
      .status(400)
      .json({ error: "Missing required fields: data, parameters, modelType." });
  }

  const submission = await submitRun(
    store.ddb,
    queue.sqs,
    store.tableName,
    queue.queueUrl,
    { data, parameters, modelType, dataId },
  );

  if (submission.outcome === "too_large") {
    return res.status(200).json({ tooLarge: true });
  }

  if (submission.outcome === "error") {
    console.error("Failed to submit run", submission.error);
    return res.status(500).json({ error: "Failed to submit run." });
  }

  return res.status(200).json({ jobId: submission.jobId });
};

export default handler;
