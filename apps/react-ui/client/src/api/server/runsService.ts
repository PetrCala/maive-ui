import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  BatchGetCommand,
} from "@aws-sdk/lib-dynamodb";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import type { GetRunResponse, RunStatus } from "@src/types/api";
import { generateJobId } from "@src/utils/idUtils";
import CONST from "@src/CONST";

// Shared DynamoDB/SQS access for the async runs pipeline. Reused by the
// legacy `/api/runs*` routes and the public `/api/v1/runs*` routes so both
// surfaces talk to the same queue/table without duplicating client setup.

const region =
  process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? undefined;
export const runsTableName = process.env.RUNS_TABLE_NAME;
export const runsQueueUrl = process.env.RUNS_QUEUE_URL;

export const TTL_SECONDS = CONST.RUNS.TTL_SECONDS; // 48h pickup buffer
// Keep the SQS message under the 256KB hard limit; larger datasets fall back
// to the synchronous path (which posts directly to the R Lambda).
export const MAX_QUEUE_BODY_BYTES = 200 * 1024;
export const MAX_BATCH_IDS = 100; // DynamoDB BatchGetItem caps at 100 keys

let ddbDocClient: DynamoDBDocumentClient | undefined;
let sqsClient: SQSClient | undefined;

export const getDdbDocClient = (): DynamoDBDocumentClient | undefined => {
  if (!region) {
    return undefined;
  }
  if (!ddbDocClient) {
    ddbDocClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));
  }
  return ddbDocClient;
};

export const getSqsClient = (): SQSClient | undefined => {
  if (!region) {
    return undefined;
  }
  if (!sqsClient) {
    sqsClient = new SQSClient({ region });
  }
  return sqsClient;
};

export type RunsStoreConfig = {
  ddb: DynamoDBDocumentClient;
  tableName: string;
};

export const getRunsStoreConfig = (): RunsStoreConfig | undefined => {
  if (!runsTableName) {
    return undefined;
  }
  const ddb = getDdbDocClient();
  if (!ddb) {
    return undefined;
  }
  return { ddb, tableName: runsTableName };
};

export type RunsQueueConfig = {
  sqs: SQSClient;
  queueUrl: string;
};

export const getRunsQueueConfig = (): RunsQueueConfig | undefined => {
  if (!runsQueueUrl) {
    return undefined;
  }
  const sqs = getSqsClient();
  if (!sqs) {
    return undefined;
  }
  return { sqs, queueUrl: runsQueueUrl };
};

export const parseIdsParam = (
  idsParam: string | string[] | undefined,
  max: number = MAX_BATCH_IDS,
): string[] => {
  const idsRaw = Array.isArray(idsParam)
    ? idsParam.join(",")
    : (idsParam ?? "");
  return idsRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, max);
};

export const batchGetRunStatuses = async (
  ddb: DynamoDBDocumentClient,
  tableName: string,
  ids: string[],
): Promise<GetRunResponse[]> => {
  if (ids.length === 0) {
    return [];
  }

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
  return items.map((item) => ({
    jobId: item.jobId as string,
    status: item.status as RunStatus,
    modelType: item.modelType as GetRunResponse["modelType"],
    errorMessage: (item.errorMessage as string | undefined) ?? undefined,
    runDurationMs:
      typeof item.runDurationMs === "number" ? item.runDurationMs : undefined,
    runTimestamp:
      typeof item.submittedAt === "number"
        ? new Date(item.submittedAt).toISOString()
        : undefined,
  }));
};

export type RunItem = {
  jobId: string;
  status: RunStatus;
  modelType?: GetRunResponse["modelType"];
  result?: string;
  errorMessage?: string;
  runDurationMs?: number;
  submittedAt?: number;
};

export const getRunItem = async (
  ddb: DynamoDBDocumentClient,
  tableName: string,
  jobId: string,
): Promise<RunItem | undefined> => {
  // Single GetItem with a projection. While the run is non-terminal the
  // `result` attribute doesn't exist yet (cheap read); callers stop polling
  // on a terminal status, so the heavy result is read exactly once.
  const { Item } = await ddb.send(
    new GetCommand({
      TableName: tableName,
      Key: { jobId },
      ProjectionExpression:
        "jobId, #status, modelType, #result, errorMessage, runDurationMs, submittedAt",
      ExpressionAttributeNames: {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        "#status": "status",
        // eslint-disable-next-line @typescript-eslint/naming-convention
        "#result": "result",
      },
    }),
  );

  if (!Item) {
    return undefined;
  }

  return Item as RunItem;
};

export type SubmitRunParams = {
  data: unknown;
  parameters: unknown;
  modelType: string;
  dataId?: string | null;
};

export type SubmitRunOutcome =
  | { outcome: "ok"; jobId: string }
  | { outcome: "too_large" }
  | { outcome: "error"; error: unknown };

export const submitRun = async (
  ddb: DynamoDBDocumentClient,
  sqs: SQSClient,
  tableName: string,
  queueUrl: string,
  params: SubmitRunParams,
): Promise<SubmitRunOutcome> => {
  const jobId = generateJobId();
  const messageBody = JSON.stringify({
    jobId,
    modelType: params.modelType,
    data: params.data,
    parameters: params.parameters,
  });

  // Too large to queue via SQS — caller falls back to the synchronous path.
  if (Buffer.byteLength(messageBody, "utf8") > MAX_QUEUE_BODY_BYTES) {
    return { outcome: "too_large" };
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
          modelType: params.modelType,
          parameters: JSON.stringify(params.parameters),
          dataId: params.dataId ?? null,
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

    return { outcome: "ok", jobId };
  } catch (error) {
    return { outcome: "error", error };
  }
};
