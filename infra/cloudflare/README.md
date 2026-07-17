# Cloudflare edge configuration

Cloudflare fronts the UI domains and the public API hostname. It is **not**
managed by Terraform (unlike everything under `terraform/`); it is configured
through the Cloudflare API/dashboard. This directory exists so the edge is at
least reviewable and reproducible in-repo rather than living only in the
Cloudflare account.

Keep this file in sync when you change anything at the edge.

## Why a Worker at all

Both origins are AWS Lambda **Function URLs**, which reject requests carrying a
foreign `Host` header. Cloudflare's standard proxy forwards the original `Host`
(overriding it at the origin is an Enterprise feature), so a plain proxied CNAME
to a Function URL returns errors/hangs. Each hostname therefore routes through a
Worker that re-issues the request as a subrequest to the `.on.aws` origin with
`Host`/SNI rewritten.

## Account / zone

| | |
|---|---|
| Account | `e3f44e904f9ace6427b6a47cb28a3917` (T.havranek@gmail.com's Account) |
| Zone | `maive.eu` (`921f07a73f48aa3e80ac2cead44f76ec`, Free plan) |

`spuriousprecision.com` is a separate zone; `easymeta.org` is GoDaddy
domain-forwarding, not a Cloudflare zone.

## Workers

| Script | Source | Routes |
|---|---|---|
| `ui-origin-proxy` | [`workers/ui-origin-proxy.js`](workers/ui-origin-proxy.js) | `maive.eu/*`, `www.maive.eu/*` |
| `api-origin-proxy` | [`workers/api-origin-proxy.js`](workers/api-origin-proxy.js) | `api.maive.eu/*` |

`api-origin-proxy` path-routes between the two Lambda origins and whitelists
only the documented `/v1` endpoints (everything else 404s, keeping the legacy
`/run-model`, `/echo`, `/ping` routes off the public hostname). See
[`docs/PUBLIC_API_DESIGN.md`](../../docs/PUBLIC_API_DESIGN.md) §5.

Origins (both public; the R URL is already exposed to browsers via
`/api/runtime-config`):

- R backend: `5jvqw3f3wnogn24sb3tfpg2wqy0htdys.lambda-url.eu-central-1.on.aws`
- UI: `zekrvvwo2u3fcbmvzlkozy56du0jqwdu.lambda-url.eu-central-1.on.aws`

If a Function URL is ever recreated, these hostnames change and both the Worker
sources and the DNS records below must be updated.

### Deploying a worker

```bash
# token needs Account:Workers Scripts:Edit on the account above
bash infra/cloudflare/deploy-worker.sh api-origin-proxy
```

## DNS (zone `maive.eu`)

| Record | Type | Content | Proxied |
|---|---|---|---|
| `maive.eu` | CNAME | UI Function URL host | yes |
| `www` | CNAME | UI Function URL host | yes |
| `api` | CNAME | UI Function URL host | yes |
| `*` | CNAME | UI Function URL host | yes |

The record **content for `api` is a placeholder**: the Worker route intercepts
the request and picks the origin per path, so the CNAME target is never used.
It exists only so the hostname resolves through Cloudflare without depending on
the `*` wildcard.

Note the wildcard means *any* subdomain resolves through Cloudflare. Subdomains
with no Worker route (e.g. `foo.maive.eu`) proxy straight to the UI Function
URL, which rejects the foreign Host, so they hang. Pre-existing; harmless, but
surprising if you hit it.

## Rate limiting

The zone is on the **Free** plan: exactly **one** rate-limiting rule, and the
window is locked to 10s. That single rule covers all three hostnames:

- Ruleset: `http_ratelimit` phase, `249833cdb85e4b6ebb17757de27bc98a`
- Rule: `ba0f0b4af0644677bbff97e336279f4f`
- Expression: `(http.host eq "maive.eu" or http.host eq "www.maive.eu" or http.host eq "api.maive.eu")`
- Action: `block`, 100 requests / 10s per `(ip.src, cf.colo.id)`, mitigation 10s

Because it is one shared rule, UI and API traffic count toward the same per-IP
budget. This is a speed bump, not the main defense: the real cost control is the
R Lambda's reserved concurrency (`lambda_r_backend_reserved_concurrency`, in
Terraform), per `PUBLIC_API_DESIGN.md` D2.

## Rollback

- **API hostname:** delete the `api.maive.eu/*` Worker route. `api.maive.eu`
  reverts to hanging (via the wildcard); the UI is unaffected.
- **UI:** the `maive.eu/*` and `www.maive.eu/*` routes are load-bearing; do not
  delete them without a plan.
