import { Sha256 } from "@aws-crypto/sha256-js";
import { HttpRequest } from "@smithy/protocol-http";
import { SignatureV4 } from "@smithy/signature-v4";
import type { NextApiRequest, NextApiResponse } from "next";
import { getRApiUrl } from "@api/utils/config";

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
  init: { method: string; body?: string; signal?: AbortSignal },
): Promise<Response> {
  const url = new URL(`${getRApiUrl()}${path}`);
  const headers: Record<string, string> = {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    "content-type": "application/json",
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

/**
 * Forward an API-route request to the R backend and relay the response
 * verbatim (status, content type and body), so both the legacy internal
 * contract and the /v1 contract pass through unchanged.
 * @param req - Incoming Next.js API request
 * @param res - Outgoing Next.js API response
 * @param path - R backend path to forward to, e.g. "/run-model"
 * @param envelope - Error shape for proxy-level failures: the legacy internal
 *   `{ error: true, message }` or the /v1 `{ error: { code, message } }`
 */
export async function proxyToRBackend(
  req: NextApiRequest,
  res: NextApiResponse,
  path: string,
  envelope: "legacy" | "v1" = "legacy",
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
    });
    const text = await upstream.text();
    res
      .status(upstream.status)
      .setHeader(
        "Content-Type",
        upstream.headers.get("content-type") ?? "application/json",
      )
      .send(text);
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      sendProxyError(504, "The analysis request timed out at the proxy.");
      return;
    }
    console.error(`Failed to proxy ${path} to the R backend`, error);
    sendProxyError(502, "Failed to reach the analysis backend.");
  }
}
