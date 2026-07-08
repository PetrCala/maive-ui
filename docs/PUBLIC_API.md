# Public Model API: Usage Guide

## Overview

MAIVE exposes a public, anonymous HTTP API for running MAIVE / WAIVE / WLS
and RTMA meta-analysis models programmatically; no accounts, no API keys.
It's the same compute the MAIVE UI uses, given a clean, documented contract.

> **Status:** this guide documents the target `/v1` contract. The branded
> hostname (`api.maive.eu`) goes live in a later rollout phase; if it
> doesn't resolve yet, that's expected; see
> [`PUBLIC_API_DESIGN.md`](PUBLIC_API_DESIGN.md) for the rollout plan.

The full machine-readable contract lives in
[`docs/api/openapi.yaml`](api/openapi.yaml) (OpenAPI 3); it is the source of
truth for request/response shapes. This guide is a narrative companion with
copy-paste examples.

- Base URL: `https://api.maive.eu`
- Content type: `application/json` both ways
- Auth: none; the API is anonymous by design. Abuse is bounded by
  server-side concurrency caps and edge rate limits, not identity.

## Sync vs. async

Two ways to run a model:

| | Synchronous | Asynchronous |
|---|---|---|
| Endpoints | `POST /v1/run-model`, `POST /v1/run-rtma` | `POST /v1/runs` (submit) + `GET /v1/runs/{jobId}` (poll) |
| Shape | One request, one response | Submit returns a `jobId` immediately; poll until terminal, then read `result` |
| Edge cap | Subject to Cloudflare's **~100s** proxy cap on `api.maive.eu` | Not subject to the cap (no long-lived connection) |
| When to use | Typical datasets, runs finishing in well under 100s (roughly 15-60s including cold start) | **Recommended default.** Anything that might run long, batch/CI usage, or when you'd rather not hold a connection open |

**Recommendation: use the async path by default.** It has no failure mode tied
to run duration. Reach for sync only when you know the run is small and you
want the simplicity of a single request.

## Data requirements

Requests take `data` as an array of row objects. Columns are resolved by
canonical key name when present (`effect`, `se`, `n_obs`, `study_id`,
matched case-insensitively); otherwise the first 3-4 object keys are read
positionally in that order.

| Field | Type | Required for | Notes |
|---|---|---|---|
| `effect` | number | MAIVE-family, RTMA | Estimated effect size |
| `se` | number | MAIVE-family, RTMA | Standard error; must be `> 0` |
| `n_obs` | integer | MAIVE-family | Number of observations; must be a positive integer |
| `study_id` | string | optional | Enables study clustering; if present, rows must be ≥ unique studies + 3 |

| Endpoint | Columns | Min rows |
|---|---|---|
| `POST /v1/run-model` (MAIVE/WAIVE/WLS) | 3 or 4 | 4 |
| `POST /v1/run-rtma` | 2 (`effect`, `se`) | Rows with missing/non-positive `se` are silently dropped |

These mirror the MAIVE UI's own validation page, enforced server-side so API
callers get a structured `400 validation_error` instead of a raw R error;
see [`components/responses/ValidationError`](api/openapi.yaml) in the spec.

All model parameters are optional; unset ones fall back to documented
defaults (the same defaults the UI ships with). A minimal valid request is
just `{"data": [...]}`. See the `ModelParameters` / `RTMAParameters` schemas
in the OpenAPI spec for the full enum/default table.

Plots (`funnelPlot`, `zScorePlot`, and their width/height companions) are
**excluded by default**: each is a ~50KB base64 PNG, noise for most
programmatic callers. Add `?include=plot` to any run or poll request to embed
them.

## Examples: synchronous run

### curl

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

### R (httr2)

```r
library(httr2)

body <- list(
  data = list(
    list(effect = 0.42, se = 0.11, n_obs = 120),
    list(effect = 0.31, se = 0.06, n_obs = 90),
    list(effect = 0.55, se = 0.20, n_obs = 45),
    list(effect = 0.12, se = 0.04, n_obs = 200)
  )
)

resp <- request("https://api.maive.eu/v1/run-model") |>
  req_body_json(body) |>
  req_perform()

results <- resp_body_json(resp)
str(results)
```

### Python (requests)

```python
import requests

body = {
    "data": [
        {"effect": 0.42, "se": 0.11, "n_obs": 120},
        {"effect": 0.31, "se": 0.06, "n_obs": 90},
        {"effect": 0.55, "se": 0.20, "n_obs": 45},
        {"effect": 0.12, "se": 0.04, "n_obs": 200},
    ]
}

resp = requests.post("https://api.maive.eu/v1/run-model", json=body, timeout=120)
resp.raise_for_status()
results = resp.json()
print(results["effectEstimate"], results["standardError"])
```

## Examples: asynchronous run (submit → poll → fetch)

Submit returns a `jobId` immediately. Poll `GET /v1/runs/{jobId}` every 2-5s
until `status` is terminal (`succeeded`, `failed`, or `timedout`), then read
`result`.

### curl

```bash
# 1. Submit
job=$(curl -s https://api.maive.eu/v1/runs \
  -H 'Content-Type: application/json' \
  -d '{
    "modelType": "MAIVE",
    "data": [
      {"effect": 0.42, "se": 0.11, "n_obs": 120},
      {"effect": 0.31, "se": 0.06, "n_obs": 90},
      {"effect": 0.55, "se": 0.20, "n_obs": 45},
      {"effect": 0.12, "se": 0.04, "n_obs": 200}
    ]
  }' | jq -r '.jobId')

echo "jobId: $job"

# 2. Poll until terminal
while true; do
  status=$(curl -s "https://api.maive.eu/v1/runs/$job" | tee /tmp/run.json | jq -r '.status')
  echo "status: $status"
  [[ "$status" == "succeeded" || "$status" == "failed" || "$status" == "timedout" ]] && break
  sleep 3
done

# 3. Read the result
jq '.result' /tmp/run.json
```

