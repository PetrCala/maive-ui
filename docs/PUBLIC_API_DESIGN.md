# Public Model API — Design & Implementation Plan

**Status:** Proposed (pre-implementation)
**Date:** 2026-07-08
**Related:** [ASYNC_RUNS_DESIGN.md](ASYNC_RUNS_DESIGN.md) (async runs infra this design reuses);
[SERVER_SIDE_API_ARCHITECTURE.md](SERVER_SIDE_API_ARCHITECTURE.md) (current serving topology)

> This document is the scope of record for exposing a **documented, public,
> anonymous HTTP API** that lets anyone run MAIVE/WAIVE/WLS and RTMA analyses
> programmatically — without going through the MAIVE UI. It is meant to be
> reviewed and agreed before implementation starts. Decisions in §4 are
> considered locked once this document is approved.

---

## 1. Motivation & background

Researchers who want to script MAIVE runs (batch analyses, robustness checks,
integration into their own pipelines) currently have two options: click through
the UI, or download a reproducibility package and run R locally. Neither works
for programmatic access from Python/Stata/CI pipelines.

The key realization: **the API already exists and is already public.** The R
Plumber backend runs behind a Lambda Function URL with `authorization_type =
"NONE"` and CORS `*` (`terraform/stacks/prod-runtime/lambda.tf`), and the
browser already POSTs to it directly. What is missing is not a service — it is
**productization**:

- a **stable, branded URL** (today: an obscure `.on.aws` hostname that changes
  if the Function URL is ever recreated),
- a **clean request contract** (today: `data` and `parameters` are
  double-encoded JSON *strings* inside the JSON body — an internal UI
  convention, hostile to third-party callers),
