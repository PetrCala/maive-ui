import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import type { SQSEvent, SQSRecord } from "aws-lambda";

const region = process.env.AWS_REGION;
const tableName = process.env.RUNS_TABLE_NAME ?? "";
const rApiUrl = (process.env.R_API_URL ?? "").replace(/\/+$/, "");

const TTL_SECONDS = 48 * 60 * 60; // 48h
const FETCH_TIMEOUT_MS = 630_000; // below the Lambda 660s timeout
const TERMINAL_STATUSES = new Set(["succeeded", "failed", "timedout"]);

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));

type QueueMessage = {
  jobId: string;
  modelType: string;
  data: unknown;
  parameters: unknown;
};

type RBackendResponse = {
  data?: unknown;
  error?: boolean | string;
  message?: string;
};

type TerminalStatus = "succeeded" | "failed" | "timedout";

type TerminalFields = {
  startedAt: number;
  result?: string;
  errorMessage?: string;
};

/**
 * SQS-triggered handler. The event-source mapping uses batch size 1, but we
 * loop defensively. Model/analysis failures are recorded as terminal states
 * (no throw) so the message is consumed; only infrastructure failures throw,
 * routing the message to the DLQ (maxReceiveCount=1, no auto-retry).
 */
export const handler = async (event: SQSEvent): Promise<void> => {
  for (const record of event.Records) {
    // eslint-disable-next-line no-await-in-loop
    await processRecord(record);
  }
};

async function processRecord(record: SQSRecord): Promise<void> {
  const message = JSON.parse(record.body) as QueueMessage;
  const { jobId, modelType, data, parameters } = message;
  if (!jobId) {
    return;
  }

  // Idempotency: skip if already terminal (e.g. a duplicate delivery).
  const existing = await ddb.send(
    new GetCommand({
      TableName: tableName,
      Key: { jobId },
      ProjectionExpression: "#status",
      ExpressionAttributeNames: { "#status": "status" },
    }),
  );
  if (existing.Item && TERMINAL_STATUSES.has(existing.Item.status as string)) {
    return;
  }

  const startedAt = Date.now();
  await ddb.send(
    new UpdateCommand({
      TableName: tableName,
      Key: { jobId },
      UpdateExpression: "SET #status = :running, startedAt = :startedAt",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: {
        ":running": "running",
        ":startedAt": startedAt,
      },
    }),
  );

  const endpoint = modelType === "RTMA" ? "/run-rtma" : "/run-model";

  try {
    const response = await fetch(`${rApiUrl}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Mirror the browser modelService request shape: the R Plumber endpoint
      // expects JSON strings for `data` and `parameters`.
      body: JSON.stringify({
        data: JSON.stringify(data),
        parameters: JSON.stringify(parameters),
      }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    const text = await response.text();

    if (!response.ok) {
      await markTerminal(jobId, "failed", {
        startedAt,
        errorMessage: `R backend returned HTTP ${response.status}`,
      });
      return;
    }

    let parsed: RBackendResponse;
    try {
      parsed = JSON.parse(text) as RBackendResponse;
    } catch {
      await markTerminal(jobId, "failed", {
        startedAt,
        errorMessage: "R backend returned an unparseable response.",
      });
      return;
    }

    // The R endpoints return { data } on success or { error, message } on
    // failure (both HTTP 200).
    if (parsed.error) {
      const messageText = parsed.message ?? "Analysis failed.";
      const status: TerminalStatus = /timed out|timeout/i.test(messageText)
        ? "timedout"
        : "failed";
      await markTerminal(jobId, status, { startedAt, errorMessage: messageText });
      return;
    }

    await markTerminal(jobId, "succeeded", {
      startedAt,
      result: JSON.stringify(parsed.data ?? {}),
    });
  } catch (error) {
    const messageText =
      error instanceof Error ? error.message : "R backend request failed.";
    const status: TerminalStatus = /timed out|timeout|abort/i.test(messageText)
      ? "timedout"
      : "failed";
    // No auto-retry: record terminal so the message is consumed rather than
    // redelivered. (A DynamoDB write failure below would throw -> DLQ.)
    await markTerminal(jobId, status, { startedAt, errorMessage: messageText });
  }
}

async function markTerminal(
  jobId: string,
  status: TerminalStatus,
  fields: TerminalFields,
): Promise<void> {
  const finishedAt = Date.now();
  const names: Record<string, string> = {
    "#status": "status",
    "#ttl": "ttl",
  };
  const values: Record<string, unknown> = {
    ":status": status,
    ":finishedAt": finishedAt,
    ":runDurationMs": finishedAt - fields.startedAt,
    ":ttl": Math.floor(finishedAt / 1000) + TTL_SECONDS,
  };
  let updateExpr =
    "SET #status = :status, finishedAt = :finishedAt, runDurationMs = :runDurationMs, #ttl = :ttl";

  if (fields.result !== undefined) {
    names["#result"] = "result";
    values[":result"] = fields.result;
    updateExpr += ", #result = :result";
  }
  if (fields.errorMessage !== undefined) {
    values[":errorMessage"] = fields.errorMessage;
    updateExpr += ", errorMessage = :errorMessage";
  }

  await ddb.send(
    new UpdateCommand({
      TableName: tableName,
      Key: { jobId },
      UpdateExpression: updateExpr,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
    }),
  );
}
