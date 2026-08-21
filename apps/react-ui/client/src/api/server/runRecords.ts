/* eslint-disable @typescript-eslint/naming-convention -- DynamoDB expression
 * placeholders (#name, :value) are not identifiers. */
import { createHash } from "crypto";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

// Persistent per-input run records and dedup (#529).
//
// The maive-runs table used to hold only async job items with a 48h TTL, so
// after an incident (Aug 15: one heavy job resubmitted for hours) there was
// nothing durable to look at. Every model run now upserts a record item keyed
// by a hash of its input, carrying k, method, outcome, duration, timestamps
// and a run counter, with a 30 day TTL. The same record is the dedup lookup:
// an identical input that is already running or recently timed out is answered
// from the record instead of recomputed.
//
// Record items share the runs table, keyed `jobId = "input#<sha256>"`; the
// prefix cannot collide with real job ids (UUID/ULID shaped). Writers use
// UpdateItem upserts so the run counter increments atomically.
//
// Keep the hashing and record semantics in sync with the orchestrator's copy
// in apps/orchestrator/src/index.ts.

export const RUN_RECORD_KEY_PREFIX = "input#";
export const RUN_RECORD_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

// A `running` record older than this is treated as stale (its writer died
// before recording an outcome). Chosen above the R backend's maximum request
// budget (570s) plus orchestrator margin, so a live run is never mistaken for
// a dead one.
export const RUNNING_FRESH_MS = 700_000;

// How long a recorded timeout is replayed to identical resubmissions. Long
// enough to absorb an Aug 15 style resubmit-for-hours loop, short enough that
// a legitimate retry after backend fixes is not blocked for days.
export const TIMEOUT_REUSE_MS = 6 * 60 * 60 * 1000;

export const DEDUP_RUNNING_MESSAGE =
  "An identical analysis is already running. Please wait for it to finish instead of resubmitting.";

export const DEDUP_TIMEOUT_FALLBACK_MESSAGE =
  "An identical analysis recently timed out. Please adjust the dataset or parameters before retrying.";

// Suffix appended to replayed error messages so a user (or an incident
// responder reading the table) can tell a replay from a fresh run.
export const DEDUP_REPLAY_SUFFIX = " (reused from an identical earlier run)";

export type RunRecordStatus = "running" | "succeeded" | "failed" | "timedout";

export type RunRecord = {
  jobId: string; // table PK: "input#<hash>"
  inputHash: string;
  endpoint: string;
  status: RunRecordStatus;
  k?: number;
  method?: string;
  modelType?: string;
  sourceJobId?: string; // async job id that ran it, or "sync"
  startedAt?: number;
  finishedAt?: number;
  runDurationMs?: number;
  errorMessage?: string;
  errorCode?: string;
  runCount?: number;
  dedupHits?: number;
  ttl?: number;
};

// Locale-independent key ordering, so hashes are stable across runtimes.
const compareKeys = (a: string, b: string): number => {
  if (a < b) {
    return -1;
  }
  if (a > b) {
    return 1;
  }
  return 0;
};

/** JSON.stringify with object keys sorted at every level, so logically equal
 * parameter objects hash identically regardless of key order. */
export const stableStringify = (value: unknown): string => {
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
};

/**
 * Hash one run's input: endpoint, dataset and parameters. `timeoutSeconds` is
 * excluded from the parameters because the orchestrator injects a background
 * budget (#526); with it excluded, the same logical input hashes identically
 * whether it ran synchronously or through the queue.
 * @param endpoint - R backend route, e.g. "/run-model"
 * @param data - Dataset as the JSON string the R backend receives, or the
 *   still-unserialized value on the async path
 * @param parameters - Parameters object or its JSON string
 */
export const computeInputHash = (
  endpoint: string,
  data: unknown,
  parameters: unknown,
): string => {
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
    const { timeoutSeconds: timeoutIgnored, ...rest } = params as Record<
      string,
      unknown
    >;
    void timeoutIgnored;
    params = rest;
  }
  return createHash("sha256")
    .update(`${endpoint}\n${dataString}\n${stableStringify(params ?? null)}`)
    .digest("hex");
};

export type DedupDecision =
  | { kind: "running" }
  | { kind: "timedout"; errorMessage: string; errorCode?: string };

/**
 * Decide whether an existing record answers a new identical submission.
 * Running (and fresh) or recently timed out dedup; everything else (succeeded,
 * failed, stale running) runs normally, since a user retrying after a failure
 * or wanting a fresh result is legitimate.
 * @param record - The existing record for this input hash, if any
 * @param now - Current epoch ms
 */
export const classifyDedup = (
  record: RunRecord | undefined,
  now: number,
): DedupDecision | undefined => {
  if (!record) {
    return undefined;
  }
  if (
    record.status === "running" &&
    typeof record.startedAt === "number" &&
    now - record.startedAt <= RUNNING_FRESH_MS
  ) {
    return { kind: "running" };
  }
  if (
    record.status === "timedout" &&
    typeof record.finishedAt === "number" &&
    now - record.finishedAt <= TIMEOUT_REUSE_MS
  ) {
    return {
      kind: "timedout",
      errorMessage: record.errorMessage ?? DEDUP_TIMEOUT_FALLBACK_MESSAGE,
      errorCode: record.errorCode,
    };
  }
  return undefined;
};

export const getRunRecord = async (
  ddb: DynamoDBDocumentClient,
  tableName: string,
  inputHash: string,
): Promise<RunRecord | undefined> => {
  const { Item } = await ddb.send(
    new GetCommand({
      TableName: tableName,
      Key: { jobId: `${RUN_RECORD_KEY_PREFIX}${inputHash}` },
    }),
  );
  return Item as RunRecord | undefined;
};