- **proper HTTP semantics** (today: errors return `200 {error: true, ...}`),
- **server-side input validation** (today: the friendly validation lives in the
  UI's validation page; the backend gives raw R errors),
- **documentation** (OpenAPI spec + examples),
- **abuse/cost protection** (today: obscurity plus nothing — the R Lambda has
  no reserved concurrency, so unbounded anonymous compute at 2 GB × 600 s).

Publicly documenting the endpoint removes the obscurity, so the cost controls
are a **prerequisite**, not a nice-to-have.

## 2. Goals / non-goals

**Goals**

- A documented `/v1` HTTP API for running models: **synchronous** for typical
  datasets and **asynchronous** (submit + poll) for long runs — both from the
  start.
- **Anonymous access** — no accounts, no API keys — matching the UI's access
  model. Abuse is bounded by hard concurrency caps and edge rate limits, not
  identity.
- Clean JSON request/response contract with real HTTP status codes and
  structured errors.
- Server-side validation that mirrors the UI's validation-page rules, so API
  callers get friendly `400`s instead of raw R errors.
- An OpenAPI 3 spec as the single source of truth, plus copy-paste `curl` / R /
  Python examples.
- **Zero behavior change for the UI** — legacy routes (`/run-model`,
  `/run-rtma`, `/api/runs*`) are untouched.

**Non-goals (this iteration)**

- API keys, accounts, per-caller quotas, usage metering, billing.
- SDK packages (R/Python client libraries) — examples only.
- Guaranteed support for datasets that are simultaneously too large to queue
  (>200 KB) *and* too slow for the edge (>100 s) — see §12.
- Changing the statistical/compute path or the R model code.
- SLA/uptime commitments.

## 3. Current state (as-is)

- **R backend Lambda** (`apps/lambda-r-backend/r_scripts/`): Plumber via the
  AWS Lambda Web Adapter; Function URL auth `NONE`, CORS `*`; `timeout=600s`,
  `memory_size=2048`, **no reserved concurrency** (deliberately unreserved so
  synchronous browser calls are never throttled — see comment in
  `orchestrator_lambda.tf`).
- **Existing routes** (`r_scripts/index.R`): `GET /echo`, `GET /health`,
  `GET /ping`, `POST /run-model`, `POST /run-rtma`. The POST routes take two
  fields, `data` and `parameters`, **each a JSON-encoded string**, because
  `run_maive_model()` / `run_rtma_model()` call `jsonlite::fromJSON()` on them
  (`maive_model.R:69-70`). Errors return HTTP 200 with
  `{error: true, message}`.
- **Data contract**: 3 or 4 columns, interpreted **positionally** and renamed
  to `bs`, `sebs`, `Ns`[, `study_id`] (`maive_model.R:87-99`). The UI always
  sends normalized rows keyed `effect`, `se`, `n_obs`[, `study_id`].
- **Async runs** (shipped, `ASYNC_RUNS_ENABLED: true`): browser →
  `POST /api/runs` (UI Lambda) → DynamoDB `queued` + SQS → orchestrator Lambda
  (Node 20, `maximum_concurrency=5`) → R Function URL → DynamoDB terminal
  status + result (48 h TTL). Poll via `GET /api/runs/{jobId}`; batch status
  via `GET /api/runs?ids=`. `jobId` is an opaque bearer token (locked decision
  D6 of the async design).
- **Edge**: Cloudflare fronts the *UI* domains only (`maive.eu`,
  `spuriousprecision.com`), with a Worker rewriting Host/SNI to the `.on.aws`
  origin. The R Function URL is **not** behind Cloudflare; the browser calls
  it directly. Cloudflare caps proxied origin responses at ~100 s.
- **Costs**: ~$0.001–0.002 of Lambda compute per typical run; pathological
  runs bounded by the R-side 480 s guard (RTMA) / 600 s Lambda timeout.

## 4. Locked decisions

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | **Anonymous access; no API keys.** | The UI calls the same compute keylessly from the browser, so any key would be trivially bypassable by replaying what the browser does. Keys buy attribution/quotas we don't need yet; they cost UX and support burden. Cost is bounded structurally (D2), not by identity. |
| D2 | **Primary cost control: reserved concurrency on the R Lambda (start: 10).** Edge rate limits are secondary. | Rate-limiting only the branded hostname is bypassable via the raw `.on.aws` URL (the UI's own path). A concurrency cap bounds worst-case spend regardless of route: at most N concurrent 2 GB × 600 s executions, excess gets `429`. 10 = orchestrator's 5 async slots + headroom for sync UI/API calls. |
| D3 | **New versioned routes (`/v1/...`); legacy routes untouched.** | The UI keeps working unchanged; the public contract can be clean without a risky migration. `/v1` is frozen once shipped — additive changes only; breaking changes mean `/v2`. |
| D4 | **`/v1` accepts plain nested JSON** (objects, not double-encoded strings) and returns proper HTTP status codes with a structured error envelope. | Double-encoded strings and `200`-on-error are internal warts we must not export. The `/v1` handlers re-encode internally (`toJSON`) before calling the unchanged `run_maive_model()` / `run_rtma_model()`. |
| D5 | **Rows are JSON objects; columns resolved by canonical names (`effect`, `se`, `n_obs`, `study_id`) when present, positionally otherwise.** | Key order in JSON is not reliably meaningful; resolving by name removes a silent-misordering footgun. Positional fallback keeps parity with the legacy contract for callers with arbitrary column names. |
| D6 | **All parameters optional with documented defaults** (matching the UI's `CONFIG.DEFAULT_MODEL_PARAMETERS`); `shouldUseInstrumenting` is derived from `modelType` unless explicitly set. | A minimal valid request is just `{"data": [...]}`. Internal parameters shouldn't be required knowledge; WLS-vs-MAIVE instrumenting coupling is app logic the server should own. |
| D7 | **Plots excluded by default; opt-in via `?include=plot`.** | The base64 funnel/z-density PNG is ~50 KB — noise for programmatic callers. Applies to sync responses and async result fetches alike. |
| D8 | **Async API = thin `/v1/runs` routes on the UI Lambda wrapping the existing DDB/SQS machinery.** `result` is returned as a parsed JSON object; oversized submissions get `413` (not the internal `{tooLarge: true}` signal). `jobId` stays an opaque bearer token with 48 h TTL. | The queue/orchestrator/store already exist and are proven; the public surface is a re-skin with public-grade semantics. No new AWS infra. |
| D9 | **Branded hostname `api.maive.eu`, path-routed by the Cloudflare Worker: `/v1/runs*` → UI Lambda origin, everything else `/v1/*` → R Lambda origin.** | One hostname for the whole API surface. A subdomain (vs `maive.eu/api/...`) gets its own WAF/rate-limit scoping and avoids entangling with the Next.js `/api/*` namespace. The Worker already does Host/SNI rewriting for the UI; this reuses the pattern. |
| D10 | **OpenAPI 3 spec in-repo (`docs/api/openapi.yaml`) is the source of truth for the contract.** | Reviewable, versionable, lint-able; can later be served/rendered by the UI without redefinition. |

## 5. Target architecture

```
                       Cloudflare (api.maive.eu)
                       WAF + per-IP rate limits
                                │
              Worker routes by path, rewrites Host/SNI
                ┌───────────────┴────────────────┐
   /v1/run-model, /v1/run-rtma,          /v1/runs, /v1/runs/{jobId}
   /v1/health   (sync)                   (async submit / poll)
                │                                 │
                ▼                                 ▼
   R Lambda Function URL                 UI Lambda Function URL
   (Plumber; reserved                    (Next.js routes; fast DDB/SQS
    concurrency = 10)                     handlers)
                ▲                                 │ SQS
                │      POST /run-model|/run-rtma  ▼
                └────────────── orchestrator Lambda (existing, max 5)
                                          │
                                     DynamoDB `maive-runs`
                                     (result, 48 h TTL)
```

- **Sync** (`/v1/run-model`, `/v1/run-rtma`): request → R Lambda → response in
  one round trip. Subject to Cloudflare's ~100 s proxy cap — fine for typical
  runs (~15–60 s incl. cold start), documented as unsuitable for long runs.
- **Async** (`/v1/runs`): submit returns `{jobId}` immediately; poll until a
  terminal status; fetch the result once. No long-lived connections; immune to
  the edge cap; the path to recommend by default in the docs.
- The raw `.on.aws` Function URLs keep working (the UI depends on them). The
  docs only advertise `api.maive.eu`.

## 6. The `/v1` contract

### 6.1 Conventions

- Base URL: `https://api.maive.eu`. Content type: `application/json` both ways.
- Success: `200` with the resource/result at the **top level** (no `{data: ...}`
  envelope).
- Errors: appropriate status code with

  ```json
  { "error": { "code": "validation_error", "message": "Data must have 3 or 4 columns; found 6." } }
  ```

  Codes: `validation_error` (400), `not_found` (404), `method_not_allowed`
  (405), `payload_too_large` (413), `rate_limited` (429, from the edge or
  Lambda throttling), `internal_error` (500), `not_configured` (503).

### 6.2 Data contract (shared by all run endpoints)

`data` is an array of row objects:

```json
[
  { "effect": 0.42, "se": 0.11, "n_obs": 120, "study_id": "Smith2020" },
  { "effect": 0.31, "se": 0.06, "n_obs": 90,  "study_id": "Smith2020" }
]
```

- Columns are resolved by the canonical names above when present; otherwise
  the first 3–4 keys are taken positionally as (effect, se, n_obs[, study_id])
  — per D5.
- **MAIVE-family** (`/v1/run-model`): 3 or 4 columns; ≥ 4 rows; `effect`,
  `se`, `n_obs` numeric; `se > 0`; `n_obs` positive integers; if `study_id`
  present, rows ≥ unique studies + 3. These mirror the UI validation page
  (`pages/validation/index.tsx`) and are enforced server-side so API callers
  get structured `400`s.
- **RTMA** (`/v1/run-rtma`): ≥ 2 columns (`effect`, `se`); rows with missing
  or non-positive `se` are dropped with a warning field, matching current
  behavior.

### 6.3 `POST /v1/run-model` — synchronous MAIVE / WAIVE / WLS

Request (`?include=plot` to embed the funnel plot):

```json
{
  "data": [ { "effect": 0.42, "se": 0.11, "n_obs": 120 }, ... ],
  "parameters": {
    "modelType": "MAIVE",
    "maiveMethod": "PET-PEESE",
    "weight": "equal_weights",
    "standardErrorTreatment": "clustered_cr2",
    "includeStudyDummies": false,
    "includeStudyClustering": false,
    "computeAndersonRubin": false,
    "useLogFirstStage": false,
    "winsorize": 0
  }
}
```

All parameters optional (D6); defaults = the UI's defaults
(`CONFIG.DEFAULT_MODEL_PARAMETERS`):

| Parameter | Values | Default |
|---|---|---|
| `modelType` | `MAIVE` \| `WAIVE` \| `WLS` | `MAIVE` |
| `maiveMethod` | `PET` \| `PEESE` \| `PET-PEESE` \| `EK` | `PET-PEESE` |
| `weight` | `equal_weights` \| `standard_weights` \| `adjusted_weights` \| `study_weights` | `equal_weights` |
| `standardErrorTreatment` | `not_clustered` \| `clustered` \| `clustered_cr2` \| `bootstrap` | `clustered_cr2` |
| `includeStudyDummies` | boolean | `false` |
| `includeStudyClustering` | boolean | `false` |
| `computeAndersonRubin` | boolean | `false` |
| `useLogFirstStage` | boolean | `false` |
| `winsorize` | number (percent, 0 disables) | `0` |
| `shouldUseInstrumenting` | boolean | derived: `WLS` → `false`, else `true` |

Response `200`: the flat results object (today's `ModelResults` shape —
`effectEstimate`, `standardError`, `isSignificant`, `andersonRubinCI`,
`publicationBias{...}`, `firstStageFStatistic`, `hausmanTest{...}`,
`seInstrumented`, `bootSE`, `bootCI`, `firstStage`, `petpeese_selected`, … —
plus `funnelPlot`/`funnelPlotWidth`/`funnelPlotHeight` only with
`?include=plot`).

### 6.4 `POST /v1/run-rtma` — synchronous RTMA

Same envelope; parameters (all optional): `favorPositive` (default `true`),
`alphaSelect` (`0.05`), `ciLevel` (`0.95`), `winsorize` (`0`). The internal
`parallelize` / `timeoutSeconds` knobs are **not** exposed. Response: `mu`,
`muCI`, `tau`, `tauCI`, `nonaffirmativeCount`, `nonaffirmativeProportion`
(+ `zScorePlot*` with `?include=plot`).

### 6.5 Async: `POST /v1/runs`, `GET /v1/runs/{jobId}`

**Submit** — body `{ data, parameters?, modelType? }` (same data/parameter
contract; `modelType: "RTMA"` routes to the RTMA path). Returns `200
{ "jobId": "..." }`. Datasets whose queue message would exceed the ~200 KB SQS
budget get `413 payload_too_large` with a message pointing at the synchronous
endpoint (D8).

**Poll** — `GET /v1/runs/{jobId}`:

```json
{ "jobId": "…", "status": "queued|running|succeeded|failed|timedout",
  "modelType": "MAIVE", "runDurationMs": 41210,
  "runTimestamp": "2026-07-08T12:34:56Z",
  "result": { … },            // present once status is terminal-successful; parsed object
  "errorMessage": "…"         // present on failed/timedout
}
```

`404` for unknown/expired ids (48 h TTL). Suggested polling: every 2–5 s.
Batch status: `GET /v1/runs?ids=a,b,c` (statuses only, no results; max 100).

`jobId` is a bearer token: anyone holding it can read that run for 48 h — the
same exposure model the UI already has (async design D6). Stated plainly in
the docs.

### 6.6 `GET /v1/health`

`200 { "status": "ok", "time": "…" }` — alias of the existing `/health`.

### 6.7 Example (curl)

```bash
curl -s https://api.maive.eu/v1/run-model \
  -H 'Content-Type: application/json' \
  -d '{
    "data": [
      {"effect": 0.42, "se": 0.11, "n_obs": 120},
      {"effect": 0.31, "se": 0.06, "n_obs": 90},
      {"effect": 0.55, "se": 0.20, "n_obs": 45},
      {"effect": 0.12, "se": 0.04, "n_obs": 200}
    ]
  }'
```

R (`httr2`) and Python (`requests`) equivalents, plus an async submit/poll
example, ship with the docs; the reproducibility package generator
(`lib/reproducibility/generators/wrapperScript.ts`) already encodes the
calling conventions and seeds the examples.

## 7. Abuse & cost controls

Layered, in order of load-bearing-ness:

1. **Reserved concurrency = 10 on the R Lambda** (D2; Terraform). Hard ceiling
   on concurrent compute regardless of entry path. Worst-case sustained abuse
   ≈ 10 × 2 GB × 100% duty cycle ≈ low tens of $/day, alarmed well before that.
   The orchestrator's `maximum_concurrency=5` fits inside it, so async can
   never starve sync entirely (and vice versa is acceptable: sync overflow
   `429`s, and the UI already has the async path).
2. **Cloudflare rate limiting on `api.maive.eu`** (per-IP; starting points:
   POSTs 10/min, GETs 120/min) + WAF/bot rules. Deters casual abuse on the
   documented hostname; the concurrency cap covers the bypass route.
3. **Existing guards**: RTMA 480 s wall-clock limit, Lambda 600 s timeout,
   Function URL ~6 MB payload cap, existing CloudWatch error alarms. Add one
   alarm on R-Lambda throttles (signal that the cap is being hit — abuse or
   organic growth).

Explicitly rejected: locking the Function URL to Cloudflare-only via a
Worker-injected shared-secret header. It would force the UI's direct browser
calls through Cloudflare too, inheriting the ~100 s cap and breaking long
synchronous UI runs. Revisit only if bypass abuse is actually observed (§12).

## 8. Privacy & security

- No change to data-at-rest posture: sync requests are stateless; async runs
  persist results for 48 h in DynamoDB exactly as the UI's async path already
  does; input datasets are still not persisted (transient SQS message only).
- Anonymous by design (D1) — no new PII collected. Cloudflare sees API traffic
  for the branded hostname (it already sees all UI traffic).
- The docs must state: don't submit personally identifiable or confidential
  data; `jobId` is a share-token; results auto-expire.

## 9. Implementation plan

**Phase 1 — the contract (one PR, no infra):**

- [ ] `r_scripts/api_v1.R`: validation helpers (column resolution per D5,
      UI-parity checks per §6.2, parameter defaulting per D6, error responses
      per §6.1).
- [ ] `r_scripts/index.R`: add `POST /v1/run-model`, `POST /v1/run-rtma`,
      `GET /v1/health` — thin wrappers that validate, apply defaults,
      `toJSON()` the inputs, call the **unchanged** model functions, strip
      plots unless `?include=plot`, set proper status codes. Legacy routes
      untouched.
- [ ] `Dockerfile`: `COPY r_scripts/api_v1.R .`
- [ ] Next.js `pages/api/v1/runs.ts` + `pages/api/v1/runs/[jobId].ts`: public
      re-skins of the existing runs routes (shared helpers extracted, not
      duplicated) with D8 semantics (parsed `result`, `413`, plot stripping,
      error envelope).
- [ ] `docs/api/openapi.yaml` (D10) + `docs/PUBLIC_API.md` usage guide with
      curl/R/Python examples.
- [ ] Tests: R e2e scenario `tests/e2e/scenarios/api_v1_test.R` (happy path,
      validation 400s, defaults, plot opt-in) via an extended
      `utils/api_client.R`; Vitest coverage for the `/api/v1/runs` routes.

**Phase 2 — infra & edge:**

- [ ] Terraform (`prod-runtime`): `reserved_concurrent_executions = 10` on the
      R Lambda; CloudWatch throttle alarm.
- [ ] Cloudflare (managed out of band, like the existing Worker): DNS
      `api.maive.eu`, Worker route with path-based origin selection (D9),
      rate-limit + WAF rules.
- [ ] Smoke test the full surface through the branded hostname; verify the UI
      is unaffected (its direct `.on.aws` path unchanged).

**Phase 3 — publication:**

- [ ] Docs page in the UI (e.g. `/api`) rendering the OpenAPI spec + examples;
      link from the footer next to the reproducibility material.
- [ ] Citation requirement surfaced in the docs (Nature Communications 2025,
      per repo policy).
- [ ] Announce; monitor throttles/alarms; tune rate limits and the
      concurrency cap from observed load.

Phase 1 is fully testable against local dev (`npm run r:dev` +
`npm run ui:dev`) and the raw Function URLs; nothing user-visible changes
until Phase 3.

## 10. Rollout & rollback

1. Phase 1 merges dark: new routes exist but are unadvertised; legacy paths
   untouched → **rollback = nothing** (routes are additive).
2. Phase 2 applies the concurrency cap first, watches the throttle alarm for a
   normal week of UI traffic, then adds the hostname.
   **Rollback lever:** remove/raise `reserved_concurrent_executions`; delete
   the Worker route.
3. Phase 3 publishes docs only after the cap + rate limits are observed
   holding.

## 11. Risks & open questions

- **Sync × edge cap:** a sync run slower than ~100 s dies at Cloudflare while
  the Lambda finishes (and bills). Mitigation: docs steer to async by default;
  sync is positioned for small/typical datasets.
- **Large + slow gap:** datasets >200 KB can't queue (SQS) and, if also slow,
  can't reliably finish through the edge. Accepted for v1 (raw sync against a
  long-lived connection still works below 6 MB when called without Cloudflare);
  the S3 input-pointer escape hatch from the async design (§15 there) is the
  eventual fix.
- **Concurrency cap = 10 is a guess.** It now also throttles UI sync traffic
  at the margin — previously deliberately unreserved. Watch the throttle
  alarm; tune.
- **Column resolution by name (D5)** adds one behavior divergence from legacy
  (which is purely positional). Contained to `/v1`; property-tested in the e2e
  scenario.
- **Hostname mirroring:** also expose `api.spuriousprecision.com`? Deferred —
  one canonical hostname keeps docs and rate-limit scoping simple.
- **Result-shape stability:** `/v1` freezes field names that today mirror
  internal R naming (`petpeese_selected`, `is_quadratic_fit`, …). Accepted —
  they're already the de-facto contract for the UI and reproducibility
  packages.

## 12. Out of scope / future

- API keys / per-caller quotas / usage metering (revisit if anonymous abuse or
  real third-party volume materializes).
- Locking the Function URLs to Cloudflare-only (see §7).
- S3 escape hatch for large inputs/results; response streaming
  (`AWS_LWA_INVOKE_MODE=response_stream`) to beat the edge cap on sync.
- Published client SDKs; webhook/callback notification on async completion.
- Versioned model pinning (letting callers request a specific MAIVE package
  version).
