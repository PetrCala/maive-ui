// ui-origin-proxy: fronts the Next.js UI on easymeta.org and www.easymeta.org,
// and 301-redirects the retired UI hostnames maive.eu and www.maive.eu there.
//
// Lambda Function URLs reject a foreign Host header, so the request is
// re-issued as a subrequest to the .on.aws origin with Host/SNI rewritten.
// See docs/SERVER_SIDE_API_ARCHITECTURE.md.
//
// Redirect (#571): easymeta.org is the canonical address, so the apex and www
// of maive.eu send the client there with path and query preserved, the same
// contract the spuriousprecision.com Redirect Rule implements. The redirect
// lives in the worker rather than in a dashboard Redirect Rule because the
// worker is deployable from this repo (deploy-worker.sh) while the API token
// cannot write redirect rulesets (see README.md). Only the two UI hostnames
// are matched, by exact name: api.maive.eu is served by api-origin-proxy and
// must keep answering the API, and every published example points at it.
//
// NOTE: this file was recovered from the deployed worker (created 2026-06-04,
// originally configured by hand in the Cloudflare dashboard) and committed here
// so the edge is reviewable in-repo. If you change it, redeploy with
// infra/cloudflare/deploy-worker.sh and keep this file in sync.

const ORIGIN = "zekrvvwo2u3fcbmvzlkozy56du0jqwdu.lambda-url.eu-central-1.on.aws";

// Retired UI hostnames, matched exactly. Never add api.maive.eu here.
const REDIRECT_HOSTS = new Set(["maive.eu", "www.maive.eu"]);

const CANONICAL_ORIGIN = "https://easymeta.org";

// The URL a request for `url` should be redirected to, or null when the host
// is not one of the retired UI hostnames. Exported for the node test.
export function redirectTarget(url) {
  const parsed = new URL(url);
  if (!REDIRECT_HOSTS.has(parsed.hostname.toLowerCase())) {
    return null;
  }
  return CANONICAL_ORIGIN + parsed.pathname + parsed.search;
}

export default {
  async fetch(request) {
    const target = redirectTarget(request.url);
    if (target !== null) {
      return Response.redirect(target, 301);
    }

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
