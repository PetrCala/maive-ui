import { createHash } from "crypto";
import { Sha256 } from "@aws-crypto/sha256-js";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { HttpRequest } from "@smithy/protocol-http";
import { SignatureV4 } from "@smithy/signature-v4";
import type { SQSEvent, SQSRecord } from "aws-lambda";

const region = process.env.AWS_REGION;
const tableName = process.env.RUNS_TABLE_NAME ?? "";
const rApiUrl = (process.env.R_API_URL ?? "").replace(/\/+$/, "");

const TTL_SECONDS = 48 * 60 * 60; // 48h
const FETCH_TIMEOUT_MS = 630_000; // total work budget, below the Lambda 660s timeout
const TERMINAL_STATUSES = new Set(["succeeded", "failed", "timedout"]);

// -- Run records + dedup (#529) ---------------------------------------------
// Persistent per-input records live in the runs table under
// `jobId = "input#<sha256>"` with a 30 day TTL: input hash, k, method,
// outcome, duration, timestamps and a run counter. The same record answers
// identical resubmissions (already running, or recently timed out) without
// recomputing. Keep the hashing and record semantics in sync with the UI
// server's copy in apps/react-ui/client/src/api/server/runRecords.ts.

const RUN_RECORD_KEY_PREFIX = "input#";
const RUN_RECORD_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days
const RUNNING_FRESH_MS = 700_000; // above the R budget (570s) plus margin
const TIMEOUT_REUSE_MS = 6 * 60 * 60 * 1000; // replay window for timeouts
const DEDUP_POLL_MS = 15_000; // poll cadence while waiting on an identical run
const DEDUP_REPLAY_SUFFIX = " (reused from an identical earlier run)";
const DEDUP_TIMEOUT_FALLBACK_MESSAGE =
  "An identical analysis recently timed out. Please adjust the dataset or parameters before retrying.";
const DEDUP_WAIT_EXHAUSTED_MESSAGE =
  "An identical analysis was already running and did not finish within the wait budget. Please resubmit if you still need this run.";

// Background runs get the R backend's maximum request budget instead of its
// 120 s interactive default: waiting is the point of a queued run. Injected
// into the forwarded parameters unless the submitter set a budget explicitly.
// Keep in sync with REQUEST_TIMEOUT_MAX_SEC in
// apps/lambda-r-backend/r_scripts/request_bounds.R (#526).
const BACKGROUND_TIMEOUT_SECONDS = 570;

// Retry budget for HTTP 429 only (see postWithThrottleRetry). Nominally
// 2+4+8+16+32 = ~62s of waiting for a concurrency slot, jittered, and always
// bounded by the run's overall deadline.
const THROTTLE_MAX_RETRIES = 5;
const THROTTLE_BASE_DELAY_MS = 2_000;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/** Region from `<id>.lambda-url.<region>.on.aws`, else the runtime's region. */
function resolveSigningRegion(hostname: string): string {
  const parts = hostname.split(".");
  const lambdaUrlIndex = parts.indexOf("lambda-url");
  if (lambdaUrlIndex !== -1 && parts.length > lambdaUrlIndex + 1) {
    return parts[lambdaUrlIndex + 1];
  }
  return region ?? "eu-central-1";
}

/**
 * Headers for a POST to the R backend. The Function URL requires IAM auth
 * (#530), so requests to it are SigV4-signed with the execution role's
 * credentials; non Function URL targets (local testing) stay unsigned. Signing
 * happens per attempt because the signature covers the request date.
 */
