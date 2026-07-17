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
request can occupy a 2 GB Lambda for up to 600 s. The controls below bound what
that adds up to.

## The layers

| Layer | Where | What it bounds |
|---|---|---|
| Reserved concurrency = 10 (R backend) | `prod-runtime/variables.tf` (`lambda_r_backend_reserved_concurrency`) | Concurrent R executions, regardless of entry path. Excess gets `429`. Bounds the *rate* of spend (~$0.12/hr per slot). |
| Reserved concurrency = 30 (UI) | `prod-runtime/variables.tf` (`ui_lambda_reserved_concurrency`) | UI Lambda spend and its share of the account concurrency pool. |
| Async fan-out = 5 | `prod-runtime/orchestrator_lambda.tf` (`maximum_concurrency`) | Concurrent async runs; kept below the R cap so async never starves sync. |
| Max dataset rows = 50,000 | R `api_v1.R` / `index.R` (`MAX_INPUT_ROWS`), UI `datasetValidation.ts` (`MAX_ROWS`) | Per-request work; caps payload-driven CPU/output amplification on every HTTP route including the raw legacy path. |
| **Cost circuit breaker** | `prod-runtime/circuit_breaker.tf` | The **monthly total**. Auto-throttles the R backend to 0 on sustained abuse. |
| Budget notifications ($10, 50/80/forecast) | `prod-foundation/budget.tf` | Human awareness; email backstop. |
| Cost Anomaly Detection | `prod-foundation/cost_anomaly.tf` | Human awareness; faster/smarter than a fixed threshold. |
| Alarm notifications (errors/throttles/duration/DLQ) | `prod-runtime/monitoring.tf` + the alarms | Human awareness; previously these alarms notified no one. |

Reserved concurrency bounds the *rate* of spend but not the *total*: 10 slots
pinned at 2 GB around the clock is still ~$860/month. The circuit breaker is what
turns the rate limit into an enforced ceiling.

## The cost circuit breaker

The free equivalent of AWS Budgets Actions (a paid feature). Wiring:

```
R backend throttling (sustained) → CloudWatch alarm → SNS → kill-switch Lambda
                                                              → PutFunctionConcurrency(R backend, 0)
```

- **Trigger:** the `-saturation` alarm fires when the R backend throttles
  continuously for `cost_circuit_breaker_throttle_periods` 5-minute periods
  (default 6 ≈ 30 min). Throttling only happens when demand exceeds the
  reserved-concurrency cap, so sustained throttling is a strong abuse signal with
  a near-zero false-positive rate for a low-traffic site.
- **Action:** the kill-switch Lambda (`apps/kill-switch/index.mjs`) sets the R
  backend's reserved concurrency to 0. Every further invocation then throttles
  (`429`) and compute spend stops. The worst-case bleed before it trips is ~30
  min × 10 slots ≈ well under $1 per episode.
- **Notification:** the same alarm emails `var.email` (via the circuit-breaker
  SNS topic), so an operator knows the service was shut off.
- **Toggle:** `cost_circuit_breaker_enabled` (default `true`). When `false`, the
  condition still emails but no automatic shutoff happens.

### Recovery (deliberate, never automatic)

When the breaker trips, analysis is down (the site's pages still load; runs
return `429`). Recovery is a conscious operator action, after confirming the
abusive traffic has stopped (e.g. blocked at Cloudflare):

1. Confirm the source of load has stopped.
2. Restore the cap, either:
   - `cd terraform/stacks/prod-runtime && terragrunt apply` (resets reserved
     concurrency to `lambda_r_backend_reserved_concurrency`), or
   - Lambda console → `maive-lambda-r-backend` → Configuration → Concurrency →
     set reserved concurrency back to 10.

Note: because the Lambda sets concurrency out of band, Terraform state shows
drift (it wants 10, actual is 0) until the next apply reconciles it. That is
expected.

## What this does and does not guarantee

- **Does:** stop runaway compute automatically and bound each abuse episode to
  well under a dollar. Keep expected spend in the cents.
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
