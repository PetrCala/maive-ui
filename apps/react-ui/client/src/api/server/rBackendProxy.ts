import { Sha256 } from "@aws-crypto/sha256-js";
import { HttpRequest } from "@smithy/protocol-http";
import { SignatureV4 } from "@smithy/signature-v4";
import type { NextApiRequest, NextApiResponse } from "next";
import { getRApiUrl } from "@api/utils/config";
import { getRunsStoreConfig } from "@api/server/runsService";
import { resolveRunParameters } from "@api/server/modelParameterDefaults";
import type { ResolvedParameters, RTMAParameters } from "@src/types/api";
import {
  DEDUP_REPLAY_SUFFIX,
  DEDUP_RUNNING_MESSAGE,
  classifyDedup,
  computeInputHash,
  countRowsFromJson,
  finishRunRecord,
  getRunRecord,
  methodFromParameters,
  modelTypeFromParameters,
  recordDedupHit,
  startRunRecord,
} from "@api/server/runRecords";

// Server-only proxy to the R backend. The Function URL requires IAM auth
// (#530), so every request from the Next.js server is SigV4-signed with the
// UI Lambda's execution-role credentials; the browser never talks to the
// compute endpoint directly. Local development targets (localhost, containers)
// are not Function URLs and are called unsigned.

// Upstream budget for a proxied call. Slightly below the UI Lambda timeout
// (ui_lambda_timeout, 180 s) so the route returns a clean 504 instead of the
// Lambda being killed mid-response. The R backend bounds its own work via
// timeoutSeconds (request_bounds.R), independently of this fetch budget.
export const PROXY_FETCH_TIMEOUT_MS = 170_000;

const FUNCTION_URL_SUFFIX = ".on.aws";

function isFunctionUrlHost(hostname: string): boolean {
  return hostname.endsWith(FUNCTION_URL_SUFFIX);
}

/** Region from `<id>.lambda-url.<region>.on.aws`, else the runtime's region. */
function resolveRegion(hostname: string): string {
  const parts = hostname.split(".");
  const lambdaUrlIndex = parts.indexOf("lambda-url");
  if (lambdaUrlIndex !== -1 && parts.length > lambdaUrlIndex + 1) {
    return parts[lambdaUrlIndex + 1];
  }
  return process.env.AWS_REGION ?? "eu-central-1";
}

/**
 * Fetch from the R backend, SigV4-signing the request when the target is a
 * Lambda Function URL. Signing credentials come from the Lambda runtime
 * environment (the execution role's temporary keys).
 * @param path - R backend path, e.g. "/run-model"
 * @param init - Method, JSON body and abort signal for the upstream call
 */
export async function signedRFetch(
  path: string,
  init: {
    method: string;
    body?: string;
    signal?: AbortSignal;
    headers?: Record<string, string>;
  },
): Promise<Response> {
  const url = new URL(`${getRApiUrl()}${path}`);
  const headers: Record<string, string> = {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    "content-type": "application/json",
    ...(init.headers ?? {}),
  };

  if (!isFunctionUrlHost(url.hostname)) {
    return fetch(url, {
      method: init.method,
      headers,
      body: init.body,
      signal: init.signal,
    });
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
    region: resolveRegion(url.hostname),
    credentials: {
      accessKeyId,
      secretAccessKey,
      sessionToken: process.env.AWS_SESSION_TOKEN,
    },
    sha256: Sha256,
  });

  const signed = await signer.sign(
    new HttpRequest({
      method: init.method,
      protocol: url.protocol,
      hostname: url.hostname,
      path: url.pathname,
      headers: { ...headers, host: url.hostname },
      body: init.body,
    }),
  );

  return fetch(url, {
    method: init.method,
    headers: signed.headers,
    body: init.body,
    signal: init.signal,
  });
}

export type RunOutcome = {
  status: "succeeded" | "failed" | "timedout";
  errorMessage?: string;
  errorCode?: string;
};

export type ProxyRunOptions = {
  // Forwarded to the R backend as x-maive-input-hash so its structured
  // request log line (#532) can be joined with the run record (#529).
  inputHash?: string;
  // Body to forward instead of req.body, e.g. the request with its
  // parameters replaced by the resolved ones (#555).
  body?: unknown;
  // Fields merged into a successful JSON response body (#555). Applied only
  // when the upstream status is 2xx and, for the legacy envelope, the body is
  // not an error payload; anything else is relayed verbatim.
  decorateSuccess?: Record<string, unknown>;
  // Called with the classified terminal outcome before the response is
  // relayed. Errors thrown here are swallowed: recording must never break
  // the run.
  onOutcome?: (outcome: RunOutcome) => Promise<void>;
};

/** Classify a legacy-contract upstream response into a run outcome. The R
 * endpoints return { data } on success or { error, message } on failure,
 * both HTTP 200; non-200s are proxy or platform failures. Since #526 a failed
 * run also carries a structured `code` ("timeout", "worker_died"); when
 * present it decides the outcome, with the message regex kept as a fallback
 * for payloads without one. */
