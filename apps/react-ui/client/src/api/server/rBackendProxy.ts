import { Sha256 } from "@aws-crypto/sha256-js";
import { HttpRequest } from "@smithy/protocol-http";
import { SignatureV4 } from "@smithy/signature-v4";
import type { NextApiRequest, NextApiResponse } from "next";
import { getRApiUrl } from "@api/utils/config";
import { getRunsStoreConfig } from "@api/server/runsService";
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
      body: hasBody ? JSON.stringify(req.body) : undefined,
      signal: AbortSignal.timeout(PROXY_FETCH_TIMEOUT_MS),
      headers: options?.inputHash
        ? // eslint-disable-next-line @typescript-eslint/naming-convention
          { "x-maive-input-hash": options.inputHash }
        : undefined,
    });
    const text = await upstream.text();
    await notifyOutcome(options, classifyLegacyOutcome(upstream.status, text));
    res
      .status(upstream.status)
      .setHeader(
        "Content-Type",
        upstream.headers.get("content-type") ?? "application/json",
      )
      .send(text);
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
 * @param path - R backend path, "/run-model" or "/run-rtma"
 */
export async function proxyModelRun(
  req: NextApiRequest,
  res: NextApiResponse,
  path: string,
): Promise<void> {
  const store = getRunsStoreConfig();
  const body = (req.body ?? {}) as { data?: unknown; parameters?: unknown };
  if (!store || typeof body.data !== "string") {
    return proxyToRBackend(req, res, path);
  }

  let inputHash: string | undefined;
  try {
    const hash = computeInputHash(path, body.data, body.parameters);
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
      method: methodFromParameters(body.parameters),
      modelType: modelTypeFromParameters(body.parameters),
    });

    return await proxyToRBackend(req, res, path, "legacy", {
      inputHash: hash,
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
    return proxyToRBackend(
      req,
      res,
      path,
      "legacy",
      inputHash ? { inputHash } : undefined,
    );
  }
}