async function buildRequestHeaders(
  url: URL,
  body: string,
  inputHash?: string,
): Promise<Record<string, string>> {
  const baseHeaders: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (inputHash) {
    // Lets the R backend's structured request log line (#532) be joined with
    // the persistent run record (#529).
    baseHeaders["x-maive-input-hash"] = inputHash;
  }
  if (!url.hostname.endsWith(".on.aws")) {
    return baseHeaders;
  }

  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  if (!accessKeyId || !secretAccessKey) {
    throw new Error(
      "AWS credentials are not available to sign the R backend request.",
    );
  }

  const signer = new SignatureV4({
    service: "lambda",
    region: resolveSigningRegion(url.hostname),
    credentials: {
      accessKeyId,
      secretAccessKey,
      sessionToken: process.env.AWS_SESSION_TOKEN,
    },
    sha256: Sha256,
  });

  const signed = await signer.sign(
    new HttpRequest({
      method: "POST",
      protocol: url.protocol,
      hostname: url.hostname,
      path: url.pathname,
      headers: {
        "content-type": "application/json",
        host: url.hostname,
        ...(inputHash ? { "x-maive-input-hash": inputHash } : {}),
      },
      body,
    }),
  );
  return signed.headers;
}

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
  inputHash?: string,
): Promise<Response> {
  const target = new URL(url);
  for (let attempt = 0; ; attempt++) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      throw new Error("Timed out waiting for R backend capacity.");
    }

    // eslint-disable-next-line no-await-in-loop
    const headers = await buildRequestHeaders(target, body, inputHash);
    // eslint-disable-next-line no-await-in-loop
    const response = await fetch(url, {
      method: "POST",
      headers,
      body,
      signal: AbortSignal.timeout(deadline - Date.now()),
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
  code?: string;
  message?: string;
};

type TerminalStatus = "succeeded" | "failed" | "timedout";

type TerminalFields = {
  startedAt: number;
  result?: string;
  errorMessage?: string;
  errorCode?: string;
};

type RunRecord = {
  status: "running" | TerminalStatus;
  sourceJobId?: string;
  startedAt?: number;
  finishedAt?: number;
  errorMessage?: string;
  errorCode?: string;
};

// Locale-independent key ordering, so hashes are stable across runtimes.
function compareKeys(a: string, b: string): number {
  if (a < b) {
    return -1;
  }
  if (a > b) {
    return 1;
  }
  return 0;
}

/** JSON.stringify with object keys sorted at every level, so logically equal
 * parameter objects hash identically regardless of key order. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "null";
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => compareKeys(a, b))
    .map(([key, v]) => `${JSON.stringify(key)}:${stableStringify(v)}`);
  return `{${entries.join(",")}}`;
}

/**
 * Hash one run's input: endpoint, dataset and parameters. `timeoutSeconds` is
 * excluded from the parameters (this worker injects a background budget), so
 * the same logical input hashes identically whether it ran synchronously or
 * through the queue.
 */
export function computeInputHash(
  endpoint: string,
  data: unknown,
  parameters: unknown,
): string {
  const dataString = typeof data === "string" ? data : stableStringify(data);
  let params: unknown = parameters;
  if (typeof params === "string") {
    try {
      params = JSON.parse(params);
    } catch {
      // Unparseable parameters hash as the raw string.
    }
  }
  if (params && typeof params === "object" && !Array.isArray(params)) {
    const { timeoutSeconds: _ignored, ...rest } = params as Record<
      string,
      unknown
    >;
    params = rest;
  }
  return createHash("sha256")
    .update(`${endpoint}\n${dataString}\n${stableStringify(params ?? null)}`)
    .digest("hex");
}

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

  const baseParameters =
    parameters && typeof parameters === "object" && !Array.isArray(parameters)
      ? (parameters as Record<string, unknown>)
      : {};
  const parametersWithBudget = {
    timeoutSeconds: BACKGROUND_TIMEOUT_SECONDS,
    ...baseParameters,
  };

  // Run records + dedup (#529). Recording never breaks a run: every record
  // operation degrades to the plain flow on failure.
  const inputHash = computeInputHash(endpoint, data, baseParameters);
  try {
    const deduped = await tryDedup(jobId, inputHash, startedAt);
    if (deduped) {
      return;
    }
    await startRunRecord(inputHash, endpoint, jobId, message, startedAt);
  } catch (error) {
    console.error("Run record layer failed; running without dedup", error);
  }

  // Terminal write for an executed run: job item plus the persistent record.
  const finish = async (
    status: TerminalStatus,
    fields: TerminalFields,
  ): Promise<void> => {
    await markTerminal(jobId, status, fields);
    try {
      await finishRunRecord(
        inputHash,
        status,
        startedAt,
        fields.errorMessage,
        fields.errorCode,
      );
    } catch (error) {
      console.error("Failed to finish run record", error);
    }
  };

  try {
    const response = await postWithThrottleRetry(
      `${rApiUrl}${endpoint}`,
      // Mirror the browser modelService request shape: the R Plumber endpoint
      // expects JSON strings for `data` and `parameters`.
      JSON.stringify({
        data: JSON.stringify(data),
        parameters: JSON.stringify(parametersWithBudget),
      }),
      startedAt + FETCH_TIMEOUT_MS,
      inputHash,
    );

    if (!response.ok) {
      await finish("failed", {
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
      await finish("failed", {
        startedAt,
        errorMessage: "R backend returned an unparseable response.",
      });
      return;
    }

    // The R endpoints return { data } on success or { error, message } on
    // failure (both HTTP 200). Since #526 a failed run also carries a
    // structured `code` ("timeout", "worker_died"); when present it decides
    // the terminal status, with the message regex kept as a fallback for
    // payloads without one.
    if (parsed.error) {
      const messageText = parsed.message ?? "Analysis failed.";
      const errorCode =
        typeof parsed.code === "string" && parsed.code ? parsed.code : undefined;
      const status: TerminalStatus = errorCode
        ? errorCode === "timeout"
          ? "timedout"
          : "failed"
        : /timed out|timeout/i.test(messageText)
          ? "timedout"
          : "failed";
      await finish(status, { startedAt, errorMessage: messageText, errorCode });
      return;
    }

    await finish("succeeded", {
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
    await finish(status, { startedAt, errorMessage: messageText });
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
  if (fields.errorCode !== undefined) {
    values[":errorCode"] = fields.errorCode;
    updateExpr += ", errorCode = :errorCode";
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

// -- Run record helpers (#529) ----------------------------------------------

function runRecordKey(inputHash: string): string {
  return `${RUN_RECORD_KEY_PREFIX}${inputHash}`;
}

async function getRunRecord(inputHash: string): Promise<RunRecord | undefined> {
  const { Item } = await ddb.send(
    new GetCommand({
      TableName: tableName,
      Key: { jobId: runRecordKey(inputHash) },
    }),
  );
  return Item as RunRecord | undefined;
}

/** Row count of the queued dataset, for the record's k field. */
function countRows(data: unknown): number | undefined {
  if (Array.isArray(data)) {
    return data.length;
  }
  if (typeof data === "string") {
    try {
      const parsed: unknown = JSON.parse(data);
      return Array.isArray(parsed) ? parsed.length : undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/** Upsert the record to `running`, increment the run counter and clear any
 * previous terminal fields. */
async function startRunRecord(
  inputHash: string,
  endpoint: string,
  jobId: string,
  message: QueueMessage,
  now: number,
): Promise<void> {
  const names: Record<string, string> = {
    "#inputHash": "inputHash",
    "#endpoint": "endpoint",
    "#status": "status",
    "#startedAt": "startedAt",
    "#sourceJobId": "sourceJobId",
    "#runCount": "runCount",
    "#ttl": "ttl",
    "#finishedAt": "finishedAt",
    "#runDurationMs": "runDurationMs",
    "#errorMessage": "errorMessage",
    "#errorCode": "errorCode",
  };
  const values: Record<string, unknown> = {
    ":inputHash": inputHash,
    ":endpoint": endpoint,
    ":running": "running",
    ":now": now,
    ":sourceJobId": jobId,
    ":zero": 0,
    ":one": 1,
    ":ttl": Math.floor(now / 1000) + RUN_RECORD_TTL_SECONDS,
  };
  let setExpr =
    "SET #inputHash = :inputHash, #endpoint = :endpoint, #status = :running, " +
    "#startedAt = :now, #sourceJobId = :sourceJobId, " +
    "#runCount = if_not_exists(#runCount, :zero) + :one, #ttl = :ttl";

  const k = countRows(message.data);
  if (typeof k === "number") {
    names["#k"] = "k";
    values[":k"] = k;
    setExpr += ", #k = :k";
  }
  const params = message.parameters;
  const method =
    params && typeof params === "object" && !Array.isArray(params)
      ? (params as Record<string, unknown>).maiveMethod
      : undefined;
  if (typeof method === "string" && method) {
    names["#method"] = "method";
    values[":method"] = method;
    setExpr += ", #method = :method";
  }
  if (message.modelType) {
    names["#modelType"] = "modelType";
    values[":modelType"] = message.modelType;
    setExpr += ", #modelType = :modelType";
  }

  await ddb.send(
    new UpdateCommand({
      TableName: tableName,
      Key: { jobId: runRecordKey(inputHash) },
      UpdateExpression: `${setExpr} REMOVE #finishedAt, #runDurationMs, #errorMessage, #errorCode`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
    }),
  );
}

/** Record one run's terminal outcome and refresh the 30 day TTL. */
async function finishRunRecord(
  inputHash: string,
  status: TerminalStatus,
  startedAt: number,
  errorMessage?: string,
  errorCode?: string,
): Promise<void> {
  const now = Date.now();
  const names: Record<string, string> = {
    "#status": "status",
    "#finishedAt": "finishedAt",
    "#runDurationMs": "runDurationMs",
    "#ttl": "ttl",
    "#errorMessage": "errorMessage",
    "#errorCode": "errorCode",
  };
  const values: Record<string, unknown> = {
    ":status": status,
    ":finishedAt": now,
    ":runDurationMs": now - startedAt,
    ":ttl": Math.floor(now / 1000) + RUN_RECORD_TTL_SECONDS,
  };
  let expr =
    "SET #status = :status, #finishedAt = :finishedAt, " +
    "#runDurationMs = :runDurationMs, #ttl = :ttl";
  const removes: string[] = [];
  if (errorMessage) {
    values[":errorMessage"] = errorMessage;
    expr += ", #errorMessage = :errorMessage";
  } else {
    removes.push("#errorMessage");
  }
  if (errorCode) {
    values[":errorCode"] = errorCode;
    expr += ", #errorCode = :errorCode";
  } else {
    removes.push("#errorCode");
  }
  if (removes.length > 0) {
    expr += ` REMOVE ${removes.join(", ")}`;
  }

  await ddb.send(
    new UpdateCommand({
      TableName: tableName,
      Key: { jobId: runRecordKey(inputHash) },
      UpdateExpression: expr,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
    }),
  );
}

/** Count a deduplicated submission on the record (atomic, race-safe). */
async function recordDedupHit(inputHash: string): Promise<void> {
  await ddb.send(
    new UpdateCommand({
      TableName: tableName,
      Key: { jobId: runRecordKey(inputHash) },
      UpdateExpression:
        "SET #dedupHits = if_not_exists(#dedupHits, :zero) + :one, " +
        "#lastDedupAt = :now",
      ExpressionAttributeNames: {
        "#dedupHits": "dedupHits",
        "#lastDedupAt": "lastDedupAt",
      },
      ExpressionAttributeValues: { ":zero": 0, ":one": 1, ":now": Date.now() },
    }),
  );
}

/** Full result of a terminal async job, for copying to a deduplicated job. */
async function fetchJobResult(
  sourceJobId: string | undefined,
): Promise<string | undefined> {
  if (!sourceJobId || sourceJobId === "sync") {
    return undefined;
  }
  const { Item } = await ddb.send(
    new GetCommand({
      TableName: tableName,
      Key: { jobId: sourceJobId },
      ProjectionExpression: "#result",
      ExpressionAttributeNames: { "#result": "result" },
    }),
  );
  const result = Item?.result;
  return typeof result === "string" ? result : undefined;
}

/**
 * Answer this job from an existing record for the identical input, if the
 * record allows it (#529). Dedup applies when the identical input is already
 * running (wait for it, then copy its outcome) or recently timed out (replay
 * the timeout error immediately); succeeded, failed and stale-running records
 * do not dedup, so an explicit user retry still runs.
 * @returns true when the job was resolved without running the analysis
 */
async function tryDedup(
  jobId: string,
  inputHash: string,
  startedAt: number,
): Promise<boolean> {
  const record = await getRunRecord(inputHash);
  if (!record) {
    return false;
  }
  const now = Date.now();

  if (
    record.status === "timedout" &&
    typeof record.finishedAt === "number" &&
    now - record.finishedAt <= TIMEOUT_REUSE_MS
  ) {
    await recordDedupHit(inputHash);
    const message = record.errorMessage ?? DEDUP_TIMEOUT_FALLBACK_MESSAGE;
    await markTerminal(jobId, "timedout", {
      startedAt,
      errorMessage: `${message}${DEDUP_REPLAY_SUFFIX}`,
      errorCode: record.errorCode,
    });
    return true;
  }

  const isFreshRunning =
    record.status === "running" &&
    typeof record.startedAt === "number" &&
    now - record.startedAt <= RUNNING_FRESH_MS;
  if (!isFreshRunning) {
    return false;
  }

  // An identical run is in flight: wait for its outcome instead of doubling
  // the compute. Polling the record is a cheap DynamoDB read every 15s.
  await recordDedupHit(inputHash);
  const deadline = startedAt + FETCH_TIMEOUT_MS;
  while (Date.now() + DEDUP_POLL_MS < deadline) {
    // eslint-disable-next-line no-await-in-loop
    await sleep(DEDUP_POLL_MS);
    // eslint-disable-next-line no-await-in-loop
    const current = await getRunRecord(inputHash);
    if (!current || current.status === "running") {
      continue;
    }
    if (current.status === "succeeded") {
      // eslint-disable-next-line no-await-in-loop
      const result = await fetchJobResult(current.sourceJobId);
      if (result === undefined) {
        return false; // nothing to copy (e.g. a sync run); run it for real
      }
      await markTerminal(jobId, "succeeded", { startedAt, result });
      return true;
    }
    const message = current.errorMessage ?? DEDUP_TIMEOUT_FALLBACK_MESSAGE;
    await markTerminal(jobId, current.status, {
      startedAt,
      errorMessage: `${message}${DEDUP_REPLAY_SUFFIX}`,
      errorCode: current.errorCode,
    });
    return true;
  }

  await markTerminal(jobId, "timedout", {
    startedAt,
    errorMessage: DEDUP_WAIT_EXHAUSTED_MESSAGE,
  });
  return true;
}
