import type { NextApiRequest, NextApiResponse } from "next";
import { sendApiError } from "@api/server/errorEnvelope";
import { proxyToRBackend } from "@api/server/rBackendProxy";
import { resolveRunParameters } from "@api/server/modelParameterDefaults";
import { V1_SYNC_TOP_LEVEL_KEYS } from "@src/lib/parameterResolver";

// Public /v1 synchronous endpoints (#530). The api.maive.eu worker used to
// route /v1/run-model, /v1/run-rtma and /v1/health straight to the R backend
// Function URL; with the Function URL behind IAM auth it now routes them here
// (as /api/v1/*) and this route signs and forwards to the R backend's own
// /v1 handlers, which keep owning data validation and the response contract.
//
// Parameters are resolved here first (#555): the shared resolver expands a
// named `recipe`, fills the data-dependent defaults, rejects unknown keys and
// conflicting values with a 400, and the fully resolved parameters are what
// the R backend receives. The 200 response is decorated with
// `resolvedParameters` and `recipe` so the caller can see exactly what ran.
// A key the body does not accept at the top level (a `modelType` beside
// `data` instead of inside `parameters`, #574) is a 400 as well.
//
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

type SyncEndpoint = {
  method: "GET" | "POST";
  family?: "maive" | "rtma";
};

const SYNC_ENDPOINTS: Record<string, SyncEndpoint> = {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  "run-model": { method: "POST", family: "maive" },
  // eslint-disable-next-line @typescript-eslint/naming-convention
  "run-rtma": { method: "POST", family: "rtma" },
  health: { method: "GET" },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { endpoint } = req.query;
  const name = Array.isArray(endpoint) ? endpoint.join("/") : endpoint;
  const spec = name ? SYNC_ENDPOINTS[name] : undefined;

  if (!spec) {
    return sendApiError(
      res,
      "not_found",
      "Unknown endpoint. Available: /v1/run-model, /v1/run-rtma, /v1/runs, /v1/runs/{jobId}, /v1/health.",
    );
  }
  if (req.method !== spec.method) {
    res.setHeader("Allow", spec.method);
    return sendApiError(
      res,
      "method_not_allowed",
      `Use ${spec.method} for /v1/${name}.`,
    );
  }
  if (!spec.family) {
    return proxyToRBackend(req, res, `/v1/${name}`, "v1");
  }

  const body =
    req.body && typeof req.body === "object" && !Array.isArray(req.body)
      ? (req.body as Record<string, unknown>)
      : {};
  const { resolved, error } = resolveRunParameters(undefined, body.parameters, {
    data: body.data,
    recipe: body.recipe,
    family: spec.family,
    body,
    acceptedTopLevelKeys: V1_SYNC_TOP_LEVEL_KEYS,
  });
  if (error) {
    return sendApiError(res, "validation_error", error.message);
  }

  // `recipe` is consumed here; the R handler sees only data and parameters.
  const { recipe: recipeIgnored, ...rest } = body;
  void recipeIgnored;
  return proxyToRBackend(req, res, `/v1/${name}`, "v1", {
    body: { ...rest, parameters: resolved.parameters },
    decorateSuccess: {
      resolvedParameters: resolved.parameters,
      recipe: resolved.recipe,
    },
  });
}
