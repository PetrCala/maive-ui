// ui-origin-proxy: fronts the Next.js UI on maive.eu and www.maive.eu.
//
// Lambda Function URLs reject a foreign Host header, so the request is
// re-issued as a subrequest to the .on.aws origin with Host/SNI rewritten.
// See docs/SERVER_SIDE_API_ARCHITECTURE.md.
//
// NOTE: this file was recovered from the deployed worker (created 2026-06-04,
// originally configured by hand in the Cloudflare dashboard) and committed here
// so the edge is reviewable in-repo. It is reproduced verbatim; if you change
// it, redeploy with infra/cloudflare/deploy-worker.sh and keep this file in
// sync.

export default {
  async fetch(request) {
    const ORIGIN = "zekrvvwo2u3fcbmvzlkozy56du0jqwdu.lambda-url.eu-central-1.on.aws";
    const url = new URL(request.url);
    url.hostname = ORIGIN;
    const headers = new Headers(request.headers);
    headers.set("host", ORIGIN);
    return fetch(url, {
      method: request.method,
      headers,
      body: request.body,
      redirect: "manual",
    });
  },
};
