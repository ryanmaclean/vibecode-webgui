# Agent API Implementation Guide

**Status**: Design Complete - Ready for Implementation
**Created**: 2025-10-02
**API Version**: 1.0.0
**OpenAPI Spec**: `/docs/api/AGENT_API_SPECIFICATION.yaml`
**Type Definitions**: `/src/types/agent-api.ts`

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Implementation Plan](#implementation-plan)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)
- [Streaming Protocols](#streaming-protocols)
- [Security](#security)
- [Testing Strategy](#testing-strategy)
- [Monitoring](#monitoring)
- [Versioning Strategy](#versioning-strategy)

---

## Overview

This document provides a comprehensive implementation guide for the Next.js API routes that wrap the agentapi HTTP server endpoints. The API provides a unified interface for managing AI coding agents (Aider, Goose, Cline) with real-time streaming capabilities.

### Key Features

- **RESTful API Design**: Clean, predictable endpoints following REST principles
- **Real-time Streaming**: Server-Sent Events (SSE) and WebSocket support
- **Type-Safe**: Complete TypeScript definitions with runtime validation
- **RFC 7807 Error Format**: Standardized problem details for all errors
- **Rate Limiting**: Per-user and global concurrency controls
- **Observability**: Built-in Prometheus metrics and distributed tracing
- **Backward Compatibility**: Coexists with existing `/api/code-server` endpoints

### Design Principles

1. **Reliability First**: Fault tolerance, graceful degradation, circuit breakers
2. **Performance**: <200ms P95 response time for non-streaming endpoints
3. **Security**: Authentication, authorization, input validation, audit trails
4. **Developer Experience**: Type-safe, well-documented, predictable behavior
5. **Observability**: Comprehensive logging, metrics, and distributed tracing

---

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                      Next.js Application                     │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │            API Routes Layer                          │   │
│  │  /src/app/api/agents/*                              │   │
│  │                                                       │   │
│  │  ┌─────────────┐  ┌──────────────┐  ┌────────────┐ │   │
│  │  │ POST /agents│  │ GET /agents  │  │ DELETE /..│ │   │
│  │  │   (create)  │  │   (list)     │  │  (stop)   │ │   │
│  │  └─────────────┘  └──────────────┘  └────────────┘ │   │
│  │                                                       │   │
│  │  ┌─────────────┐  ┌──────────────┐                  │   │
│  │  │ GET /events │  │ GET /ws      │                  │   │
│  │  │    (SSE)    │  │ (WebSocket)  │                  │   │
│  │  └─────────────┘  └──────────────┘                  │   │
│  └─────────────────────────────────────────────────────┘   │
│                             │                                │
│                             ▼                                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │       Middleware & Services Layer                    │   │
│  │                                                       │   │
│  │  • Authentication (NextAuth)                         │   │
│  │  • Rate Limiting (Upstash Redis)                     │   │
│  │  • Input Validation (Zod)                            │   │
│  │  • Error Handling (RFC 7807)                         │   │
│  │  • Observability (Datadog APM)                       │   │
│  └─────────────────────────────────────────────────────┘   │
│                             │                                │
└─────────────────────────────┼────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  AgentAPI HTTP Server                        │
│                  (Python/aiohttp)                            │
│                  Port: 3284                                  │
│                                                               │
│  Endpoints:                                                   │
│  • POST /v1/agents/start                                     │
│  • GET /v1/agents/{id}/status                                │
│  • GET /v1/agents/{id}/stream                                │
│  • POST /v1/agents/{id}/stop                                 │
│  • GET /health                                               │
│  • GET /metrics                                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  AI Coding Agents                            │
│  • Aider (subprocess)                                        │
│  • Goose (subprocess)                                        │
│  • Cline (subprocess)                                        │
└─────────────────────────────────────────────────────────────┘
```

### Request Flow

1. **Client Request** → Next.js API Route
2. **Authentication** → NextAuth session validation
3. **Rate Limiting** → Check concurrent agent limits
4. **Input Validation** → Zod schema validation
5. **Backend Request** → Forward to agentapi HTTP server
6. **Response Processing** → Transform to API contract
7. **Error Handling** → Map to RFC 7807 format
8. **Observability** → Log metrics and traces
9. **Client Response** → Return formatted response

---

## Implementation Plan

### Phase 1: Core API Routes (Week 1)

#### 1.1 Create Base Route Structure

```typescript
// /src/app/api/agents/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { z } from 'zod';
import { createProblemDetails } from '@/lib/api/error-handling';
import { checkRateLimit } from '@/lib/api/rate-limiting';
import { agentApiClient } from '@/lib/api/agent-api-client';

export async function POST(request: NextRequest) {
  // 1. Authenticate
  const token = await getToken({ req: request });
  if (!token?.sub) {
    return NextResponse.json(
      createProblemDetails('unauthorized', 401, 'Authentication required'),
      { status: 401 }
    );
  }

  // 2. Rate limit check
  const rateLimitResult = await checkRateLimit(token.sub, 'agent-create');
  if (!rateLimitResult.success) {
    return NextResponse.json(
      createProblemDetails('rate-limit-exceeded', 429, rateLimitResult.message),
      {
        status: 429,
        headers: rateLimitResult.headers,
      }
    );
  }

  // 3. Validate request body
  try {
    const body = await request.json();
    const validated = startAgentSchema.parse(body);

    // 4. Forward to backend
    const result = await agentApiClient.startAgent(validated);

    // 5. Return response
    return NextResponse.json(result.data, {
      status: 201,
      headers: {
        'Location': `/api/agents/${result.data.agent_id}`,
        ...rateLimitResult.headers,
      },
    });
  } catch (error) {
    return handleAPIError(error);
  }
}

export async function GET(request: NextRequest) {
  // Implementation for listing agents
}
```

#### 1.2 Implement Validation Schemas

```typescript
// /src/lib/api/validation.ts
import { z } from 'zod';
import { AGENT_CONSTRAINTS } from '@/types/agent-api';

export const startAgentSchema = z.object({
  agent_type: z.enum(['aider', 'goose', 'cline']),
  workspace: z.string()
    .regex(/^\/home\/coder\/workspace(\/.*)?$/, 'Invalid workspace path'),
  files: z.array(z.string())
    .max(AGENT_CONSTRAINTS.maxFiles)
    .optional(),
  model: z.enum([
    'claude-3-5-sonnet-20241022',
    'claude-3-5-haiku-20241022',
    'gpt-4o',
    'gpt-4o-mini',
    'deepseek-chat',
  ]),
  task: z.string()
    .min(AGENT_CONSTRAINTS.taskMinLength)
    .max(AGENT_CONSTRAINTS.taskMaxLength),
  metadata: z.record(z.unknown()).optional(),
});

export const sendMessageSchema = z.object({
  message: z.string()
    .min(AGENT_CONSTRAINTS.messageMinLength)
    .max(AGENT_CONSTRAINTS.messageMaxLength),
  type: z.enum(['user', 'system']).optional().default('user'),
});
```

#### 1.3 Create Backend Client

```typescript
// /src/lib/api/agent-api-client.ts
import axios, { AxiosInstance } from 'axios';
import { AgentAPIError } from '@/types/agent-api';
import type {
  StartAgentRequest,
  AgentResponse,
  AgentStatusResponse,
  StopAgentResponse,
} from '@/types/agent-api';

class AgentAPIClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: process.env.AGENTAPI_URL || 'http://localhost:3284',
      timeout: 30000,
    });

    // Add interceptors for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        throw this.mapError(error);
      }
    );
  }

  async startAgent(request: StartAgentRequest) {
    const response = await this.client.post('/v1/agents/start', {
      agent_type: request.agent_type,
      workspace: request.workspace,
      files: request.files,
      model: request.model,
      task: request.task,
    });

    const data = response.data as AgentResponse;
    return {
      data: {
        ...data,
        stream_url: `/api/agents/${data.agent_id}/events`,
        ws_url: `wss://${process.env.NEXT_PUBLIC_APP_URL}/api/agents/${data.agent_id}/ws`,
      },
      status: response.status,
      headers: response.headers,
    };
  }

  async getAgentStatus(agentId: string) {
    const response = await this.client.get(`/v1/agents/${agentId}/status`);
    return response.data as AgentStatusResponse;
  }

  async stopAgent(agentId: string, force: boolean = false) {
    const response = await this.client.post(`/v1/agents/${agentId}/stop`, {
      force,
    });
    return response.data as StopAgentResponse;
  }

  private mapError(error: any): AgentAPIError {
    // Map backend errors to RFC 7807 format
    if (error.response?.data) {
      const problem = {
        type: `https://vibecode.io/problems/${error.response.data.error || 'unknown'}`,
        title: error.response.statusText,
        status: error.response.status,
        detail: error.response.data.error || error.message,
        instance: error.config?.url,
      };
      return new AgentAPIError(problem);
    }
    throw error;
  }
}

export const agentApiClient = new AgentAPIClient();
```

### Phase 2: Streaming Implementation (Week 2)

#### 2.1 Server-Sent Events (SSE)

```typescript
// /src/app/api/agents/[agentId]/events/route.ts
import { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { agentApiClient } from '@/lib/api/agent-api-client';

export async function GET(
  request: NextRequest,
  { params }: { params: { agentId: string } }
) {
  const token = await getToken({ req: request });
  if (!token?.sub) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { agentId } = params;

  // Create readable stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Connect to backend SSE stream
        const backendStream = await agentApiClient.streamAgentOutput(agentId);

        // Forward events with transformation
        for await (const event of backendStream) {
          const data = `id: ${event.id}\nevent: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`;
          controller.enqueue(encoder.encode(data));
        }

        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });
}
```

#### 2.2 WebSocket Implementation

```typescript
// /src/app/api/agents/[agentId]/ws/route.ts
import { WebSocketServer } from 'ws';
import { getToken } from 'next-auth/jwt';
import { agentApiClient } from '@/lib/api/agent-api-client';

export async function GET(
  request: Request,
  { params }: { params: { agentId: string } }
) {
  // Verify authentication
  const token = await getToken({ req: request as any });
  if (!token?.sub) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { agentId } = params;

  // Upgrade to WebSocket
  const upgrade = request.headers.get('upgrade');
  if (upgrade !== 'websocket') {
    return new Response('Expected WebSocket upgrade', { status: 400 });
  }

  // Create WebSocket connection
  const wss = new WebSocketServer({ noServer: true });

  wss.on('connection', (ws) => {
    // Set up bidirectional communication
    setupAgentWebSocket(ws, agentId, token.sub!);
  });

  return new Response(null, {
    status: 101,
    headers: {
      'Upgrade': 'websocket',
      'Connection': 'Upgrade',
      'Sec-WebSocket-Protocol': 'agent-v1',
    },
  });
}

async function setupAgentWebSocket(
  ws: WebSocket,
  agentId: string,
  userId: string
) {
  // Handle incoming messages from client
  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString());

      if (message.type === 'message') {
        await agentApiClient.sendMessage(agentId, {
          message: message.content,
          type: message.message_type || 'user',
        });
      } else if (message.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
      }
    } catch (error) {
      ws.send(JSON.stringify({
        type: 'error',
        error: 'Invalid message format',
      }));
    }
  });

  // Stream agent output to client
  const stream = await agentApiClient.streamAgentOutput(agentId);
  for await (const event of stream) {
    ws.send(JSON.stringify({
      type: event.event,
      ...event.data,
    }));
  }
}
```

### Phase 3: Rate Limiting & Security (Week 3)

#### 3.1 Rate Limiting Implementation

```typescript
// /src/lib/api/rate-limiting.ts
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { AGENT_CONSTRAINTS } from '@/types/agent-api';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Per-user concurrent agent limit
const agentConcurrencyLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(
    AGENT_CONSTRAINTS.maxConcurrentPerUser,
    '1 m'
  ),
  prefix: 'ratelimit:agent:user',
});

// Global API rate limit
const apiRateLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, '1 m'),
  prefix: 'ratelimit:api',
});

export async function checkRateLimit(userId: string, operation: string) {
  const identifier = `${userId}:${operation}`;

  const [userLimit, apiLimit] = await Promise.all([
    agentConcurrencyLimiter.limit(identifier),
    apiRateLimiter.limit(userId),
  ]);

  if (!userLimit.success || !apiLimit.success) {
    return {
      success: false,
      message: !userLimit.success
        ? 'Concurrent agent limit reached'
        : 'API rate limit exceeded',
      headers: {
        'X-RateLimit-Limit': userLimit.limit.toString(),
        'X-RateLimit-Remaining': userLimit.remaining.toString(),
        'X-RateLimit-Reset': userLimit.reset.toString(),
        'Retry-After': Math.ceil((userLimit.reset - Date.now()) / 1000).toString(),
      },
    };
  }

  return {
    success: true,
    headers: {
      'X-RateLimit-Limit': userLimit.limit.toString(),
      'X-RateLimit-Remaining': userLimit.remaining.toString(),
      'X-RateLimit-Reset': userLimit.reset.toString(),
    },
  };
}
```

#### 3.2 Authorization Middleware

```typescript
// /src/lib/api/authorization.ts
import { getToken } from 'next-auth/jwt';
import { NextRequest } from 'next/server';
import { agentApiClient } from './agent-api-client';

export async function authorizeAgentAccess(
  request: NextRequest,
  agentId: string
): Promise<{ authorized: boolean; userId?: string }> {
  const token = await getToken({ req: request });
  if (!token?.sub) {
    return { authorized: false };
  }

  // Check if agent belongs to user
  try {
    const agent = await agentApiClient.getAgentStatus(agentId);

    // Check metadata for user ownership
    const ownerId = agent.metadata?.user_id;
    if (ownerId !== token.sub) {
      return { authorized: false };
    }

    return { authorized: true, userId: token.sub };
  } catch (error) {
    return { authorized: false };
  }
}
```

### Phase 4: Error Handling (Week 3)

#### 4.1 RFC 7807 Problem Details

```typescript
// /src/lib/api/error-handling.ts
import { ProblemDetails } from '@/types/agent-api';
import { logger } from '@/lib/monitoring';

export function createProblemDetails(
  type: string,
  status: number,
  detail?: string,
  additionalFields?: Record<string, unknown>
): ProblemDetails {
  return {
    type: `https://vibecode.io/problems/${type}`,
    title: getTitleForStatus(status),
    status,
    detail,
    instance: additionalFields?.instance as string,
    trace_id: generateTraceId(),
    ...additionalFields,
  };
}

export function handleAPIError(error: unknown) {
  if (error instanceof AgentAPIError) {
    logger.error('Agent API error', {
      problem: error.problem,
      trace_id: error.problem.trace_id,
    });

    return NextResponse.json(error.problem, {
      status: error.status,
      headers: error.rateLimit || {},
    });
  }

  if (error instanceof z.ZodError) {
    const problem = createProblemDetails(
      'validation-error',
      400,
      'Request validation failed',
      {
        errors: error.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
          code: e.code,
        })),
      }
    );

    return NextResponse.json(problem, { status: 400 });
  }

  // Generic error handling
  logger.error('Unexpected error', { error });

  const problem = createProblemDetails(
    'internal-server-error',
    500,
    'An unexpected error occurred'
  );

  return NextResponse.json(problem, { status: 500 });
}

function getTitleForStatus(status: number): string {
  const titles: Record<number, string> = {
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    429: 'Too Many Requests',
    500: 'Internal Server Error',
    503: 'Service Unavailable',
  };

  return titles[status] || 'Error';
}

function generateTraceId(): string {
  return Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15);
}
```

---

## Error Handling

### Error Response Format (RFC 7807)

All error responses follow the RFC 7807 Problem Details specification:

```json
{
  "type": "https://vibecode.io/problems/validation-error",
  "title": "Validation Error",
  "status": 400,
  "detail": "Invalid agent_type. Supported types are aider, goose, cline",
  "instance": "/api/agents",
  "trace_id": "a1b2c3d4e5f6",
  "errors": [
    {
      "field": "agent_type",
      "message": "Must be one of aider, goose, cline",
      "code": "enum"
    }
  ]
}
```

### Error Types

| Type | Status | Description |
|------|--------|-------------|
| `validation-error` | 400 | Request validation failed (Zod errors) |
| `unauthorized` | 401 | Authentication required |
| `forbidden` | 403 | User lacks permission |
| `agent-not-found` | 404 | Agent ID does not exist |
| `rate-limit-exceeded` | 429 | Too many requests |
| `concurrent-limit-reached` | 429 | Max concurrent agents reached |
| `backend-unavailable` | 503 | AgentAPI server unavailable |
| `internal-server-error` | 500 | Unexpected server error |

---

## Rate Limiting

### Limits

- **Per-User Concurrent Agents**: 5 simultaneous agents
- **Global Concurrent Agents**: 20 simultaneous agents
- **API Requests**: 100 requests/minute per user

### Headers

All responses include rate limit headers:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1696248000
```

429 responses also include:

```
Retry-After: 60
```

---

## Streaming Protocols

### Server-Sent Events (SSE)

**Use Case**: One-directional streaming (server → client)

**Event Format**:
```
id: 1
event: output
data: {"timestamp":"2025-10-02T10:30:00Z","line":"Processing file"}

id: 2
event: status
data: {"timestamp":"2025-10-02T10:30:05Z","status":"running","progress":0.45}
```

**Client Example**:
```typescript
const eventSource = new EventSource('/api/agents/aider-a1b2c3d4/events');

eventSource.addEventListener('output', (e) => {
  const data = JSON.parse(e.data);
  console.log('Output:', data.line);
});

eventSource.addEventListener('complete', (e) => {
  const data = JSON.parse(e.data);
  console.log('Agent completed with exit code:', data.exit_code);
  eventSource.close();
});
```

### WebSocket

**Use Case**: Bidirectional communication (client ↔ server)

**Client → Server**:
```json
{"type": "message", "content": "Yes, apply the changes"}
{"type": "ping"}
```

**Server → Client**:
```json
{"type": "output", "content": "Applied changes", "timestamp": "..."}
{"type": "status", "status": "running", "progress": 0.5}
{"type": "complete", "exit_code": 0}
{"type": "pong"}
```

**Client Example**:
```typescript
const ws = new WebSocket('wss://vibecode.io/api/agents/aider-a1b2c3d4/ws');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);

  switch (data.type) {
    case 'output':
      console.log('Output:', data.content);
      break;
    case 'status':
      console.log('Status:', data.status);
      break;
    case 'complete':
      console.log('Completed:', data.exit_code);
      ws.close();
      break;
  }
};

// Send message to agent
ws.send(JSON.stringify({
  type: 'message',
  content: 'Yes, proceed'
}));
```

---

## Security

### Authentication

- **Method**: NextAuth session cookies
- **Required**: All endpoints except `/agents/health` and `/agents/metrics`
- **Validation**: `getToken({ req: request })` in each route

### Authorization

- **Principle**: Users can only access their own agents
- **Implementation**: Check `metadata.user_id` matches session `sub`
- **Enforcement**: Middleware in GET/DELETE/POST message endpoints

### Input Validation

- **Library**: Zod for runtime schema validation
- **Sanitization**: DOMPurify for user-provided content
- **Path Traversal**: Strict workspace path validation (`/home/coder/workspace/*`)
- **File Limits**: Max 50 files per agent request

### CORS

- **Production**: Restrict to app domain only
- **Development**: Allow `localhost:3000`, `localhost:8765`
- **Credentials**: Required for cookie-based auth

---

## Testing Strategy

### Unit Tests

```typescript
// /tests/unit/api/agent-routes.test.ts
import { POST } from '@/app/api/agents/route';
import { getToken } from 'next-auth/jwt';
import { agentApiClient } from '@/lib/api/agent-api-client';

jest.mock('next-auth/jwt');
jest.mock('@/lib/api/agent-api-client');

describe('POST /api/agents', () => {
  it('should create agent with valid request', async () => {
    (getToken as jest.Mock).mockResolvedValue({ sub: 'user-123' });
    (agentApiClient.startAgent as jest.Mock).mockResolvedValue({
      data: { agent_id: 'aider-a1b2c3d4', status: 'running' },
    });

    const request = new Request('http://localhost/api/agents', {
      method: 'POST',
      body: JSON.stringify({
        agent_type: 'aider',
        workspace: '/home/coder/workspace/test',
        model: 'claude-3-5-sonnet-20241022',
        task: 'Add error handling',
      }),
    });

    const response = await POST(request as any);
    expect(response.status).toBe(201);

    const data = await response.json();
    expect(data.agent_id).toBe('aider-a1b2c3d4');
  });

  it('should reject unauthenticated request', async () => {
    (getToken as jest.Mock).mockResolvedValue(null);

    const request = new Request('http://localhost/api/agents', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const response = await POST(request as any);
    expect(response.status).toBe(401);
  });
});
```

### Integration Tests

```typescript
// /tests/integration/agent-api.test.ts
import { createMockSession } from '@/tests/utils/auth';
import { agentApiClient } from '@/lib/api/agent-api-client';

describe('Agent API Integration', () => {
  let session: any;

  beforeEach(() => {
    session = createMockSession();
  });

  it('should complete full agent lifecycle', async () => {
    // 1. Start agent
    const startResponse = await fetch('/api/agents', {
      method: 'POST',
      headers: { 'Cookie': session.cookie },
      body: JSON.stringify({
        agent_type: 'aider',
        workspace: '/home/coder/workspace/test',
        model: 'claude-3-5-sonnet-20241022',
        task: 'Add tests',
      }),
    });

    expect(startResponse.status).toBe(201);
    const agent = await startResponse.json();

    // 2. Check status
    const statusResponse = await fetch(`/api/agents/${agent.agent_id}`, {
      headers: { 'Cookie': session.cookie },
    });

    expect(statusResponse.status).toBe(200);

    // 3. Stop agent
    const stopResponse = await fetch(`/api/agents/${agent.agent_id}`, {
      method: 'DELETE',
      headers: { 'Cookie': session.cookie },
    });

    expect(stopResponse.status).toBe(200);
  });
});
```

### E2E Tests (Playwright)

```typescript
// /tests/e2e/agent-workflow.test.ts
import { test, expect } from '@playwright/test';

test('Agent creation and streaming', async ({ page }) => {
  // 1. Login
  await page.goto('/login');
  await page.fill('[name="email"]', 'test@vibecode.io');
  await page.fill('[name="password"]', 'password123');
  await page.click('button[type="submit"]');

  // 2. Create agent
  await page.goto('/agents/new');
  await page.selectOption('[name="agent_type"]', 'aider');
  await page.fill('[name="task"]', 'Add error handling to login');
  await page.click('button[type="submit"]');

  // 3. Wait for agent start
  await expect(page.locator('.agent-status')).toHaveText('running', {
    timeout: 5000,
  });

  // 4. Verify output streaming
  await expect(page.locator('.agent-output')).toContainText('Processing', {
    timeout: 10000,
  });

  // 5. Stop agent
  await page.click('button.stop-agent');
  await expect(page.locator('.agent-status')).toHaveText('stopped');
});
```

---

## Monitoring

### Datadog APM

```typescript
// /src/lib/api/observability.ts
import tracer from 'dd-trace';

export function instrumentAgentAPI() {
  tracer.init({
    service: 'vibecode-agent-api',
    env: process.env.NODE_ENV,
    version: process.env.npm_package_version,
  });

  tracer.use('http', {
    service: 'agent-api-http',
  });

  tracer.use('next', {
    service: 'agent-api-routes',
  });
}

export function traceAgentOperation(
  operationName: string,
  agentId: string,
  fn: () => Promise<any>
) {
  const span = tracer.startSpan('agent.operation', {
    tags: {
      'agent.id': agentId,
      'operation.name': operationName,
    },
  });

  return fn()
    .then((result) => {
      span.setTag('status', 'success');
      span.finish();
      return result;
    })
    .catch((error) => {
      span.setTag('status', 'error');
      span.setTag('error', true);
      span.setTag('error.message', error.message);
      span.finish();
      throw error;
    });
}
```

### Prometheus Metrics

Exposed at `/api/agents/metrics`:

```
# HELP vibecode_agents_active Number of currently active agents
# TYPE vibecode_agents_active gauge
vibecode_agents_active{type="aider"} 2
vibecode_agents_active{type="goose"} 1

# HELP vibecode_agents_total Total number of agents started
# TYPE vibecode_agents_total counter
vibecode_agents_total{type="aider",status="completed"} 45
vibecode_agents_total{type="aider",status="failed"} 3

# HELP vibecode_agent_duration_seconds Agent execution duration
# TYPE vibecode_agent_duration_seconds histogram
vibecode_agent_duration_seconds_bucket{type="aider",le="10"} 5
vibecode_agent_duration_seconds_bucket{type="aider",le="30"} 15
vibecode_agent_duration_seconds_bucket{type="aider",le="60"} 35
vibecode_agent_duration_seconds_bucket{type="aider",le="+Inf"} 45

# HELP vibecode_api_requests_total Total API requests
# TYPE vibecode_api_requests_total counter
vibecode_api_requests_total{endpoint="/agents",method="POST",status="201"} 45
vibecode_api_requests_total{endpoint="/agents",method="GET",status="200"} 123

# HELP vibecode_api_duration_seconds API response time
# TYPE vibecode_api_duration_seconds histogram
vibecode_api_duration_seconds_bucket{endpoint="/agents",method="POST",le="0.1"} 40
vibecode_api_duration_seconds_bucket{endpoint="/agents",method="POST",le="0.2"} 44
vibecode_api_duration_seconds_bucket{endpoint="/agents",method="POST",le="+Inf"} 45
```

---

## Versioning Strategy

### Approach: Header-Based Versioning

**Rationale**: Cleaner URLs, easier to maintain, supports gradual migration

### Request Header

```
Accept: application/vnd.vibecode.v1+json
```

### Middleware Implementation

```typescript
// /src/middleware/api-versioning.ts
import { NextRequest, NextResponse } from 'next/server';

export function apiVersionMiddleware(request: NextRequest) {
  const acceptHeader = request.headers.get('accept');
  const version = extractVersion(acceptHeader);

  if (!version || !isVersionSupported(version)) {
    return NextResponse.json(
      {
        type: 'https://vibecode.io/problems/unsupported-version',
        title: 'Unsupported API Version',
        status: 400,
        detail: `API version ${version || 'unspecified'} is not supported. Current version: v1`,
        supported_versions: ['v1'],
      },
      { status: 400 }
    );
  }

  // Store version in request context
  const response = NextResponse.next();
  response.headers.set('X-API-Version', version);
  return response;
}

function extractVersion(acceptHeader: string | null): string | null {
  if (!acceptHeader) return 'v1'; // Default to v1

  const match = acceptHeader.match(/vnd\.vibecode\.v(\d+)/);
  return match ? `v${match[1]}` : null;
}

function isVersionSupported(version: string): boolean {
  return ['v1'].includes(version);
}
```

### Version Deprecation Process

1. **Announce**: 6 months notice via changelog and API responses
2. **Warn**: Add `Sunset` header to responses
3. **Migrate**: Provide migration guide and tools
4. **Deprecate**: Stop accepting new requests
5. **Remove**: Remove code after grace period

**Example Sunset Header**:
```
Sunset: Wed, 01 Apr 2026 00:00:00 GMT
Link: <https://docs.vibecode.io/migration/v1-to-v2>; rel="deprecation"
```

### Breaking Changes Policy

**Major Version** (v1 → v2):
- Breaking API contract changes
- Removal of deprecated endpoints
- Significant schema changes

**Minor Version** (v1.0 → v1.1):
- New endpoints (backward compatible)
- New optional fields
- Performance improvements

**Patch Version** (v1.0.0 → v1.0.1):
- Bug fixes
- Security patches
- Documentation updates

---

## Next Steps

### Implementation Checklist

- [ ] **Week 1**: Core API routes
  - [ ] Create route structure (`/api/agents/*`)
  - [ ] Implement validation schemas (Zod)
  - [ ] Build backend client (agentapi wrapper)
  - [ ] Add authentication middleware
  - [ ] Write unit tests

- [ ] **Week 2**: Streaming protocols
  - [ ] Implement SSE endpoint (`/events`)
  - [ ] Implement WebSocket endpoint (`/ws`)
  - [ ] Add connection pooling
  - [ ] Test streaming reliability

- [ ] **Week 3**: Security & observability
  - [ ] Add rate limiting (Upstash)
  - [ ] Implement authorization checks
  - [ ] Set up Datadog APM tracing
  - [ ] Add Prometheus metrics endpoint
  - [ ] Write integration tests

- [ ] **Week 4**: Documentation & deployment
  - [ ] Write API usage documentation
  - [ ] Create Postman/Insomnia collection
  - [ ] Set up E2E tests (Playwright)
  - [ ] Deploy to staging environment
  - [ ] Conduct load testing

### Success Criteria

- ✅ All endpoints return < 200ms (P95)
- ✅ 99.9% uptime over 30 days
- ✅ Zero security vulnerabilities
- ✅ 100% test coverage for critical paths
- ✅ Complete API documentation
- ✅ Successful load test (100 concurrent agents)

---

## References

- **OpenAPI Spec**: `/docs/api/AGENT_API_SPECIFICATION.yaml`
- **Type Definitions**: `/src/types/agent-api.ts`
- **Backend Docs**: `/docker/agentapi/README.md`
- **Deployment Guide**: `/docker/agentapi/DEPLOYMENT_GUIDE.md`
- **RFC 7807**: https://www.rfc-editor.org/rfc/rfc7807
- **Server-Sent Events**: https://html.spec.whatwg.org/multipage/server-sent-events.html
- **WebSocket Protocol**: https://www.rfc-editor.org/rfc/rfc6455

---

**Document Status**: ✅ Complete - Ready for Implementation
**Last Updated**: 2025-10-02
**Maintained By**: Agent 4 (API Design Engineer)