function classifyLegacyOutcome(status: number, text: string): RunOutcome {
  if (status < 200 || status >= 300) {
    return {
      status: "failed",
      errorMessage: `R backend returned HTTP ${status}`,
    };
  }
  try {
    const parsed = JSON.parse(text) as {
      error?: unknown;
      code?: unknown;
      message?: unknown;
    };
    if (parsed.error) {
      const message =
        typeof parsed.message === "string" && parsed.message
          ? parsed.message
          : "Analysis failed.";
      const errorCode =
        typeof parsed.code === "string" && parsed.code
          ? parsed.code
          : undefined;
      const timedout = errorCode
        ? errorCode === "timeout"
        : /timed out|timeout/i.test(message);
      return {
        status: timedout ? "timedout" : "failed",
        errorMessage: message,
        errorCode,
      };
    }
    return { status: "succeeded" };
  } catch {
    return {
      status: "failed",
      errorMessage: "R backend returned an unparseable response.",
    };
  }
}

/** Merge extra fields into a JSON object body; relay anything else as is. */
function decorateJson(text: string, extra: Record<string, unknown>): string {
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return text;
    }
    return JSON.stringify({ ...(parsed as Record<string, unknown>), ...extra });
  } catch {
    return text;
  }
}

/**
 * For an RTMA run the seed that actually ran is the one the backend reports;
 * a caller who left it out gets the backend default. Fill it into the echo so
 * `resolvedParameters` alone reproduces the run.
 * @param resolved - Parameters as resolved before the run
 * @param seed - Seed reported by the backend, when it reported one
 */
export function withReportedSeed(
  resolved: ResolvedParameters,
  seed: unknown,
): ResolvedParameters {
  if (resolved.modelType !== "RTMA" || typeof seed !== "number") {
    return resolved;
  }
  const rtma = resolved as RTMAParameters;
  return rtma.seed === undefined ? { ...rtma, seed } : rtma;
}

/**
 * Apply withReportedSeed to the `resolvedParameters` entry of a decoration,
 * when it has one.
 */
function withSeedFilled(
  extra: Record<string, unknown>,
  text: string,
): Record<string, unknown> {
  const resolved = extra.resolvedParameters as ResolvedParameters | undefined;
  if (!resolved) {
    return extra;
  }
  return {
    ...extra,
    resolvedParameters: withReportedSeed(resolved, reportedSeed(text)),
  };
}

/** Read the RTMA seed off a success payload, legacy `{ data }` or flat. */
function reportedSeed(text: string): unknown {
  try {
    const parsed = JSON.parse(text) as {
      seed?: unknown;
      data?: { seed?: unknown };
    };
    return parsed.seed ?? parsed.data?.seed;
  } catch {
    return undefined;
  }
}

async function notifyOutcome(
  options: ProxyRunOptions | undefined,
  outcome: RunOutcome,
): Promise<void> {
  if (!options?.onOutcome) {
    return;
  }
  try {
    await options.onOutcome(outcome);
  } catch (error) {
    console.error("Failed to record run outcome", error);
  }
}

/**
 * Forward an API-route request to the R backend and relay the response
 * verbatim (status, content type and body), so both the legacy internal
 * contract and the /v1 contract pass through unchanged.
 * @param req - Incoming Next.js API request
 * @param res - Outgoing Next.js API response
 * @param path - R backend path to forward to, e.g. "/run-model"
 * @param envelope - Error shape for proxy-level failures: the legacy internal
 *   `{ error: true, message }` or the /v1 `{ error: { code, message } }`
 * @param options - Optional run-record integration (#529)
 */
export async function proxyToRBackend(
  req: NextApiRequest,
  res: NextApiResponse,
  path: string,
  envelope: "legacy" | "v1" = "legacy",
  options?: ProxyRunOptions,
): Promise<void> {
  const sendProxyError = (status: number, message: string) => {
    if (envelope === "v1") {
      res.status(status).json({ error: { code: "internal_error", message } });
      return;
    }
    res.status(status).json({ error: true, message });
  };

  try {
    const hasBody = req.method !== "GET" && req.method !== "HEAD";
    const upstream = await signedRFetch(path, {
      method: req.method ?? "GET",
      body: hasBody ? JSON.stringify(options?.body ?? req.body) : undefined,
      signal: AbortSignal.timeout(PROXY_FETCH_TIMEOUT_MS),
      headers: options?.inputHash
        ? // eslint-disable-next-line @typescript-eslint/naming-convention
          { "x-maive-input-hash": options.inputHash }
        : undefined,
    });
    const text = await upstream.text();
    const outcome = classifyLegacyOutcome(upstream.status, text);
    await notifyOutcome(options, outcome);
    res
      .status(upstream.status)
      .setHeader(
        "Content-Type",
        upstream.headers.get("content-type") ?? "application/json",
      )
      .send(
        options?.decorateSuccess && outcome.status === "succeeded"
          ? decorateJson(text, withSeedFilled(options.decorateSuccess, text))
          : text,
      );
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      await notifyOutcome(options, {
        status: "timedout",
        errorMessage: "The analysis request timed out at the proxy.",
      });
      sendProxyError(504, "The analysis request timed out at the proxy.");
      return;
    }
    console.error(`Failed to proxy ${path} to the R backend`, error);
    await notifyOutcome(options, {
      status: "failed",
      errorMessage: "Failed to reach the analysis backend.",
    });
    sendProxyError(502, "Failed to reach the analysis backend.");
  }
}

