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

The practical consequence: **a serving hostname needs both a proxied DNS record
and a Worker route.** DNS alone gives you a hostname that hangs rather than one
that fails loudly, which is easy to miss when adding a domain.

## Account / zones

| | |
|---|---|
| Account | `e3f44e904f9ace6427b6a47cb28a3917` (T.havranek@gmail.com's Account) |

| Zone | ID | Plan | Role |
|---|---|---|---|
| `maive.eu` | `921f07a73f48aa3e80ac2cead44f76ec` | Free | Infrastructure zone: serves the app, hosts `api.maive.eu`, and is the fallback front door |
| `spuriousprecision.com` | `104e1921be01913c74cc03e3d2bfda74` | Free | Serves the app; being turned into a redirect to `easymeta.org` |
| `easymeta.org` | `9cc1c18ae7cc9143320233d10fc78c87` | Free | **Canonical** address once migrated; zone created but still `initializing` |

All three zones sit in the same account and share the nameserver pair
`fonzie.ns.cloudflare.com` / `jessica.ns.cloudflare.com`.

### Status of the `easymeta.org` migration

As of 2026-08-12 the migration described in
[#487](https://github.com/PetrCala/maive-ui/issues/487) is **half done**. The
Cloudflare side is fully configured; the nameservers have **not** been flipped,
so `easymeta.org` still resolves to GoDaddy and 301s to
`https://www.spuriousprecision.com`.

Done (all reversible by deleting the zone):

- zone created, empty, with Cloudflare's DNS scan deliberately skipped so the
  GoDaddy forwarding A records were never imported;
- proxied apex and `www` CNAMEs at the UI Function URL;
- `easymeta.org/*` and `www.easymeta.org/*` routed to `ui-origin-proxy`;
- its own rate-limit rule, mirroring the other two zones;
- Always Use HTTPS on, matching the other two zones.

Not done: the GoDaddy nameserver flip, and the `spuriousprecision.com`
redirect that follows it.

See [Migrating `easymeta.org`](#migrating-easymetaorg) for the remaining steps
and the recorded pre-change state.

### API token scope

`deploy-worker.sh` and everything else here authenticate with a single scoped
token (`$CLOUDFLARE_API_TOKEN` or `~/.config/cloudflare/maive_token`). Its
actual scope, probed 2026-08-11, is narrower than "the account":

The token is the user token `dns-automation`, owned by the `cala.p@seznam.cz`
login. Its permissions are:

| Scope | Group | Level |
|---|---|---|
| Account | Workers Scripts | Edit |
| Zone | Zone | Read |
| Zone | DNS | Edit |
| Zone | Workers Routes | Edit |
| Zone | Zone WAF | Edit (this is what covers rate-limit rules) |

Account resources: both `Cala.p@seznam.cz's Account` and
`T.havranek@gmail.com's Account`. Zone resources: **all zones from
T.havranek@gmail.com's Account**.

Two things it deliberately cannot do, both worked around rather than granted:

- **Create a zone** (`com.cloudflare.api.account.zone.create`). Add sites in
  the dashboard instead; it is a broader grant than anything else here needs.
- **Edit zone settings** (Always Use HTTPS, SSL mode, and the certificate-pack
  API). Do those in the dashboard too.

Until 2026-08-12 the zone resource was `Specific zone: maive.eu`, which is why
`spuriousprecision.com` was never documented: the token simply could not read
it. If a call fails with a bare `Authentication error` code 10000, suspect
resource scoping rather than a bad token. A zone created *after* a
zone-scoped token is issued is not covered by it, which is the reason for the
account-wide setting.

## Workers

| Script | Source | Routes |
|---|---|---|
| `ui-origin-proxy` | [`workers/ui-origin-proxy.js`](workers/ui-origin-proxy.js) | `maive.eu/*`, `www.maive.eu/*`, `spuriousprecision.com/*`, `www.spuriousprecision.com/*`, `easymeta.org/*`, `www.easymeta.org/*` |
| `api-origin-proxy` | [`workers/api-origin-proxy.js`](workers/api-origin-proxy.js) | `api.maive.eu/*` |

The account contains exactly these two Worker scripts. `ui-origin-proxy` is
hostname-agnostic: it rewrites whatever host it receives to the fixed origin,
so adding a hostname is purely a matter of adding a route.

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

## DNS

### Zone `maive.eu`

| Record | Type | Content | Proxied |
|---|---|---|---|
| `maive.eu` | CNAME | UI Function URL host | yes |
| `www` | CNAME | UI Function URL host | yes |
| `api` | CNAME | UI Function URL host | yes |
| `*` | CNAME | UI Function URL host | yes |
| `_64ed45c95a46a88d8e5774f42f69b303` | CNAME | `…xlfgrmvvlj.acm-validations.aws` | no |

The record **content for `api` is a placeholder**: the Worker route intercepts
the request and picks the origin per path, so the CNAME target is never used.
It exists only so the hostname resolves through Cloudflare without depending on
the `*` wildcard. The `_64ed…` record is a leftover ACM validation record from
the retired ALB era; harmless.

Note the wildcard means *any* subdomain resolves through Cloudflare. Subdomains
with no Worker route (e.g. `foo.maive.eu`) proxy straight to the UI Function
URL, which rejects the foreign Host, so they hang. Pre-existing; harmless, but
surprising if you hit it.

### Zone `spuriousprecision.com`

Inventoried 2026-08-12, once the token could read it. It mirrors `maive.eu`
almost exactly:

| Record | Type | Content | Proxied |
|---|---|---|---|
| `spuriousprecision.com` | CNAME | UI Function URL host | yes |
| `www` | CNAME | UI Function URL host | yes |
| `*` | CNAME | UI Function URL host | yes |
| `_144a1a6b…` | CNAME | `…xlfgrmvvlj.acm-validations.aws` | no |

Worker routes `spuriousprecision.com/*` and `www.spuriousprecision.com/*`, both
to `ui-origin-proxy`. Same leftover ACM validation record and same stale
`ns.wedos.*` apex NS records as `maive.eu`; both are inert.

### Zone `easymeta.org`

| Record | Type | Content | Proxied |
|---|---|---|---|
| `easymeta.org` | CNAME | UI Function URL host | yes |
| `www` | CNAME | UI Function URL host | yes |

**No wildcard, deliberately.** The other two zones have one, and it is the
reason an unrouted subdomain there hangs instead of failing cleanly. There is
no need to repeat that here.

### `easymeta.org` (GoDaddy, pre-migration)

Recorded 2026-08-11, before any change, so it can be restored:

| | |
|---|---|
| Nameservers | `ns01.domaincontrol.com`, `ns02.domaincontrol.com` |
| SOA | `ns01.domaincontrol.com. dns.jomax.net. 2026071500 28800 7200 604800 600` |
| A (apex and `www`) | `3.33.251.168`, `15.197.225.128` (GoDaddy forwarding front end) |
| AAAA / MX / TXT / CAA | none |
| DNSSEC | **not enabled** (no `DS` at the parent), so a nameserver move is safe |
| Forwarding | 301 to `https://www.spuriousprecision.com`, on both `http` and `https`, apex and `www` |

The forwarder answers `HEAD` with **405 Method Not Allowed** and an empty body,
and answers `GET` with a 68-byte
`<a href="https://www.spuriousprecision.com">Moved Permanently</a>.`

## Rate limiting

Free plan means **one** rate-limiting rule per zone, with the window locked to
10s. Rules are per-zone, so a new serving zone needs its own rule rather than
being added to an existing expression.

### Zone `maive.eu`

- Ruleset: `http_ratelimit` phase, `249833cdb85e4b6ebb17757de27bc98a`
- Rule: `ba0f0b4af0644677bbff97e336279f4f`
- Expression: `(http.host eq "maive.eu" or http.host eq "www.maive.eu" or http.host eq "api.maive.eu")`
- Action: `block`, 100 requests / 10s per `(ip.src, cf.colo.id)`, mitigation 10s

Because it is one shared rule, UI and API traffic count toward the same per-IP
budget. This is a speed bump, not the main defense: the real cost control is the
R Lambda's reserved concurrency (`lambda_r_backend_reserved_concurrency`, in
Terraform), per `PUBLIC_API_DESIGN.md` D2.

### Zone `spuriousprecision.com`

- Ruleset `7f1cd1cb9a184c30b04a345b64b7bedc`, rule `07341b176aa84bb1a30755d0adde2d01`
- Expression: `(http.host eq "spuriousprecision.com" or http.host eq "www.spuriousprecision.com")`
- Same shape: `block`, 100 requests / 10s per `(ip.src, cf.colo.id)`

### Zone `easymeta.org`

- Ruleset `22e8bfe243e44a8fba4681ae089c784d`, rule `536d815293d1482b8beb2b6b66dfe39f`
- Expression: `(http.host eq "easymeta.org" or http.host eq "www.easymeta.org")`
- Same shape: `block`, 100 requests / 10s per `(ip.src, cf.colo.id)`

Added before the zone was delegated, on purpose. A serving hostname without a
rate-limit rule is the cheap unmetered path to the same Lambdas and defeats the
rules on the other two zones.

## Migrating `easymeta.org`

The target topology, per
[#487](https://github.com/PetrCala/maive-ui/issues/487):

- `easymeta.org` + `www.easymeta.org` serve the app through Cloudflare.
- `spuriousprecision.com` + `www` 301-redirect to `easymeta.org`.
- `maive.eu` keeps serving the app unchanged. It is the infrastructure zone and
  the fallback front door; **do not** redirect it.
- `api.maive.eu` is untouched.

Steps, in this order, because only step 5 is hard to reverse:

1. Re-scope the API token. Its **Zone Resources** must become *All zones from
   an account* rather than the single `maive.eu` zone, and it needs **Zone :
   DNS : Edit**, **Zone : Workers Routes : Edit**, **Zone : Zone WAF : Edit**
   (rate-limit rules) and **Zone : Zone : Read**, alongside the existing
   **Account : Workers Scripts : Edit**. A zone created later is not covered by
   a token scoped to specific zones, which is why the account-wide resource
   selection matters.
2. Add `easymeta.org` **in the dashboard** (Add a site), not via the API. Zone
   creation needs `com.cloudflare.api.account.zone.create`, a broader grant
   than anything else here needs, and clicking Add a site avoids it entirely.
   Pending zones do not affect live DNS, so this and everything through step 4
   is reversible by deleting the zone.
   **Delete whatever Cloudflare's DNS scan imports.** It will pick up the
   GoDaddy forwarding A records (`3.33.251.168`, `15.197.225.128`); left in
   place, the zone would proxy to the old forwarder after delegation.
3. Add proxied `CNAME` records for the apex and `www` pointing at the UI
   Function URL host, add `easymeta.org/*` and `www.easymeta.org/*` routes to
   `ui-origin-proxy`, add the zone's rate-limit rule, and enable Always Use
   HTTPS.
4. Verifying before delegating **does not work**, and the reason is structural
   rather than a config error. Cloudflare does not serve a zone at the edge
   until it is `active`, and a zone only becomes active once it sees the
   nameserver delegation. Pre-delegation,
   `curl --resolve easymeta.org:443:<cf-ip> https://easymeta.org/` fails the
   TLS handshake, because Universal SSL is not issued for a pending zone, and
   the same request on port 80 returns **409**, which is byte-for-byte what
   Cloudflare returns for a domain it has never heard of. Measured 2026-08-12,
   with two controls: `maive.eu` through the identical `--resolve` technique
   returns `200`, and an invented domain through the same edge IP returns the
   same `409`. So the 409 says "zone not active", not "config broken", and
   there is no pre-flight that distinguishes a correct config from a broken one.

   What can be checked instead is config equivalence against the two zones
   known to work: same origin, same Worker script, same route shape, same
   rate-limit shape. That is an argument, not a test. Weigh it against the
   rollback cost before flipping.
5. Flip the nameservers at GoDaddy to the pair Cloudflare assigns, then poll
   until the zone reports `active`. DNSSEC is off, so no extra step is needed,
   but re-check that before flipping. Propagation is not instant.

   **Expect a window where HTTPS is broken.** Universal SSL is only ordered
   once the zone goes active, so between activation and certificate issuance
   `https://easymeta.org` will fail to handshake. Today the domain works, so
   this is a real if short regression, and it is the main argument for doing
   the flip at a quiet hour rather than mid-week daytime.
6. Only once `easymeta.org` is confirmed serving, switch
   `spuriousprecision.com` to a 301 redirect (Single Redirects,
   `http_request_dynamic_redirect` phase) and drop its `ui-origin-proxy`
   routes.
7. Re-verify all four hostnames end to end, including that `maive.eu` and
   `api.maive.eu` are unaffected, and run a real analysis on the new domain.

## Rollback

- **API hostname:** delete the `api.maive.eu/*` Worker route. `api.maive.eu`
  reverts to hanging (via the wildcard); the UI is unaffected.
- **UI:** the `maive.eu/*` and `www.maive.eu/*` routes are load-bearing; do not
  delete them without a plan.
- **`easymeta.org` migration, before the nameserver flip:** delete the
  Cloudflare zone. Nothing public changed.
- **`easymeta.org` migration, after the nameserver flip:** set the nameservers
  at GoDaddy back to `ns01.domaincontrol.com` / `ns02.domaincontrol.com` and
  re-enable forwarding to `https://www.spuriousprecision.com`. Allow for
  propagation. This is why `spuriousprecision.com` should only be switched to
  a redirect after `easymeta.org` is confirmed serving: doing both at once
  leaves no working front door to roll back to.
- **`spuriousprecision.com` redirect:** delete the redirect rule and restore
  its `ui-origin-proxy` routes.
