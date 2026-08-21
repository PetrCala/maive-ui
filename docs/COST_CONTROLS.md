# Cost controls & denial-of-wallet protection

MAIVE runs on a fully serverless, anonymous, publicly reachable stack (two
Lambda Function URLs with `authorization_type = "NONE"`). Expected spend at the
site's real traffic is a few cents a month. This document describes the controls
that bound worst-case spend when someone deliberately tries to run up the bill.

See also `PUBLIC_API_DESIGN.md` §7 (the original abuse/cost analysis) and
`SERVER_SIDE_API_ARCHITECTURE.md` (topology).

## Threat: denial of wallet

The R backend is reachable directly at its raw `*.on.aws` Function URL (the
browser is handed that URL via `/api/runtime-config`), so Cloudflare's edge rate
limit is a speed bump, not a wall: an attacker can hit Lambda directly. One
request can occupy a 3.5 GB Lambda for up to 600 s. The controls below bound what
that adds up to.

## The layers

| Layer | Where | What it bounds |
|---|---|---|
| Reserved concurrency = 10 (R backend) | `prod-runtime/variables.tf` (`lambda_r_backend_reserved_concurrency`) | Concurrent R executions, regardless of entry path. Excess gets `429`. Bounds the *rate* of spend (~$0.21/hr per slot). |
| Reserved concurrency = 30 (UI) | `prod-runtime/variables.tf` (`ui_lambda_reserved_concurrency`) | UI Lambda spend and its share of the account concurrency pool. |
| Async fan-out = 5 | `prod-runtime/orchestrator_lambda.tf` (`maximum_concurrency`) | Concurrent async runs; kept below the R cap so async never starves sync. |
| Max dataset rows = 50,000 | R `api_v1.R` / `index.R` (`MAX_INPUT_ROWS`), UI `datasetValidation.ts` (`MAX_ROWS`) | Per-request work; caps payload-driven CPU/output amplification on every HTTP route including the raw legacy path. |
| Request wall-clock budget = 120 s default, 570 s max | R `request_bounds.R` (`timeoutSeconds`) | How long any model request can hold a slot. The whole handler runs in a forked child the server kills at the deadline, Stan workers and bootstrap forks included, and the caller gets a structured `code: "timeout"` error instead of a dropped connection (#526). Interactive requests (UI, public `/v1`) get the 120 s default; the async orchestrator requests the 570 s maximum, still under the 600 s function timeout. |
| RTMA fit budget = request budget minus 10 s | R `rtma_model.R` (`RTMA_FIT_HEADROOM_SEC`) | The RTMA fit's own child-process kill, kept inside the request budget so the fit-specific timeout message reaches the caller before the request-level backstop fires (#521, #526). Standalone use (reproducibility packages) keeps the old 480 s default. |
| **Cost circuit breaker** | `prod-runtime/circuit_breaker.tf` | The **monthly total**. Auto-degrades the R backend to a reserved concurrency of 2 on sustained abuse and turns on the unstable banner. |
| Daily GB-seconds alarm (13,000 GB-s/day) | `prod-runtime/circuit_breaker.tf` (`lambda_daily_gb_seconds_budget`) | The **daily compute total**, measured in the free tier's own unit (400k GB-s/month, so ~1/30 per day). Metric math over Sum(Duration) x memory across the Lambdas; publishes to the circuit-breaker topic, so it pages and (when enabled) trips the breaker (#533). |
| Budget notifications ($10, 50/80/forecast) | `prod-foundation/budget.tf` | Human awareness; email backstop. |
| Cost Anomaly Detection | `prod-foundation/cost_anomaly.tf` | Human awareness; catches deviation from baseline rather than a fixed threshold. Daily digest, on ~24h-lagged billing data. |
| Alarm notifications (errors/throttles/duration/DLQ) | `prod-runtime/monitoring.tf` + the alarms | Human awareness; previously these alarms notified no one. |

Reserved concurrency bounds the *rate* of spend but not the *total*: 10 slots
pinned at 3.5 GB around the clock is still ~$1,490/month. The circuit breaker is
what turns the rate limit into an enforced ceiling.

That ceiling rose by ~73% when the R backend went from 2048 MB to 3538 MB to get
a second vCPU for RTMA's Stan chains (#483). Nothing needed retuning: the breaker
trips on sustained *throttling*, not on a dollar figure, so it enforces the same
concurrency ceiling at any memory size, and the $10 budget notification simply
arrives sooner. The number that rose is the worst case, where an attacker pins
every slot for the full 600 s. Ordinary runs got *cheaper*, because RTMA now
finishes in roughly half the time at 1.73x the memory rate.

## The cost circuit breaker

The free equivalent of AWS Budgets Actions (a paid feature). Wiring:

```
R backend throttling (sustained) → CloudWatch alarm → SNS → kill-switch Lambda
                                                              → PutFunctionConcurrency(R backend, 2)
                                                              → PutParameter(unstable_banner_*, on)
```

- **Trigger:** the `-saturation` alarm fires when the R backend throttles
  continuously for `cost_circuit_breaker_throttle_periods` 5-minute periods
  (default 6 ≈ 30 min). Throttling only happens when demand exceeds the
  reserved-concurrency cap, so sustained throttling is a strong abuse signal with
  a near-zero false-positive rate for a low-traffic site.
- **Second trigger (daily compute budget):** the `-lambda-daily-gb-seconds`
  alarm publishes to the same topic when total Lambda compute across the day
  crosses `lambda_daily_gb_seconds_budget` (default 13,000 GB-s, ~1/30 of the
  400k GB-s monthly free tier). The Aug 15 incident burned ~139k GB-s in a day
  without tripping the saturation alarm: a spend spike that never saturates the
  concurrency cap for 30 straight minutes is invisible to it (#533).
- **Action:** the kill-switch Lambda (`apps/kill-switch/index.mjs`) degrades
  rather than kills. It lowers the R backend's reserved concurrency to
  `cost_circuit_breaker_degraded_concurrency` (default 2, never 0), so the
  service stays usable while demand beyond the two slots throttles (`429`) and
  the spend rate drops to ~$0.42/hr worst case. It also flips the
  `/maive/ui/unstable_banner_*` SSM parameters so the UI shows users a
  reduced-capacity notice (see `unstable-release-banner.md`). The worst-case
  bleed before it trips is ~30 min × 10 slots ≈ well under $1 per episode.
- **Notification:** the same alarm emails `var.email` (via the circuit-breaker
  SNS topic), so an operator knows the service was degraded.
- **Toggle:** `cost_circuit_breaker_enabled` (default `true`). When `false`, the
  condition still emails but no automatic degradation happens.

### Recovery (deliberate, never automatic)

When the breaker trips, analysis runs at reduced capacity (two concurrent
slots; excess runs return `429`) and the UI shows the unstable banner. Recovery
is a conscious operator action, after confirming the abusive traffic has
stopped (e.g. blocked at Cloudflare):

1. Confirm the source of load has stopped.
2. Restore the cap, either:
   - `cd terraform/stacks/prod-runtime && terragrunt apply` (resets reserved
     concurrency to `lambda_r_backend_reserved_concurrency` and turns the
     banner back off), or
   - Lambda console → `maive-lambda-r-backend` → Configuration → Concurrency →
     set reserved concurrency back to 10, then set the
     `/maive/ui/unstable_banner_enabled` SSM parameter back to `false`.

Note: because the Lambda sets concurrency and the banner out of band, Terraform
state shows drift (it wants 10 and a disabled banner, actual is 2 and enabled)
until the next apply reconciles it. That is expected.

## What this does and does not guarantee

- **Does:** cut runaway compute automatically to a trickle (two slots,
  ~$0.42/hr worst case) and bound each abuse episode to well under a dollar
  before the trip plus the degraded rate until an operator steps in. Keep
  expected spend in the cents.
- **Does not:** give a hard, instant monthly cap. AWS has no native "stop at
  $X." All spend-based signals (budgets, anomaly detection) lag AWS billing data
  by up to a day, which is why the primary automatic control keys off the
  in-region throttle metric (minutes, not a day) instead. A determined attacker
  could still incur a small, bounded cost per episode before the breaker trips
  and before an operator restores service.

## Tuning

- Raise `lambda_r_backend_reserved_concurrency` (and `maximum_concurrency`
  together) if legitimate traffic grows and the throttle alarm fires on real
  load. Each unit is ~$0.12/hr (~$86/month) of worst-case exposure.
- Raise `ui_lambda_reserved_concurrency` if the UI throttles under real traffic.
- Adjust `cost_circuit_breaker_throttle_periods` to trade sensitivity against
  false positives.