export type StartRunRecordParams = {
  inputHash: string;
  endpoint: string;
  sourceJobId: string;
  k?: number;
  method?: string;
  modelType?: string;
};

/** Upsert the record to `running`, increment the run counter and clear any
 * previous terminal fields. */
export const startRunRecord = async (
  ddb: DynamoDBDocumentClient,
  tableName: string,
  params: StartRunRecordParams,
  now: number = Date.now(),
): Promise<void> => {
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
    ":inputHash": params.inputHash,
    ":endpoint": params.endpoint,
    ":running": "running",
    ":now": now,
    ":sourceJobId": params.sourceJobId,
    ":zero": 0,
    ":one": 1,
    ":ttl": Math.floor(now / 1000) + RUN_RECORD_TTL_SECONDS,
  };
  let setExpr =
    "SET #inputHash = :inputHash, #endpoint = :endpoint, #status = :running, " +
    "#startedAt = :now, #sourceJobId = :sourceJobId, " +
    "#runCount = if_not_exists(#runCount, :zero) + :one, #ttl = :ttl";

  if (typeof params.k === "number" && Number.isFinite(params.k)) {
    names["#k"] = "k";
    values[":k"] = params.k;
    setExpr += ", #k = :k";
  }
  if (params.method) {
    names["#method"] = "method";
    values[":method"] = params.method;
    setExpr += ", #method = :method";
  }
  if (params.modelType) {
    names["#modelType"] = "modelType";
    values[":modelType"] = params.modelType;
    setExpr += ", #modelType = :modelType";
  }

  await ddb.send(
    new UpdateCommand({
      TableName: tableName,
      Key: { jobId: `${RUN_RECORD_KEY_PREFIX}${params.inputHash}` },
      UpdateExpression: `${setExpr} REMOVE #finishedAt, #runDurationMs, #errorMessage, #errorCode`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
    }),
  );
};

export type FinishRunRecordParams = {
  inputHash: string;
  status: Exclude<RunRecordStatus, "running">;
  startedAt: number;
  errorMessage?: string;
  errorCode?: string;
};

/** Record one run's terminal outcome and refresh the 30 day TTL. */
export const finishRunRecord = async (
  ddb: DynamoDBDocumentClient,
  tableName: string,
  params: FinishRunRecordParams,
  now: number = Date.now(),
): Promise<void> => {
  const names: Record<string, string> = {
    "#status": "status",
    "#finishedAt": "finishedAt",
    "#runDurationMs": "runDurationMs",
    "#ttl": "ttl",
    "#errorMessage": "errorMessage",
    "#errorCode": "errorCode",
  };
  const values: Record<string, unknown> = {
    ":status": params.status,
    ":finishedAt": now,
    ":runDurationMs": now - params.startedAt,
    ":ttl": Math.floor(now / 1000) + RUN_RECORD_TTL_SECONDS,
  };
  let expr =
    "SET #status = :status, #finishedAt = :finishedAt, " +
    "#runDurationMs = :runDurationMs, #ttl = :ttl";
  const removes: string[] = [];
  if (params.errorMessage) {
    values[":errorMessage"] = params.errorMessage;
    expr += ", #errorMessage = :errorMessage";
  } else {
    removes.push("#errorMessage");
  }
  if (params.errorCode) {
    values[":errorCode"] = params.errorCode;
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
      Key: { jobId: `${RUN_RECORD_KEY_PREFIX}${params.inputHash}` },
      UpdateExpression: expr,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
    }),
  );
};

/** Count a deduplicated submission on the record (atomic, race-safe). */
export const recordDedupHit = async (
  ddb: DynamoDBDocumentClient,
  tableName: string,
  inputHash: string,
  now: number = Date.now(),
): Promise<void> => {
  await ddb.send(
    new UpdateCommand({
      TableName: tableName,
      Key: { jobId: `${RUN_RECORD_KEY_PREFIX}${inputHash}` },
      UpdateExpression:
        "SET #dedupHits = if_not_exists(#dedupHits, :zero) + :one, " +
        "#lastDedupAt = :now",
      ExpressionAttributeNames: {
        "#dedupHits": "dedupHits",
        "#lastDedupAt": "lastDedupAt",
      },
      ExpressionAttributeValues: { ":zero": 0, ":one": 1, ":now": now },
    }),
  );
};

/** Row count of a legacy-contract dataset JSON string, for the k field. */
export const countRowsFromJson = (data: unknown): number | undefined => {
  if (typeof data !== "string") {
    return Array.isArray(data) ? data.length : undefined;
  }
  try {
    const parsed: unknown = JSON.parse(data);
    return Array.isArray(parsed) ? parsed.length : undefined;
  } catch {
    return undefined;
  }
};

/** maiveMethod from a parameters object or its JSON string. */
export const methodFromParameters = (
  parameters: unknown,
): string | undefined => {
  let params: unknown = parameters;
  if (typeof params === "string") {
    try {
      params = JSON.parse(params);
    } catch {
      return undefined;
    }
  }
  if (params && typeof params === "object" && !Array.isArray(params)) {
    const method = (params as Record<string, unknown>).maiveMethod;
    return typeof method === "string" && method ? method : undefined;
  }
  return undefined;
};

/** modelType from a parameters object or its JSON string. */
export const modelTypeFromParameters = (
  parameters: unknown,
): string | undefined => {
  let params: unknown = parameters;
  if (typeof params === "string") {
    try {
      params = JSON.parse(params);
    } catch {
      return undefined;
    }
  }
  if (params && typeof params === "object" && !Array.isArray(params)) {
    const modelType = (params as Record<string, unknown>).modelType;
    return typeof modelType === "string" && modelType ? modelType : undefined;
  }
  return undefined;
};
