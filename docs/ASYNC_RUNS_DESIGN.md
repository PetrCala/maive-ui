# Async Model Runs — Design & Implementation Plan

**Status:** Proposed (scope locked, pre-implementation)
**Date:** 2026-06-04
**Related:** issue [#441](https://github.com/PetrCala/maive-ui/issues/441) (RTMA feature request, where async was first discussed); PR [#451](https://github.com/PetrCala/maive-ui/pull/451) (RTMA, merged)

> This document is the scope of record for adding **non-blocking model runs and a
> per-browser runs queue/history** to the MAIVE UI. It is meant to be reviewed and
> agreed before any implementation starts. Decisions in §4 are considered locked.

---

## 1. Motivation & background

Today, running a model **blocks** the user: the browser POSTs to the R backend and
waits on a spinner until results return. We want users to **submit a run, keep using
the app, and come back later** to a **queue/history of their runs** they can monitor,
revisit, and compare.

Benchmarking during the RTMA work (#441/#451) showed that, on realistic data, runs
are fast (full ~1,159-row dataset ≈ 15 s on one core; a live production RTMA run on
250 rows took ~63 s **including cold start**; pathological datasets are bounded by an
R-side 480 s wall-clock guard). So **async is primarily a UX / feature upgrade**
(queue, history, compare, never-lose-a-run) rather than a raw-performance fix, and is
scoped accordingly. Speeding up individual runs (cold-start mitigation, high-memory
parallelism) is a **separate track** (see §15).

This aligns with the direction agreed in #441 ("async/background runs now").

## 2. Goals / non-goals

**Goals**
- Submitting a run does not block interaction with the rest of the app.
- A per-browser **runs queue/history** the user can monitor, revisit, and compare.
- Robust handling of slow/pathological runs without a hung UI.
- Minimal, cheap infra; no change to the statistical/compute path (the R backend).

**Non-goals (this iteration)**
- User accounts / server-side identity.
- Email/SNS notifications.
- Eliminating Lambda cold starts (keep-warm / provisioned concurrency).
- Storing results in S3 (DynamoDB-only; S3 reserved as a future escape hatch).
- Server-side persistence of the input dataset.

## 3. Current architecture (as-is)

- **Fully serverless.** Two container Lambdas, each with a Function URL:
  - **UI Lambda** (`terraform/stacks/prod-runtime/ui_lambda.tf`): Next.js via the AWS
    Lambda Web Adapter, `timeout=30s`, fronted by **Cloudflare** (~100 s origin cap).
  - **R backend Lambda** (`terraform/stacks/prod-runtime/lambda.tf`): R Plumber via
    Lambda Web Adapter, Function URL (auth NONE, CORS `*`), `timeout=600s`,
    `memory_size=2048`. Routes in `apps/lambda-r-backend/r_scripts/index.R`.
- **The browser calls the R Function URL directly** for runs
  (`apps/react-ui/client/src/api/services/modelService.ts` → `${getRApiUrl()}/run-model|/run-rtma`),
  triggered in `apps/react-ui/client/src/pages/model/index.tsx`.
- **Results are passed entirely via URL query params**
  (`apps/react-ui/client/src/pages/results/index.tsx` reads `?results=&parameters=`),
  including the ~50 KB base64 plot — producing enormous, fragile URLs. **No run is
  persisted server-side.**
- **No async/queue infra exists** (no SQS, no app DynamoDB, no S3 results bucket). The
  only DynamoDB is the Terraform state-lock table. **No user accounts.**
- Deploy: merging a PR to `master` with a `release` label triggers
  `.github/workflows/release.yml`, which applies **only** `prod-runtime` via Terragrunt.
  `prod-foundation` is applied out of band (manual).

## 4. Locked decisions

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | **Worker invocation: SQS → thin orchestrator Lambda (Node 20) → existing R Function URL.** The R backend is unchanged. | The R image is an HTTP server behind the Lambda Web Adapter; an SQS event source or async SDK `Invoke` would not route to it without a risky runtime rewrite. The orchestrator isolates the brittle R image and gives retries/concurrency/DLQ for free. |
| D2 | **Result storage: DynamoDB-only, full result (~50 KB) stored inline; 48 h TTL.** No S3. | Result fits well under DynamoDB's 400 KB item limit. One store, minimal footprint. S3 reserved only if a payload ever exceeds ~400 KB. |
| D3 | **Durable history is client-side** (IndexedDB for result payloads, localStorage for the lightweight job list). The DynamoDB item is only a **48 h pickup buffer**. | Matches "persist it in the client's session"; minimizes server persistence. |
| D4 | **No auto-retry** (`maxReceiveCount=1` → DLQ; user re-runs explicitly). | MCMC is nondeterministic (a retry yields a different result) and pathological datasets just re-time-out, doubling cost. |
| D5 | **Keep the synchronous path as a flagged fallback** — and as the route for datasets too large to queue. | Instant rollback lever; avoids needing S3 input plumbing in Phase 1 (large datasets bypass the queue). |
| D6 | **Runs list is per-browser** (no accounts). `jobId` is an opaque bearer token; results readable by anyone holding the id. | No identity system exists; same sharing model as today's shareable results URL. |
| D7 | **Status delivery via short polling** (status-only reads; full result fetched once when terminal). No SSE/WebSocket. | Simple; fast handlers; avoids Lambda/Cloudflare long-connection issues. |
| D8 | **Dark launch behind `CONFIG.ASYNC_RUNS_ENABLED`** (off by default, like `RTMA_ENABLED`). | Ship without exposure; flip on after verification; flip off to roll back. |

## 5. Target architecture (to-be)

```
  Browser                         UI Lambda (Next.js API)        AWS                         R backend Lambda
  -------                         -----------------------        ---                         ----------------
  submit run  ── POST /api/runs ─►  write DDB {queued}
                                     send SQS message ───────►  SQS ──► Orchestrator Lambda ── POST /run-(model|rtma) ─► (compute)
  (free to navigate away)                                                 mark {running} in DDB
                                                                          on done: write {succeeded,result} / {failed} / {timedout}
  poll  ── GET /api/runs/{id} ───►  read DDB (status proj.)
  (renders when ready) ◄────────── status; result when terminal
  cache result in IndexedDB; jobId in localStorage history
```

**Why the orchestrator (D1), rejected alternatives:**
- *SQS event source directly on the R Lambda* — would require replacing the Lambda Web
  Adapter with a native R runtime loop and re-plumbing request parsing in the rstan
  image. Too invasive/risky.
- *Submit endpoint async-`Invoke`s the R Lambda* — same HTTP-handler-vs-raw-event
  mismatch, and no clean place to persist terminal status; loses SQS visibility/DLQ.

## 6. Data model

**DynamoDB table `maive-runs`** (single item per job, on-demand billing, TTL on `ttl`):

| attr | type | notes |
|------|------|-------|
| `jobId` (PK) | S | opaque ULID/uuid; also the unguessable share token |
| `status` | S | `queued` \| `running` \| `succeeded` \| `failed` \| `timedout` |
| `modelType` | S | `MAIVE` \| `WAIVE` \| `WLS` \| `RTMA` (history label) |
| `parameters` | S (JSON) | parameters used (small) |
| `dataId` | S | links to the browser's local dataset (not the data itself) |
| `result` | S (JSON) | full result incl. base64 plot; set on success (~50 KB) |
| `errorMessage` | S | set on failure |
| `submittedAt` / `startedAt` / `finishedAt` | N | epoch ms |
| `runDurationMs` | N | for display |
| `ttl` | N | epoch seconds = `finishedAt`/`submittedAt` + 48 h (DDB auto-delete) |

**Status lifecycle:** `queued` (submit) → `running` (orchestrator) → terminal
(`succeeded` / `failed` / `timedout`). The R 480 s-guard error maps to `timedout`.

**Client stores:**
- `localStorage` — `runsStore` (Zustand `persist`): list of `{jobId, modelType, dataId, submittedAt}`.
- `IndexedDB` — cache of fetched result payloads (durable history; localStorage is too small for ~50 KB plots).

## 7. API surface (Next.js routes in the UI Lambda)

All handlers are fast (DDB/SQS calls), so the UI Lambda's 30 s cap is irrelevant.

- `POST /api/runs` — body `{ data, parameters, dataId, modelType }`. Generate `jobId`,
  write DDB `queued`, send SQS message, return `{ jobId }`. If `data` exceeds the SQS
  body budget (~200 KB), return a signal to use the **synchronous fallback** (D5).
- `GET /api/runs/{jobId}` — DDB GetItem with a **status-only projection** for polling;
  returns the full `result` once `status` is terminal.
- *(Phase 2)* `GET /api/runs?ids=...` — DDB BatchGetItem of statuses for the history list.

## 8. Phase 1 — MVP "fire-and-poll" (scope)

**Terraform — `prod-runtime`** (suggested new files `runs_store.tf`, `runs_queue.tf`, `orchestrator_lambda.tf`):
- [ ] `aws_dynamodb_table.runs` — PK `jobId`, `PAY_PER_REQUEST`, TTL on `ttl`.
- [ ] `aws_sqs_queue.runs` (visibility ~660 s) + `aws_sqs_queue.runs_dlq` (redrive `maxReceiveCount=1`).
- [ ] `aws_lambda_function.orchestrator` (Node 20, zip) + IAM role/policy (SQS consume, DDB update/get) + `aws_lambda_event_source_mapping` (SQS, `maximum_concurrency` capped) + log group + DLQ-depth alarm.
- [ ] Set `lambda_r_backend_reserved_concurrency` to a real cap (start ~5).
- [ ] Extend `ui_lambda.tf`: env (`RUNS_TABLE_NAME`, `RUNS_QUEUE_URL`) + IAM (DDB get/put/batchGet/query, SQS send).

**Terraform — `prod-foundation`** (manual apply, must precede the runtime apply):
- [ ] Extend `gha_terraform_policy` (`iam.tf`): add `sqs:*`; broaden DynamoDB to include `Query`, `UpdateItem`, `BatchGetItem`, `BatchWriteItem`, `Scan`.

**Orchestrator Lambda (Node 20, zip):**
- [ ] SQS consumer: mark `running` → `fetch` R Function URL `/run-(model|rtma)` → on success write `succeeded` + `result`; on error write `failed`/`timedout`.
- [ ] Idempotency: no-op if the DDB item is already terminal.
- [ ] Map the R 480 s-guard / fetch timeout to `timedout`.

**UI:**
- [ ] `modelService`: add `submitRun` (POST /api/runs) + `getRun` (GET /api/runs/{id}); keep `runModel`/`runRTMA` (sync) behind the flag.
- [ ] `model/index.tsx`: submit-and-go (no blocking); fall back to sync for >256 KB datasets; keep `shouldUseMockResults` dev path working in both modes.
- [ ] `results/index.tsx`: add `?jobId=` poll-and-fetch path; **keep** the URL-param path as fallback (additive).
- [ ] `runsStore` (Zustand `persist`) + IndexedDB result cache + a `useRunStatus` polling hook (2 s, backing off to 5 s).
- [ ] `CONFIG.ASYNC_RUNS_ENABLED` flag (default off).

**Outcome:** submit → don't block → return to *this* run; mega-URL problem fixed.

## 9. Phase 2 — runs queue/history, compare, notifications (later)

- [ ] **Runs/History page**: list the browser's runs with live status (batch endpoint), filter, re-open.
- [ ] **Compare view**: select 2+ succeeded runs, render side-by-side (reuse `ResultsSummary` / `RTMAResultsSummary`).
- [ ] **Browser Web Notifications** on completion (request permission lazily on first submit).
- [ ] Optional: remove the synchronous path once async is proven; tune concurrency from observed load.

## 10. Concurrency, limits & failure handling

- **Reserved concurrency** on the R Lambda (start ~5); orchestrator event-source
  `maximum_concurrency` set to match so it never out-calls the R cap (avoids 429s).
- **SQS visibility timeout** (~660 s) > R Lambda max work time (600 s) to avoid mid-run redelivery.
- **No auto-retry** (D4): `maxReceiveCount=1` → DLQ; CloudWatch alarm on DLQ depth.
- **SQS 256 KB message limit**: datasets above the budget use the synchronous fallback (D5);
  the S3 input-pointer escape hatch is deferred (see §15).

## 11. Privacy & security

- **New:** results persist server-side for up to **48 h** (today nothing persists).
  Mitigations: DynamoDB item is private (reachable only via the UI Lambda routes),
  random opaque `jobId`, 48 h TTL auto-delete.
- The **input dataset is not persisted at rest** — it travels only in the transient
  (encrypted, auto-deleted on consume) SQS message.
- `jobId` is a **bearer token**: anyone with it can read that run for 48 h — same
  exposure model as today's shareable results URL. Document in user-facing privacy notes.
- Clearing browser data loses the local history list (accepted, per D3/D6); results
  not yet fetched by the client are lost after the 48 h server TTL (accepted).

## 12. Cost

New infra is negligible — **async adds no model compute**; the R Lambda runs as much
as today. Approximate (on-demand; eu-central-1 ~a few % above us-east-1):

- **Per run (new infra only):** ~$0.0003–0.0005 (orchestrator idle-wait dominates; DDB/SQS/UI-poll are sub-cent).
- **Idle baseline:** ~$0.05–0.20 / month (mostly SQS event-source long-polling).
- **At volume:** ~$0.5–1 / month at 1k runs; ~$3–5 / month at 10k runs. Low volume is largely covered by AWS free tiers (effectively $0).
- The dominant cost remains the **pre-existing** R compute (~$0.001–0.002 / run at 2 GB).
- **Not in scope, but flagged:** keep-warm / provisioned concurrency (speed track) would
  cost ~$22 / month per always-warm 2 GB instance.

## 13. Rollout plan

1. Build Phase 1 on a fresh branch, **behind `ASYNC_RUNS_ENABLED` (off)** — ships dark.
2. Open PR(s); review.
3. **Manually apply `prod-foundation`** (IAM additions) — must precede the runtime apply.
4. Merge with `release` label → CI applies `prod-runtime` (creates DDB/SQS/orchestrator, updates UI Lambda).
5. Flip `ASYNC_RUNS_ENABLED` on → smoke-test (submit, navigate away, return, verify history/result).
6. Monitor DLQ-depth alarm + CloudWatch.
7. **Rollback:** flip the flag off — the synchronous path remains fully functional.

## 14. Risks & open questions

- **Orchestrator idle double-billing** while R runs — minor at 256 MB.
- **Result > 400 KB** (e.g., higher-resolution plots) → would need the S3 escape hatch (§15).
- **Un-fetched run expires after 48 h** on a device that never synced — accepted trade-off.
- **Concurrency cap** (~5) is a starting guess — tune from observed load/cost.
- **R backend log verbosity** (debug-level, verbose `cli` output) is pre-existing; worth
  trimming someday to control CloudWatch ingestion, but out of scope here.

## 15. Out of scope / future

- **S3 escape hatch** for >256 KB inputs and/or >400 KB results (deferred; sync path covers large inputs for now).
- **Speed track:** cold-start mitigation (keep-warm / provisioned concurrency; check SnapStart eligibility) and a high-memory `parallelize=TRUE` re-benchmark for the slow tail.
- **Accounts / cross-device history**, **email/SNS notifications**, **SSE/WebSocket push**.
