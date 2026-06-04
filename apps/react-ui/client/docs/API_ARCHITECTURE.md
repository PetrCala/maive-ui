# API Architecture - Serverless Implementation

## Overview

This document describes how the React UI communicates with the R-Plumber backend
in the current **serverless** deployment. The UI and the R backend each run as an
AWS Lambda function exposed via a Lambda Function URL. There is no ALB, ECS task,
or VPC private subnet in the serving path anymore.

## Request Topology

```plain
Browser ──► Cloudflare (CDN/TLS/WAF) ──► UI Lambda Function URL (Next.js)
   │
   └──────► R Lambda Function URL (Plumber)   ← heavy /run-model call, direct
```

- **UI** runs on Lambda via a container image using the AWS Lambda Web Adapter,
  fronted by Cloudflare. A Cloudflare Worker rewrites the `Host`/SNI to the
  `.on.aws` origin because Lambda Function URLs reject a foreign `Host` header.
- **R backend** is a public Lambda Function URL (authorization `NONE`, CORS `*`).
- The **`/run-model`** analysis request goes straight from the browser to the R
  Lambda — it no longer proxies through a Next.js API route.

## How It Works

### Resolving the R backend URL

The R URL is provided to the browser at request time via `/api/runtime-config`,
which sets `window.RUNTIME_CONFIG`:

```typescript
// src/pages/api/runtime-config.ts (server-side)
const rApiUrl =
  process.env.NEXT_PUBLIC_R_API_URL ?? process.env.R_API_URL ?? "";
// → window.RUNTIME_CONFIG = { R_API_URL: rApiUrl }
```

`getRApiUrl()` resolves this on the client (from `window.RUNTIME_CONFIG`, falling
back to `NEXT_PUBLIC_DEV_R_API_URL` / `localhost:8787` in development).

### Calling the backend

`modelService` is isomorphic and POSTs directly to the resolved R URL:

```typescript
// src/api/services/modelService.ts
return await httpPost<ModelResponse>(`${getRApiUrl()}/run-model`, requestData, {
  timeout: 300000, // 5 minutes for long-running models
});
```

## Architecture Components

### Isomorphic Services (`/src/api/services/`)

- **`modelService.ts`** — POSTs analysis requests to the R backend. In the
  browser this hits the R Lambda Function URL directly.
- **`pingService.ts`** — connectivity check against the R backend.

### Next.js API Routes (`/src/pages/api/`)

Lightweight routes that run server-side inside the UI Lambda:

- **`/api/runtime-config`** — exposes the R backend URL to the browser
- **`/api/ping`** — connectivity testing
- **`/api/get-version-info`**, **`/api/system-status`** — metadata

> The previous **`/api/run-model`** proxy route has been removed.

## Environment Configuration

```bash
# Production (UI Lambda) — public R Lambda Function URL exposed to the browser
R_API_URL=https://<r-lambda-id>.lambda-url.<region>.on.aws
# NEXT_PUBLIC_R_API_URL is also honored (takes precedence if set)

# Development
NEXT_PUBLIC_DEV_R_API_URL=http://localhost:8787
```

## Testing

1. **Runtime config**: confirm `/api/runtime-config` returns a non-empty
   `R_API_URL` and that `window.RUNTIME_CONFIG` is populated.
2. **Ping test**: use the ping button to verify connectivity.
3. **Model execution**: run a model to verify the direct browser → R Lambda call.
4. **Network inspection**: confirm `/run-model` goes to the `.on.aws` R URL, not
   to a `/api/*` route.

## Troubleshooting

### Common Issues

1. **Empty R URL**: ensure `R_API_URL` / `NEXT_PUBLIC_R_API_URL` is set on the UI
   Lambda.
2. **CORS errors**: the R Lambda Function URL must allow CORS (`*`) and use
   authorization `NONE` for direct browser calls.
3. **403 from origin**: check the Cloudflare Worker is rewriting the `Host`/SNI to
   the `.on.aws` origin.
4. **Service health**: confirm the R Lambda is reachable (cold starts can make the
   first request slow).
