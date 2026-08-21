# API Architecture: Serverless Design

## Overview

This document explains how the MAIVE UI talks to the R backend in the current
**fully serverless** deployment. Both the Next.js UI and the R-Plumber backend
run as AWS Lambda functions, each exposed through a Lambda Function URL. The
R backend's Function URL requires **IAM auth** (`AWS_IAM`, no CORS): the
browser never calls it. Every analysis request goes through a same-origin
Next.js proxy route that SigV4-signs the upstream call.

> **History:** the app has been through three topologies. First an R service in
> a private subnet behind an ALB on ECS/Fargate, reached only through Next.js
> API routes. Then a public R Function URL (auth `NONE`, CORS `*`) that the
> browser called directly, with the URL handed out at request time via a
> `/api/runtime-config` route and `NEXT_PUBLIC_R_API_URL`. Since #530 the
> Function URL is IAM-protected and all calls are signed server-side; the
> runtime-config route and `NEXT_PUBLIC_R_API_URL` are gone.

## Architecture Overview

```
                      ┌──────────────────────────────────────┐
   ┌─────────────┐    │       Cloudflare (CDN/TLS/WAF)        │
   │ User Browser│───►│ Worker rewrites Host/SNI to .on.aws   │
   └─────────────┘    │ api.maive.eu path-routes /v1          │
                      └──────────────────────────────────────┘
                                       │
                                       ▼
                       ┌────────────────────────────────┐
                       │  UI Lambda Function URL          │
                       │  (Next.js via Lambda Web Adapter)│
                       │  /api/run-model, /api/run-rtma,  │
                       │  /api/v1/*, /api/runs*, ...      │
                       └────────────────────────────────┘
                             │ SigV4-signed          ▲
                             ▼                       │ SigV4-signed
                       ┌────────────────────────────────┐
                       │  R Lambda Function URL           │
                       │  (Plumber; auth AWS_IAM, no CORS)│◄── orchestrator Lambda
                       └────────────────────────────────┘    (async runs queue)
```

**Key facts:**

- The Next.js UI runs on AWS Lambda using a container image with the
  [AWS Lambda Web Adapter](https://github.com/awslabs/aws-lambda-web-adapter),
  exposed through a Lambda Function URL.
- Cloudflare fronts the UI for CDN, TLS, and WAF. Because Lambda Function URLs
  reject requests carrying a foreign `Host` header, a Cloudflare Worker rewrites
  the `Host`/SNI to the `.on.aws` origin.
- The R backend is a separate Lambda Function URL with authorization
  **`AWS_IAM`** and no CORS. Only the UI Lambda's execution role and the
  orchestrator Lambda hold `lambda:InvokeFunctionUrl` on it, and both SigV4-sign
  their requests (#530).
- The browser only ever talks to same-origin `/api/*` routes. Analysis requests
  go to `/api/run-model` / `/api/run-rtma`; the Next.js server signs and
  forwards them to the R Lambda (`src/api/server/rBackendProxy.ts`) and relays
  the response verbatim.
- The public `/v1` API is proxied the same way: the `api.maive.eu` Worker sends
  `/v1/run-model`, `/v1/run-rtma` and `/v1/health` to the UI Lambda's
  `/api/v1/*` catch-all route, which signs and forwards 1:1 to the R backend's
  own `/v1` handlers. `/v1/runs*` is served by dedicated Next.js routes on top
  of the async queue (DynamoDB + SQS + orchestrator).

## How Requests Reach the R Backend

### 1. The browser posts to a same-origin route

```typescript
// src/api/services/modelService.ts (isomorphic, but the browser path)
return await httpPost<ModelResponse>("/api/run-model", requestData, { ... });
```

### 2. The route signs and forwards

`proxyToRBackend()` (`src/api/server/rBackendProxy.ts`) fetches the R Function
URL with SigV4 headers derived from the UI Lambda's execution-role credentials.
Local development targets (localhost, containers) are not Function URLs and are
called unsigned.

### 3. The R URL is server-only

`getRApiUrl()` (`src/api/utils/config.ts`) resolves the R backend URL from
`R_API_URL` and **throws if called in the browser**. There is no runtime config
route and no `NEXT_PUBLIC_R_API_URL`; the compute endpoint is never exposed to
the client. In development it falls back to `NEXT_PUBLIC_DEV_R_API_URL` or
`http://localhost:8787`.

## What Runs Server-Side

All Next.js API routes execute in the UI Lambda:

- `/api/run-model`, `/api/run-rtma`: signed synchronous proxies to the R Lambda
  (wrapped in the run-record/dedup layer, #529)
- `/api/runs`, `/api/runs/{jobId}`: async run submit/poll (DynamoDB + SQS)
- `/api/v1/*`: public API surface (signed sync proxy + async runs re-skins)
- `/api/ping`, `/api/health`, `/api/get-version-info`, `/api/system-status`:
  connectivity and metadata

## Environment Configuration

### Development

- R service runs on `localhost:8787`.
- `NEXT_PUBLIC_DEV_R_API_URL` overrides the local R URL if set.

### Production

- `R_API_URL` on the UI Lambda (and the orchestrator) holds the IAM-protected
  R Lambda Function URL. It is server-only; the browser never sees it.

## Domains

- `easymeta.org` is the canonical address. It and `maive.eu` (apex + `www` on
  both) are proxied through Cloudflare and serve the app.
- `spuriousprecision.com` (apex + `www`) 301-redirects to `easymeta.org`.
- `api.maive.eu` is the public API hostname.

## Trade-offs

- **Simplicity / cost:** no ALB, ECS cluster, or NAT, just two Lambdas (plus a
  small orchestrator) and a CDN. Scales to zero when idle.
- **Security:** the compute endpoint is not publicly invokable. Reaching it
  requires a SigV4 signature from a role that holds `lambda:InvokeFunctionUrl`,
  so abuse control does not depend on the URL staying obscure.
- **Proxy in the request path:** synchronous analysis calls now ride through
  the UI Lambda, which bills for the wait and bounds the call at
  `PROXY_FETCH_TIMEOUT_MS` (170 s, just under the UI Lambda's 180 s timeout).
  Long-running work belongs on the async queue, which the orchestrator drives
  with the R backend's full background budget.
- **Edge cap on proxied sync runs:** requests that arrive through Cloudflare
  (the app domains and `api.maive.eu`) are subject to its ~100 s origin
  response cap. A sync `/v1` run that outlives it gets an HTML 504 from
  Cloudflare while the Lambda finishes (and bills) behind it, so the backend's
  structured timeout payload never reaches the caller. The docs steer `/v1`
  users to the async endpoints for anything that might run long.
- **Cold starts:** Lambda cold starts can make the first analysis run slow; the
  UI shows a "warming up" hint during slow model runs.