### R (httr2)

```r
library(httr2)

submit_body <- list(
  modelType = "MAIVE",
  data = list(
    list(effect = 0.42, se = 0.11, n_obs = 120),
    list(effect = 0.31, se = 0.06, n_obs = 90),
    list(effect = 0.55, se = 0.20, n_obs = 45),
    list(effect = 0.12, se = 0.04, n_obs = 200)
  )
)

submit_resp <- request("https://api.maive.eu/v1/runs") |>
  req_body_json(submit_body) |>
  req_perform()

job_id <- resp_body_json(submit_resp)$jobId
cat("jobId:", job_id, "\n")

terminal_statuses <- c("succeeded", "failed", "timedout")
repeat {
  run <- request(sprintf("https://api.maive.eu/v1/runs/%s", job_id)) |>
    req_perform() |>
    resp_body_json()

  cat("status:", run$status, "\n")
  if (run$status %in% terminal_statuses) break
  Sys.sleep(3)
}

if (run$status == "succeeded") {
  str(run$result)
} else {
  stop(run$errorMessage)
}
```

### Python (requests)

```python
import time
import requests

submit_body = {
    "modelType": "MAIVE",
    "data": [
        {"effect": 0.42, "se": 0.11, "n_obs": 120},
        {"effect": 0.31, "se": 0.06, "n_obs": 90},
        {"effect": 0.55, "se": 0.20, "n_obs": 45},
        {"effect": 0.12, "se": 0.04, "n_obs": 200},
    ],
}

submit_resp = requests.post("https://api.maive.eu/v1/runs", json=submit_body, timeout=30)
submit_resp.raise_for_status()
job_id = submit_resp.json()["jobId"]
print("jobId:", job_id)

terminal_statuses = {"succeeded", "failed", "timedout"}
while True:
    run = requests.get(f"https://api.maive.eu/v1/runs/{job_id}", timeout=30).json()
    print("status:", run["status"])
    if run["status"] in terminal_statuses:
        break
    time.sleep(3)

if run["status"] == "succeeded":
    print(run["result"])
else:
    raise RuntimeError(run.get("errorMessage"))
```

Batch status for multiple runs at once (no results, just status): `GET
/v1/runs?ids=jobId1,jobId2,jobId3` (max 100 ids).

## `jobId` semantics

`jobId` is an **opaque bearer token**, not a user- or account-scoped
identifier. Anyone holding a `jobId` can read that run's status and result;
the same exposure model the MAIVE UI's own async runs already use. Treat it
like a share link:

- Don't submit data you wouldn't want visible to whoever might obtain the
  `jobId`.
- Results and job records **expire after 48 hours**; `GET
  /v1/runs/{jobId}` returns `404 not_found` after that.

## Privacy

- Requests are anonymous: no accounts, no identity is collected.
- Synchronous runs are stateless; nothing is persisted beyond the response.
- Asynchronous runs persist the submitted parameters and the result in the
  run store for up to 48 hours, keyed by `jobId`, then expire automatically.
  The input dataset itself is not persisted beyond the transient queue
  message used to dispatch the run.
- **Do not submit confidential or personally identifiable data.** The API has
  no data-classification or redaction layer; treat every request the same
  way you'd treat a request to any other unauthenticated public web service.

## Rate limits & errors

Two independent guardrails apply, load-bearing in this order:

1. A hard concurrency cap on the compute backend; once saturated, further
   requests receive `429 rate_limited` regardless of entry path.
2. Per-IP rate limiting at the edge on `api.maive.eu` for casual abuse
   deterrence.

Both are documented starting points and may be tuned based on observed load
Treat any `429` as "retry with backoff," not a hard quota. Datasets that
are too large to queue asynchronously (roughly 200KB of JSON) get `413
payload_too_large` pointing you at the synchronous endpoint instead.

All errors share one envelope:

```json
{ "error": { "code": "validation_error", "message": "Data must have 3 or 4 columns; found 6." } }
```

See [`docs/api/openapi.yaml`](api/openapi.yaml) for the full list of error
codes and every schema referenced above.

## Citation

If you use MAIVE in published or reported work, please cite:

> Irsova, Z., Bom, P.R.D., Havranek, T., & Rachinger, H. (2025). Spurious
> precision in meta-analysis of observational research. Nature
> Communications, 16, 8454. https://doi.org/10.1038/s41467-025-63261-0

## See also

- [`docs/api/openapi.yaml`](api/openapi.yaml): the OpenAPI 3 contract
  (source of truth).
- [`PUBLIC_API_DESIGN.md`](PUBLIC_API_DESIGN.md): the design doc this API is
  scoped from, including rollout phases and abuse/cost controls.
- [`SERVER_SIDE_API_ARCHITECTURE.md`](SERVER_SIDE_API_ARCHITECTURE.md):
  current serving topology (UI Lambda, R Lambda, Cloudflare).
- [`ASYNC_RUNS_DESIGN.md`](ASYNC_RUNS_DESIGN.md): the async runs
  infrastructure this API's `/v1/runs*` routes wrap.
