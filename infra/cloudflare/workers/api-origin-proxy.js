// api-origin-proxy: fronts the public MAIVE API on api.maive.eu.
// See docs/PUBLIC_API_DESIGN.md (section 5) and docs/api/openapi.yaml.
//
// Lambda Function URLs reject a foreign Host header, so each request is
// re-issued as a subrequest to the .on.aws origin with Host/SNI rewritten
// (same approach as the ui-origin-proxy worker).
//
// Routing: every documented /v1 endpoint goes to the UI Lambda under /api.
//   /v1/runs, /v1/runs/*                    -> async submit/poll routes.
//   /v1/run-model, /v1/run-rtma, /v1/health -> Next.js proxy routes that
//                                              SigV4-sign and forward to the
//                                              IAM-protected R backend
//                                              Function URL (#530). The R
//                                              origin is no longer reachable
//                                              without IAM auth, so nothing
//                                              routes to it from here.
//
// Discovery files (#555) are served from the UI app and mapped 1:1 here, so
// the contract is reachable from the API host itself:
//   /openapi.yaml -> the OpenAPI 3 spec (static copy of docs/api/openapi.yaml)
//   /llms.txt, /agent.md -> machine-readable guidance for AI assistants
//
// Any other path returns 404. Only the documented /v1 endpoints and the
// discovery files are exposed, so the internal R routes (/run-model,
// /run-rtma, /echo, /ping) stay off the public hostname.

const UI_ORIGIN = "zekrvvwo2u3fcbmvzlkozy56du0jqwdu.lambda-url.eu-central-1.on.aws";

const SYNC_PATHS = new Set(["/v1/run-model", "/v1/run-rtma", "/v1/health"]);

// Served by the UI app at the same path; no /api prefix.
const DISCOVERY_PATHS = new Set(["/openapi.yaml", "/llms.txt", "/agent.md"]);

function notFound() {
  const body = {
    error: {
      code: "not_found",
      message:
        "Unknown endpoint. Available: /v1/run-model, /v1/run-rtma, /v1/runs, /v1/runs/{jobId}, /v1/health, /openapi.yaml, /llms.txt, /agent.md.",
    },
  };
  return new Response(JSON.stringify(body), {
    status: 404,
    headers: { "content-type": "application/json" },
  });
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    const isRuns = path === "/v1/runs" || path.startsWith("/v1/runs/");
    const isDiscovery = DISCOVERY_PATHS.has(path);
    if (!isRuns && !SYNC_PATHS.has(path) && !isDiscovery) {
      return notFound();
    }

    url.pathname = isDiscovery ? path : "/api" + path;
    url.hostname = UI_ORIGIN;

    const headers = new Headers(request.headers);
    headers.set("host", UI_ORIGIN);

    return fetch(url, {
      method: request.method,
      headers,
      body: request.body,
      redirect: "manual",
    });
  },
};
