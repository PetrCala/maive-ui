import type { NextApiRequest, NextApiResponse } from "next";
import type { GetRunResponse, ResolvedParameters } from "@src/types/api";
import {
  V1_ASYNC_TOP_LEVEL_KEYS,
  type RecipeName,
} from "@src/lib/parameterResolver";
import {
  MAX_BATCH_IDS,
  batchGetRunStatuses,
  getRunsQueueConfig,
  getRunsStoreConfig,
  parseIdsParam,
  submitRun,
} from "@api/server/runsService";
import { resolveRunParameters } from "@api/server/modelParameterDefaults";
import {
  canonicalizeRows,
  resolveColumns,
  validateDataset,
} from "@api/server/datasetValidation";
import { sendApiError, type ApiErrorBody } from "@api/server/errorEnvelope";

// Public re-skin of `/api/runs` (design D8, §6.5): same DynamoDB/SQS
// machinery, but with the `/v1` error envelope, server-side dataset
// validation, applied parameter defaults, and a real `413` instead of the
// internal `{ tooLarge: true }` signal.
export const config = {
  api: {
    bodyParser: {
      sizeLimit: "6mb",
    },
  },
};

type V1SubmitResponse = {
  jobId: string;
  resolvedParameters: ResolvedParameters;
  recipe: RecipeName | null;
};

const handler = async (
  req: NextApiRequest,
  res: NextApiResponse<V1SubmitResponse | GetRunResponse[] | ApiErrorBody>,
) => {
  const store = getRunsStoreConfig();
  if (!store) {
    return sendApiError(
      res,
      "not_configured",
      "Async runs are not configured.",
    );
  }

  // GET /v1/runs?ids=a,b,c: batch status lookup (statuses only, no results).
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
      return sendApiError(res, "internal_error", "Failed to fetch runs.");
    }
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return sendApiError(res, "method_not_allowed", "Method Not Allowed.");
  }

  const queue = getRunsQueueConfig();
  if (!queue) {
    return sendApiError(
      res,
      "not_configured",
      "Async runs are not configured.",
    );
  }

  const { data, parameters, modelType, recipe } = (req.body ?? {}) as {
    data?: unknown;
    parameters?: unknown;
    modelType?: string;
    recipe?: unknown;
  };

  // The shared resolver (#555) expands the named recipe, derives the
  // data-dependent defaults from the submitted rows, and rejects unknown keys
  // or conflicting values with a 400. The queue only ever carries fully
  // resolved parameters, so the orchestrator forwards them verbatim. Unlike
  // the sync endpoints, a top-level `modelType` is the documented form here;
  // any other parameter name at the top level is still a 400 (#574).
  const { resolved, error: parameterError } = resolveRunParameters(
    modelType,
    parameters,
    {
      data,
      recipe,
      body: req.body,
      acceptedTopLevelKeys: V1_ASYNC_TOP_LEVEL_KEYS,
    },
  );
  if (parameterError) {
    return sendApiError(res, "validation_error", parameterError.message);
  }

  const validationError = validateDataset(data, resolved.modelType);
  if (validationError) {
    return sendApiError(res, "validation_error", validationError.message);
  }

  // Queue rows in canonical column order, not as originally submitted: the
  // orchestrator posts queued rows to the legacy R routes, which read
  // columns positionally, so this must match the column resolution
  // validateDataset just used above (#488).
  const rows = data as Array<Record<string, unknown>>;
  const columns = resolveColumns(rows);
  const canonicalData = columns ? canonicalizeRows(rows, columns) : data;

  const submission = await submitRun(
    store.ddb,
    queue.sqs,
    store.tableName,
    queue.queueUrl,
    {
      data: canonicalData,
      parameters: resolved.parameters,
      modelType: resolved.modelType,
    },
  );

  if (submission.outcome === "too_large") {
    return sendApiError(
      res,
      "payload_too_large",
      "Dataset is too large to queue for async processing (~900KB limit). Use the synchronous endpoint (POST /v1/run-model or /v1/run-rtma) instead.",
    );
  }

  if (submission.outcome === "error") {
    console.error("Failed to submit run", submission.error);
    return sendApiError(res, "internal_error", "Failed to submit run.");
  }

  return res.status(200).json({
    jobId: submission.jobId,
    resolvedParameters: resolved.parameters,
    recipe: resolved.recipe,
  });
};

export default handler;
