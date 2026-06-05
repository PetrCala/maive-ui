import type { NextApiRequest, NextApiResponse } from "next";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  BatchGetCommand,
} from "@aws-sdk/lib-dynamodb";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import type {
  SubmitRunResponse,
  GetRunResponse,
  RunStatus,
} from "@src/types/api";
import { generateJobId } from "@src/utils/idUtils";

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

const region =
  process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? undefined;
const tableName = process.env.RUNS_TABLE_NAME;
const queueUrl = process.env.RUNS_QUEUE_URL;

const TTL_SECONDS = 48 * 60 * 60; // 48h pickup buffer
// Keep the SQS message under the 256KB hard limit; larger datasets fall back
// to the synchronous path (which posts directly to the R Lambda).
const MAX_QUEUE_BODY_BYTES = 200 * 1024;
const MAX_BATCH_IDS = 100; // DynamoDB BatchGetItem caps at 100 keys

let ddbDocClient: DynamoDBDocumentClient | undefined;
let sqsClient: SQSClient | undefined;

const getDdbDocClient = () => {
  if (!region) {
    return undefined;
  }
  if (!ddbDocClient) {
    ddbDocClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));
  }
  return ddbDocClient;
};

const getSqsClient = () => {
  if (!region) {
    return undefined;
  }
  if (!sqsClient) {
    sqsClient = new SQSClient({ region });
  }
  return sqsClient;
};

const handler = async (
  req: NextApiRequest,
  res: NextApiResponse<
    SubmitRunResponse | GetRunResponse[] | { error: string }
  >,
) => {
  if (!tableName) {
    return res.status(503).json({ error: "Async runs are not configured." });
  }

  const ddb = getDdbDocClient();
  if (!ddb) {
    return res.status(503).json({ error: "Async runs are not configured." });
  }

  // GET /api/runs?ids=a,b,c — batch status lookup for the My Runs list / watcher.
  if (req.method === "GET") {
    const idsParam = req.query.ids;
    const idsRaw = Array.isArray(idsParam)
      ? idsParam.join(",")
      : (idsParam ?? "");
    const ids = idsRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, MAX_BATCH_IDS);
    if (ids.length === 0) {
      return res.status(200).json([]);
    }
    try {
      const out = await ddb.send(
        new BatchGetCommand({
          RequestItems: {
            [tableName]: {
              Keys: ids.map((id) => ({ jobId: id })),
              // Status-only projection (no heavy `result`) — the list/watcher
              // only needs status; the full result is fetched per-run elsewhere.
              ProjectionExpression:
                "jobId, #status, modelType, errorMessage, runDurationMs, submittedAt",
              // eslint-disable-next-line @typescript-eslint/naming-convention
              ExpressionAttributeNames: { "#status": "status" },
            },
          },
        }),
      );
      const items = out.Responses?.[tableName] ?? [];
      const runs: GetRunResponse[] = items.map((item) => ({
        jobId: item.jobId as string,
        status: item.status as RunStatus,
        modelType: item.modelType as GetRunResponse["modelType"],
        errorMessage: (item.errorMessage as string | undefined) ?? undefined,
        runDurationMs:
          typeof item.runDurationMs === "number"
            ? item.runDurationMs
            : undefined,
        runTimestamp:
          typeof item.submittedAt === "number"
            ? new Date(item.submittedAt).toISOString()
            : undefined,
      }));
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

  const sqs = getSqsClient();
  if (!queueUrl || !sqs) {
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

  const jobId = generateJobId();
  const messageBody = JSON.stringify({ jobId, modelType, data, parameters });

  // Too large to queue via SQS — caller falls back to the synchronous path.
  if (Buffer.byteLength(messageBody, "utf8") > MAX_QUEUE_BODY_BYTES) {
    return res.status(200).json({ tooLarge: true });
  }

  const now = Date.now();
  const ttl = Math.floor(now / 1000) + TTL_SECONDS;

  try {
    await ddb.send(
      new PutCommand({
        TableName: tableName,
        Item: {
          jobId,
          status: "queued",
          modelType,
          parameters: JSON.stringify(parameters),
          dataId: dataId ?? null,
          submittedAt: now,
          ttl,
        },
      }),
    );

    await sqs.send(
      new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: messageBody,
      }),
    );

    return res.status(200).json({ jobId });
  } catch (error) {
    console.error("Failed to submit run", error);
    return res.status(500).json({ error: "Failed to submit run." });
  }
};

export default handler;
