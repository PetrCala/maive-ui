import type { NextApiRequest, NextApiResponse } from "next";
import type { GetRunResponse } from "@src/types/api";
import { getRunItem, getRunsStoreConfig } from "@api/server/runsService";
import { sendApiError, type ApiErrorBody } from "@api/server/errorEnvelope";

// Public re-skin of `/api/runs/[jobId]` (design D8, §6.5): same lookup, but
// `result` is returned as a parsed JSON object (legacy returns the stored
// string), plot fields are stripped unless `?include=plot` (§6.4/§D7), and
// the `/v1` error envelope is used throughout.

const PLOT_FIELDS = [
  "funnelPlot",
  "funnelPlotWidth",
  "funnelPlotHeight",
  "zScorePlot",
  "zScorePlotWidth",
  "zScorePlotHeight",
] as const;

type V1GetRunResponse = Omit<GetRunResponse, "result"> & {
  result?: Record<string, unknown>;
};

const shouldIncludePlot = (req: NextApiRequest): boolean => {
  const { include } = req.query;
  const values = Array.isArray(include) ? include : [include];
  return values.includes("plot");
};

const stripPlotFields = (
  result: Record<string, unknown>,
): Record<string, unknown> => {
  const stripped = { ...result };
  PLOT_FIELDS.forEach((field) => {
    delete stripped[field];
  });
  return stripped;
};

const handler = async (
  req: NextApiRequest,
  res: NextApiResponse<V1GetRunResponse | ApiErrorBody>,
) => {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendApiError(res, "method_not_allowed", "Method Not Allowed.");
  }

  const store = getRunsStoreConfig();
  if (!store) {
    return sendApiError(
      res,
      "not_configured",
      "Async runs are not configured.",
    );
  }

  const { jobId } = req.query;
  const id = Array.isArray(jobId) ? jobId[0] : jobId;
  if (!id) {
    return sendApiError(res, "validation_error", "Missing jobId.");
  }

  try {
    const item = await getRunItem(store.ddb, store.tableName, id);

    if (!item) {
      return sendApiError(res, "not_found", "Run not found or expired.");
    }

    const body: V1GetRunResponse = {
      jobId: id,
      status: item.status,
      modelType: item.modelType,
    };

    if (item.result) {
      const parsedResult = JSON.parse(item.result) as Record<string, unknown>;
      body.result = shouldIncludePlot(req)
        ? parsedResult
        : stripPlotFields(parsedResult);
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
    return sendApiError(res, "internal_error", "Failed to fetch run.");
  }
};

export default handler;
