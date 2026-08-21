import type { NextApiRequest, NextApiResponse } from "next";
import { sendApiError } from "@api/server/errorEnvelope";
import { proxyToRBackend } from "@api/server/rBackendProxy";

// Public /v1 synchronous endpoints (#530). The api.maive.eu worker used to
// route /v1/run-model, /v1/run-rtma and /v1/health straight to the R backend
// Function URL; with the Function URL behind IAM auth it now routes them here
// (as /api/v1/*) and this route signs and forwards 1:1 to the R backend's own
// /v1 handlers, which keep owning validation and the response contract.
// /v1/runs* is handled by the specific routes, which take precedence over
// this catch-all.
export const config = {
  api: {
    bodyParser: {
      sizeLimit: "6mb",
    },
    responseLimit: false,
  },
};

const SYNC_ENDPOINTS: Record<string, "GET" | "POST"> = {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  "run-model": "POST",
  // eslint-disable-next-line @typescript-eslint/naming-convention
  "run-rtma": "POST",
  health: "GET",
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { endpoint } = req.query;
  const name = Array.isArray(endpoint) ? endpoint.join("/") : endpoint;
  const method = name ? SYNC_ENDPOINTS[name] : undefined;

  if (!method) {
    return sendApiError(
      res,
      "not_found",
      "Unknown endpoint. Available: /v1/run-model, /v1/run-rtma, /v1/runs, /v1/runs/{jobId}, /v1/health.",
    );
  }
  if (req.method !== method) {
    res.setHeader("Allow", method);
    return sendApiError(
      res,
      "method_not_allowed",
      `Use ${method} for /v1/${name}.`,
    );
  }
  return proxyToRBackend(req, res, `/v1/${name}`, "v1");
}
