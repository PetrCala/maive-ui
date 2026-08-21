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
// Any other path returns 404. Only the documented /v1 endpoints are exposed, so
// the internal R routes (/run-model, /run-rtma, /echo, /ping) stay off the
// public hostname.

const UI_ORIGIN = "zekrvvwo2u3fcbmvzlkozy56du0jqwdu.lambda-url.eu-central-1.on.aws";

const SYNC_PATHS = new Set(["/v1/run-model", "/v1/run-rtma", "/v1/health"]);

function notFound() {
  const body = {
    error: {
      code: "not_found",
      message:
        "Unknown endpoint. Available: /v1/run-model, /v1/run-rtma, /v1/runs, /v1/runs/{jobId}, /v1/health.",
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
    if (!isRuns && !SYNC_PATHS.has(path)) {
      return notFound();
    }

    url.pathname = "/api" + path;
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
