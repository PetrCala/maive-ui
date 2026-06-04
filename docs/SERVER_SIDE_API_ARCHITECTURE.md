# API Architecture: Serverless Design

## Overview

This document explains how the MAIVE UI talks to the R backend in the current
**fully serverless** deployment. The application no longer runs behind an ALB
on ECS/Fargate, and there is no VPC public/private-subnet serving path. Both the
Next.js UI and the R-Plumber backend run as AWS Lambda functions, each exposed
through a Lambda Function URL.

> **History:** an earlier design proxied every analysis request through Next.js
> API routes so that an R service in a private subnet was never exposed to the
> public internet. That VPC/ALB topology has been retired. The heavy
> `/run-model` call now goes directly from the browser to the R Lambda.

## Architecture Overview

```
                      ┌──────────────────────────────────┐
   ┌─────────────┐    │      Cloudflare (CDN/TLS/WAF)     │
   │ User Browser│───►│  Worker rewrites Host/SNI to .on.aws│
   └─────────────┘    └──────────────────────────────────┘
        │  │                          │
        │  │                          ▼
        │  │              ┌────────────────────────────┐
        │  │              │  UI Lambda Function URL      │
        │  │              │  (Next.js via Lambda Web      │
        │  │              │   Adapter; lightweight        │
        │  │              │   /api/* routes)              │
        │  │              └────────────────────────────┘
        │  │
        │  └─ /api/runtime-config ──► returns window.RUNTIME_CONFIG.R_API_URL
        │
        └──── POST /run-model (data + parameters) ──────────────┐
                                                                ▼
                                            ┌────────────────────────────┐
                                            │  R Lambda Function URL       │
                                            │  (Plumber; auth NONE,        │
                                            │   CORS *)                    │
                                            └────────────────────────────┘
```

**Key facts:**

- The Next.js UI runs on AWS Lambda using a container image with the
  [AWS Lambda Web Adapter](https://github.com/awslabs/aws-lambda-web-adapter),
  exposed through a Lambda Function URL.
- Cloudflare fronts the UI for CDN, TLS, and WAF. Because Lambda Function URLs
  reject requests carrying a foreign `Host` header, a Cloudflare Worker rewrites
  the `Host`/SNI to the `.on.aws` origin.
- The R backend is a separate **public** Lambda Function URL with authorization
  `NONE` and CORS `*`, so the browser can call it cross-origin.
- The heavy `/run-model` analysis request is sent **directly from the browser**
  to the R Lambda Function URL — it does not pass through the Next.js server.

## How the Browser Finds the R Backend

Because the R URL is environment-specific and the UI image runs on a read-only
filesystem (only `/tmp` is writable on Lambda), the URL is served at request
time rather than baked into the bundle.

### 1. Runtime config route

```typescript
// src/pages/api/runtime-config.ts
export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  const rApiUrl =
    process.env.NEXT_PUBLIC_R_API_URL ?? process.env.R_API_URL ?? "";

  const body = `window.RUNTIME_CONFIG = ${JSON.stringify({ R_API_URL: rApiUrl })};\n`;

  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.status(200).send(body);
}
```

### 2. Reading the config on the client

```typescript
// src/utils/getRuntimeConfig.ts
export function getRuntimeConfig(): RuntimeConfig {
  if (typeof window === "undefined") return {} as RuntimeConfig; // SSR
  return (window as ExtendedWindow).RUNTIME_CONFIG ?? ({} as RuntimeConfig);
  // (in development, falls back to NEXT_PUBLIC_DEV_R_API_URL or localhost:8787)
}
```

### 3. Calling the R backend directly

`modelService` is isomorphic. In the browser it resolves the R Function URL from
the runtime config and POSTs straight to it; server-side code (the lightweight
API routes) uses the configured env var. See `getRApiUrl()`.

```typescript
// src/api/services/modelService.ts
return await httpPost<ModelResponse>(`${getRApiUrl()}/run-model`, requestData, {
  timeout: 300000, // 5 minutes for long-running models
});
```

## What Still Runs Server-Side

The UI Lambda still hosts lightweight Next.js API routes that execute in the
Next.js server context, e.g.:

- `/api/runtime-config` — exposes the R backend URL to the browser
- `/api/ping` — connectivity check
- `/api/get-version-info`, `/api/system-status` — metadata

The previous `/api/run-model` proxy has been **removed**.

## Environment Configuration

### Development

- R service runs on `localhost:8787`.
- `NEXT_PUBLIC_DEV_R_API_URL` overrides the local R URL if set.

### Production

- `R_API_URL` (or `NEXT_PUBLIC_R_API_URL`, which takes precedence) on the UI
  Lambda holds the **public R Lambda Function URL**. The `/api/runtime-config`
  route reads it and hands it to the browser.

## Domains

- `maive.eu` and `spuriousprecision.com` (apex + `www`) are proxied through
  Cloudflare.
- `easymeta.org` redirects to `spuriousprecision.com` via GoDaddy domain
  forwarding.

## Trade-offs

- **Simplicity / cost:** no ALB, ECS cluster, or NAT — just two Lambdas and a
  CDN. Scales to zero when idle.
- **CORS:** the R Lambda is public and CORS-open, so browsers can call it
  directly. There is no private-subnet isolation; protection comes from
  Cloudflare's WAF in front of the UI and the stateless nature of the R service.
- **Cold starts:** Lambda cold starts can make the first analysis run slow; the
  UI shows a "warming up" hint during slow model runs.
