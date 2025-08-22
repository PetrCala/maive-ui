# API Architecture: Server-Side Design

## Overview

This document explains the (currently unused) server-side API architecture implemented in the MAIVE UI application and why it's necessary for the VPC (Virtual Private Cloud) deployment setup.

## Why Server-Side APIs Are Necessary

### VPC Network Constraints

In our AWS VPC setup, the React frontend runs in a public subnet behind an Application Load Balancer (ALB), while the R-plumber backend service runs in a private subnet. This architecture provides security benefits but creates network connectivity challenges:

1. **Private Subnet Isolation**: The R-plumber service is intentionally placed in a private subnet for security, making it inaccessible from the public internet
2. **Client-Side Limitations**: Browser-based JavaScript cannot directly access private subnet resources
3. **Security Requirements**: Direct client-to-backend communication would require exposing the R service to the public internet, compromising security

### Security Benefits

- **Backend Protection**: R service remains isolated in private subnet
- **Controlled Access**: All external requests must go through the ALB and Next.js API routes
- **Authentication/Authorization**: Can be implemented at the API gateway level
- **Request Validation**: Server-side validation before reaching sensitive backend services

## Architecture Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   User Browser  │    │   Next.js App   │    │  Next.js API   │    │   R-Plumber     │
│                 │    │   (Public Subnet)│    │   Routes       │    │  (Private      │
│                 │    │                  │    │                │    │   Subnet)       │
└─────────────────┘    └──────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │                       │
         │                       │                       │                       │
         │ 1. User Action       │                       │                       │
         │─────────────────────▶│                       │                       │
         │                       │                       │                       │
         │                       │ 2. API Route Call     │                       │
         │                       │──────────────────────▶│                       │
         │                       │                       │                       │
         │                       │                       │ 3. Direct Service    │
         │                       │                       │ Call (Server-side)   │
         │                       │                       │─────────────────────▶│
         │                       │                       │                       │
         │                       │                       │ 4. R Processing     │
         │                       │                       │◀─────────────────────│
         │                       │                       │                       │
         │                       │ 5. Response           │                       │
         │                       │◀──────────────────────│                       │
         │                       │                       │                       │
         │ 6. UI Update         │                       │                       │
         │◀─────────────────────│                       │                       │
```

## Implementation Details

### 1. Client-Side API Layer

The client-side code (`src/api/client/`) provides a clean interface that makes requests to Next.js API routes:

```typescript
// src/api/client/model.ts
export async function runModelClient(
  data: any[],
  parameters: any,
  signal?: AbortSignal,
) {
  const response = await fetch("/api/run-model", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data, parameters }),
    signal,
  });
  // ... error handling and response processing
}
```

### 2. Next.js API Routes

API routes (`src/pages/api/`) act as the server-side entry point:

```typescript
// src/pages/api/run-model.ts
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  // Validate request
  const { data, parameters } = req.body;
  
  // Call server-side service
  const result = await modelService.runModel(data, parameters);
  
  // Return response
  res.status(200).json(result);
}
```

### 3. Server-Side Services

Services (`src/api/services/`) handle the actual communication with the R backend:

```typescript
// src/api/services/modelService.ts
export class ModelService {
  async runModel(data: any[], parameters: ModelParameters): Promise<ModelResponse> {
    const requestData = {
      data: JSON.stringify(data),
      parameters: JSON.stringify(parameters),
    };

    // Direct server-to-server communication
    return await httpPost<ModelResponse>(
      `${getRApiUrl()}/run-model`,
      requestData,
      { timeout: 300000 } // 5 minutes for long-running models
    );
  }
}
```

### 4. Configuration Management

The configuration system (`src/api/utils/config.ts`) handles environment-specific URLs:

```typescript
export function getRApiUrl(): string {
  // Server-side: check environment variables first
  if (typeof window === "undefined") {
    return (
      process.env.NEXT_PUBLIC_R_API_URL ||
      process.env.R_API_URL ||
      "http://localhost:8787"
    );
  }
  
  // Client-side: use runtime config
  const { R_API_URL } = getRuntimeConfig();
  return R_API_URL;
}
```

## Data Flow

1. **User Interaction**: User submits model parameters on the model page
2. **Client Request**: React component calls `runModelClient()`
3. **API Route**: Request reaches `/api/run-model` Next.js API route
4. **Service Layer**: API route calls `modelService.runModel()`
5. **Backend Communication**: Service makes direct HTTP request to R-plumber
6. **Response Processing**: R service processes data and returns results
7. **Data Return**: Results flow back through the service → API route → client
8. **UI Update**: React component receives results and updates the UI

## Environment Configuration

### Development

- R service runs on `localhost:8787`
- Direct communication between Next.js and R service
- No VPC constraints

### Production

- R service runs in private subnet
- Next.js API routes run in public subnet
- Communication through internal VPC network
- Environment variables configure R service URLs

## Benefits of This Architecture

### Security

- Backend services remain in private subnets
- No direct client access to sensitive services
- Centralized authentication/authorization possible

### Scalability

- API routes can be scaled independently
- Backend services can be scaled based on demand
- Load balancing at the ALB level

### Maintainability

- Clear separation of concerns
- Consistent API interface
- Easy to add middleware (logging, monitoring, etc.)

### Flexibility

- Can easily add caching layers
- Request/response transformation
- Rate limiting and throttling

## Alternative Approaches Considered

### 1. Client-Side Direct Access

- **Problem**: Would require exposing R service to public internet
- **Security Risk**: High - direct access to backend services
- **Rejected**: Security concerns

### 2. API Gateway Pattern

- **Problem**: Additional complexity and cost
- **Benefit**: More sophisticated routing and security
- **Status**: Could be implemented in future if needed

### 3. WebSocket Connections

- **Problem**: More complex state management
- **Benefit**: Real-time updates
- **Status**: Could be added for specific use cases

## Future Enhancements

1. **Authentication**: Add JWT or session-based authentication
2. **Rate Limiting**: Implement request throttling
3. **Caching**: Add Redis or similar for response caching
4. **Monitoring**: Add request/response logging and metrics
5. **Circuit Breaker**: Implement failure handling patterns

## Conclusion

The server-side API architecture is essential for our VPC deployment, providing security, scalability, and maintainability while ensuring the R backend service remains properly isolated. This design pattern follows cloud-native best practices and provides a solid foundation for future enhancements.