/**
 * Synchronous model run with the run-record layer (#529) wrapped around the
 * plain proxy: dedup identical in-flight or recently timed out inputs, then
 * persist one record (input hash, k, method, outcome, duration, timestamps)
 * per executed run. Recording is strictly best effort; when the runs table is
 * not configured or any record operation fails, the request degrades to the
 * plain proxy behavior.
 * @param req - Incoming Next.js API request (legacy contract body)
 * @param res - Outgoing Next.js API response
 * @param path - R backend path, "/run-model", "/run-rtma" or "/run-rdt"
 */
// The legacy body carries exactly two fields; a parameter name beside them
// (`{"modelType": "WLS", "data": "...", "parameters": "..."}`) would be
// ignored and must not be (#574).
const LEGACY_TOP_LEVEL_KEYS = ["data", "parameters"] as const;

export async function proxyModelRun(
  req: NextApiRequest,
  res: NextApiResponse,
  path: string,
): Promise<void> {
  const body = (req.body ?? {}) as { data?: unknown; parameters?: unknown };

  // Resolve the parameters before anything else (#555): the browser sends
  // JSON strings, so parse them, run the shared resolver in strict mode, and
  // forward the fully resolved parameters. A key the contract does not know
  // or a conflicting value is a 400, never a silently different analysis.
  const parsedData = parseJsonString(body.data);
  const parsedParameters = parseJsonString(body.parameters);
  const { resolved, error: resolutionError } = resolveRunParameters(
    undefined,
    parsedParameters ?? body.parameters,
    {
      data: parsedData,
      family:
        path === "/run-rtma" ? "rtma" : path === "/run-rdt" ? "rdt" : "maive",
      body: req.body,
      acceptedTopLevelKeys: LEGACY_TOP_LEVEL_KEYS,
    },
  );
  if (resolutionError) {
    res.status(400).json({
      error: true,
      code: "validation_error",
      message: resolutionError.message,
    });
    return;
  }
  const forwardedBody = {
    ...(req.body as Record<string, unknown>),
    parameters: JSON.stringify(resolved.parameters),
  };
  const decorateSuccess = {
    resolvedParameters: resolved.parameters,
    recipe: resolved.recipe,
  };

  const store = getRunsStoreConfig();
  if (!store || typeof body.data !== "string") {
    return proxyToRBackend(req, res, path, "legacy", {
      body: forwardedBody,
      decorateSuccess,
    });
  }

  let inputHash: string | undefined;
  try {
    const hash = computeInputHash(path, body.data, resolved.parameters);
    inputHash = hash;
    const existing = await getRunRecord(store.ddb, store.tableName, hash);
    const dedup = classifyDedup(existing, Date.now());
    if (dedup) {
      console.log(
        JSON.stringify({
          event: "runDedupHit",
          endpoint: path,
          inputHash: hash,
          kind: dedup.kind,
        }),
      );
      await recordDedupHit(store.ddb, store.tableName, hash).catch((error) =>
        console.error("Failed to record dedup hit", error),
      );
      if (dedup.kind === "running") {
        res.status(200).json({ error: true, message: DEDUP_RUNNING_MESSAGE });
        return;
      }
      // Replay the recorded outcome, keeping its structured code so the
      // client treats the replay exactly like the original timeout.
      res.status(200).json({
        error: true,
        message: `${dedup.errorMessage}${DEDUP_REPLAY_SUFFIX}`,
        ...(dedup.errorCode ? { code: dedup.errorCode } : {}),
      });
      return;
    }

    const startedAt = Date.now();
    await startRunRecord(store.ddb, store.tableName, {
      inputHash: hash,
      endpoint: path,
      sourceJobId: "sync",
      k: countRowsFromJson(body.data),
      method: methodFromParameters(resolved.parameters),
      modelType: modelTypeFromParameters(resolved.parameters),
    });

    return await proxyToRBackend(req, res, path, "legacy", {
      inputHash: hash,
      body: forwardedBody,
      decorateSuccess,
      onOutcome: (outcome) =>
        finishRunRecord(store.ddb, store.tableName, {
          inputHash: hash,
          status: outcome.status,
          startedAt,
          errorMessage: outcome.errorMessage,
          errorCode: outcome.errorCode,
        }),
    });
  } catch (error) {
    console.error("Run record layer failed; proxying without it", error);
    return proxyToRBackend(req, res, path, "legacy", {
      ...(inputHash ? { inputHash } : {}),
      body: forwardedBody,
      decorateSuccess,
    });
  }
}

/** Parse a JSON string field; non-strings and unparseable input give undefined. */
function parseJsonString(value: unknown): unknown {
  if (typeof value !== "string") {
    return undefined;
  }
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return undefined;
  }
}
