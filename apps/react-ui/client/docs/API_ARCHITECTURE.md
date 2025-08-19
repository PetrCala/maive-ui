# API Architecture - Server-Side Implementation

## Overview

This document describes the refactored API architecture that moves from client-side to server-side requests to solve DNS resolution issues in the VPC environment.

## Problem

The previous implementation made **client-side requests** directly from the user's browser to the R-plumber service. This caused DNS resolution failures because:

- The browser (client-side) tried to resolve internal VPC DNS names like `internal-maive-r-alb-...elb.amazonaws.com`
- These internal DNS names are only resolvable from within the VPC
- The browser runs on the user's machine, outside the VPC

## Solution

The new architecture implements **server-side requests** through Next.js API routes:

```plain
Browser → Next.js API Route → R-plumber Service
   ↓           ↓                    ↓
Client    Server (ECS)         Internal ALB
         (VPC Network)
```

## Architecture Components

### 1. Server-Side Services (`/src/api/services/`)

- **`modelService.ts`** - Makes HTTP requests to R-plumber from server context
- **`pingService.ts`** - Handles ping requests to R-plumber from server context

### 2. Client-Side Services (`/src/api/services/`)

- **`modelService.ts`** - Calls Next.js API routes from browser
- **`pingService.ts`** - Calls Next.js API routes from browser

### 3. Next.js API Routes (`/src/pages/api/`)

- **`/api/run-model`** - Handles model execution requests
- **`/api/ping`** - Handles connectivity testing

## How It Works

### Before (Client-Side)

```typescript
// ❌ This runs in the browser
const result = await modelService.runModel(data, parameters);
// Browser tries to resolve internal VPC DNS → FAILS
```

### After (Server-Side)

```typescript
// ✅ This runs in the browser
const result = await modelService.runModel(data, parameters);

// ✅ This runs on the server (ECS task)
// /api/run-model → modelService.runModel() → R-plumber
```

## Environment Configuration

### Server-Side (ECS Task)

The server-side services use environment variables for configuration:

```bash
# Production
R_API_URL=https://internal-maive-r-alb-...elb.amazonaws.com

# Development
NEXT_PUBLIC_DEV_R_API_URL=http://localhost:8787
```

### Client-Side (Browser)

The client-side services call relative URLs that resolve to the same ECS task:

```typescript
// Calls /api/run-model on the same domain
fetch("/api/run-model", { ... })
```

## Benefits

1. **✅ DNS Resolution** - Server-side requests can resolve internal VPC DNS names
2. **✅ Security** - Internal service URLs are not exposed to the client
3. **✅ Performance** - Server-to-server communication within VPC is faster
4. **✅ Reliability** - No dependency on client network configuration

## Migration Notes

- **Client components** now use `modelService` and `pingService`
- **Server-side logic** continues to use `modelService` and `pingService`
- **API routes** handle the translation between client and server services
- **Environment variables** control server-side service URLs

## Testing

Test the new architecture by:

1. **Ping Test**: Use the ping button to verify connectivity
2. **Model Execution**: Run a model to verify end-to-end functionality
3. **Network Inspection**: Verify requests go through `/api/*` routes

## Troubleshooting

### Common Issues

1. **Environment Variables**: Ensure `R_API_URL` is set in ECS task
2. **API Routes**: Verify `/api/run-model` and `/api/ping` are accessible
3. **Service Health**: Check R-plumber service is running and accessible

### Debug Steps

1. Check browser network tab for API route calls
2. Check ECS task logs for server-side request details
3. Verify environment variables in ECS task configuration
