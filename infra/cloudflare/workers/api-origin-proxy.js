// api-origin-proxy: fronts the public MAIVE API on api.maive.eu.
// See docs/PUBLIC_API_DESIGN.md (section 5) and docs/api/openapi.yaml.
//
// Lambda Function URLs reject a foreign Host header, so each request is
// re-issued as a subrequest to the .on.aws origin with Host/SNI rewritten
// (same approach as the ui-origin-proxy worker).
//
// Routing:
//   /v1/runs, /v1/runs/*                    -> UI Lambda (async submit/poll).
//                                              Next.js serves these under
//                                              /api/v1/runs, so the path is
//                                              rewritten; the public contract
//                                              keeps the /v1/runs form.
//   /v1/run-model, /v1/run-rtma, /v1/health -> R Lambda (sync; paths match 1:1).
//
// Any other path returns 404. Only the documented /v1 endpoints are exposed, so
// the legacy internal routes (/run-model, /run-rtma, /echo, /ping) stay off the
// public hostname even though they exist on the R origin.

const R_ORIGIN = "5jvqw3f3wnogn24sb3tfpg2wqy0htdys.lambda-url.eu-central-1.on.aws";
const UI_ORIGIN = "zekrvvwo2u3fcbmvzlkozy56du0jqwdu.lambda-url.eu-central-1.on.aws";

const R_PATHS = new Set(["/v1/run-model", "/v1/run-rtma", "/v1/health"]);

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

    let origin;
    if (path === "/v1/runs" || path.startsWith("/v1/runs/")) {
      origin = UI_ORIGIN;
      url.pathname = "/api" + path;
    } else if (R_PATHS.has(path)) {
      origin = R_ORIGIN;
      url.pathname = path;
    } else {
      return notFound();
    }

    url.hostname = origin;

    const headers = new Headers(request.headers);
    headers.set("host", origin);

    return fetch(url, {
      method: request.method,
      headers,
      body: request.body,
      redirect: "manual",
    });
  },
};
