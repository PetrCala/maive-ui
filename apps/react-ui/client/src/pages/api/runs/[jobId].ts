import type { NextApiRequest, NextApiResponse } from "next";
import type { GetRunResponse } from "@src/types/api";
import { getRunItem, getRunsStoreConfig } from "@api/server/runsService";

const handler = async (
  req: NextApiRequest,
  res: NextApiResponse<GetRunResponse | { error: string }>,
) => {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const store = getRunsStoreConfig();
  if (!store) {
    return res.status(503).json({ error: "Async runs are not configured." });
  }

  const { jobId } = req.query;
  const id = Array.isArray(jobId) ? jobId[0] : jobId;
  if (!id) {
    return res.status(400).json({ error: "Missing jobId." });
  }

  try {
    const item = await getRunItem(store.ddb, store.tableName, id);

    if (!item) {
      return res.status(404).json({ error: "Run not found or expired." });
    }

    const body: GetRunResponse = {
      jobId: id,
      status: item.status,
      modelType: item.modelType,
    };
    if (item.result) {
      body.result = item.result;
    }
    if (item.errorMessage) {
      body.errorMessage = item.errorMessage;
    }
    if (typeof item.runDurationMs === "number") {
      body.runDurationMs = item.runDurationMs;
    }
    if (typeof item.submittedAt === "number") {
      body.runTimestamp = new Date(item.submittedAt).toISOString();
    }

    return res.status(200).json(body);
  } catch (error) {
    console.error("Failed to fetch run", error);
    return res.status(500).json({ error: "Failed to fetch run." });
  }
};

export default handler;
