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
const FETCH_TIMEOUT_MS = 630_000; // total work budget, below the Lambda 660s timeout
const TERMINAL_STATUSES = new Set(["succeeded", "failed", "timedout"]);

// Retry budget for HTTP 429 only (see postWithThrottleRetry). Nominally
// 2+4+8+16+32 = ~62s of waiting for a concurrency slot, jittered, and always
// bounded by the run's overall deadline.
const THROTTLE_MAX_RETRIES = 5;
const THROTTLE_BASE_DELAY_MS = 2_000;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/**
 * POST to the R backend, retrying *only* on HTTP 429.
 *
 * A 429 means the R Lambda's reserved-concurrency cap rejected the invocation,
 * so the analysis never ran. That makes a retry both safe and cheap, and it is
 * the one case the async design's D4 ("no auto-retry") does not actually cover:
 * D4 refuses retries because MCMC is nondeterministic and pathological datasets
 * just re-time-out at double cost, which is only true of runs that executed.
 * Without this, a burst of synchronous traffic saturating the cap would mark
 * queued runs permanently `failed` instead of letting them wait for a slot.
 *
 * Every other response, including 5xx, is returned untouched for the caller to
 * record as terminal.
 */
export async function postWithThrottleRetry(
  url: string,
  body: string,
  deadline: number,
): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      throw new Error("Timed out waiting for R backend capacity.");
    }

    // eslint-disable-next-line no-await-in-loop
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: AbortSignal.timeout(remaining),
    });

    if (response.status !== 429) {
      return response;
    }

    const delay = Math.round(
      THROTTLE_BASE_DELAY_MS * 2 ** attempt * (0.5 + Math.random()),
    );
    if (attempt >= THROTTLE_MAX_RETRIES || Date.now() + delay >= deadline) {
      return response; // out of budget; caller records the 429 as terminal
    }

    // Release the socket before sleeping; the body is a throttle error we
    // never read.
    // eslint-disable-next-line no-await-in-loop
    await response.arrayBuffer().catch(() => undefined);
    // eslint-disable-next-line no-await-in-loop
    await sleep(delay);
  }
}

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
    const response = await postWithThrottleRetry(
      `${rApiUrl}${endpoint}`,
      // Mirror the browser modelService request shape: the R Plumber endpoint
      // expects JSON strings for `data` and `parameters`.
      JSON.stringify({
        data: JSON.stringify(data),
        parameters: JSON.stringify(parameters),
      }),
      startedAt + FETCH_TIMEOUT_MS,
    );

    if (!response.ok) {
      await markTerminal(jobId, "failed", {
        startedAt,
        errorMessage:
          response.status === 429
            ? "R backend is at capacity: every concurrency slot was busy for the whole retry window. Please try again."
            : `R backend returned HTTP ${response.status}`,
      });
      return;
    }

    const text = await response.text();

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
