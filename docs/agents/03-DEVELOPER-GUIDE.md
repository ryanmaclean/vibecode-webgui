# OpenAI Agents Developer Guide

**Version**: 1.0.0
**Last Updated**: 2025-10-02
**Audience**: Platform Developers, Contributors

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Extending Agent Types](#extending-agent-types)
3. [Custom Model Integration](#custom-model-integration)
4. [Store Integration](#store-integration)
5. [Middleware Development](#middleware-development)
6. [Testing Strategies](#testing-strategies)
7. [Performance Optimization](#performance-optimization)
8. [Security Considerations](#security-considerations)

---

## Architecture Overview

### System Components

```
┌──────────────────────────────────────────────────────────┐
│                 Frontend Layer                            │
│  • React Components                                       │
│  • Zustand Store (agentStore)                            │
│  • SSE/WebSocket Clients                                  │
└────────────────────┬─────────────────────────────────────┘
                     │
┌────────────────────▼─────────────────────────────────────┐
│                 API Routes Layer                          │
│  /src/app/api/agents/*                                   │
│  • Authentication (NextAuth)                              │
│  • Rate Limiting (Redis)                                  │
│  • Input Validation (Zod)                                 │
│  • Error Handling (RFC 7807)                              │
└────────────────────┬─────────────────────────────────────┘
                     │
┌────────────────────▼─────────────────────────────────────┐
│              AgentAPI HTTP Server                         │
│  Python/aiohttp (Port 3284)                              │
│  • Process Management                                     │
│  • Output Streaming                                       │
│  • Resource Monitoring                                    │
└────────────────────┬─────────────────────────────────────┘
                     │
┌────────────────────▼─────────────────────────────────────┐
│                 Agent Processes                           │
│  • Aider (subprocess)                                     │
│  • Goose (subprocess)                                     │
│  • Cline (subprocess)                                     │
└──────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Request Phase**
   - User submits agent configuration via React component
   - Store dispatches `startAgent` action
   - API route receives request

2. **Validation Phase**
   - NextAuth validates session
   - Rate limiter checks concurrent agent limits
   - Zod schema validates request body

3. **Execution Phase**
   - API route forwards request to AgentAPI server
   - AgentAPI spawns agent subprocess
   - Process manager monitors agent lifecycle

4. **Streaming Phase**
   - Agent output streamed via SSE/WebSocket
   - Store receives and processes events
   - UI updates in real-time

5. **Completion Phase**
   - Agent finishes with exit code
   - Resources cleaned up
   - Store updated with final status

---

## Extending Agent Types

### Adding a New Agent Type

#### Step 1: Update Type Definitions

```typescript
// src/types/agent-api.ts

export type AgentType = 'aider' | 'goose' | 'cline' | 'custom';

export const AGENT_TYPES: ReadonlyArray<AgentType> = [
  'aider',
  'goose',
  'cline',
  'custom',
] as const;
```

#### Step 2: Create Agent Configuration

```typescript
// src/config/agents/custom-agent.config.ts

import { AgentTypeConfig } from '@/types/agent-config';

export const customAgentConfig: AgentTypeConfig = {
  type: 'custom',
  name: 'Custom Agent',
  description: 'Custom AI coding agent',

  // Command template
  command: (options: AgentStartOptions) => {
    const { workspace, files, model, task } = options;
    return [
      'custom-agent',
      '--workspace', workspace,
      '--model', model,
      '--task', task,
      ...(files ? ['--files', files.join(',')] : [])
    ];
  },

  // Supported models
  supportedModels: [
    'claude-3-5-sonnet-20241022',
    'gpt-4o'
  ],

  // Resource requirements
  resources: {
    minMemoryMB: 500,
    maxConcurrent: 5,
    timeout: 300
  },

  // Validation rules
  validation: {
    maxFiles: 50,
    taskMinLength: 10,
    taskMaxLength: 2000,
    allowedWorkspacePaths: ['/home/coder/workspace']
  },

  // Output parsing
  outputParser: (line: string) => {
    // Custom logic to extract progress, status, etc.
    return {
      line,
      progress: extractProgress(line),
      status: extractStatus(line)
    };
  }
};
```

#### Step 3: Register Agent Type

```typescript
// src/config/agents/index.ts

import { aiderConfig } from './aider.config';
import { gooseConfig } from './goose.config';
import { clineConfig } from './cline.config';
import { customAgentConfig } from './custom-agent.config';

export const AGENT_CONFIGS: Record<AgentType, AgentTypeConfig> = {
  aider: aiderConfig,
  goose: gooseConfig,
  cline: clineConfig,
  custom: customAgentConfig
};

export function getAgentConfig(type: AgentType): AgentTypeConfig {
  const config = AGENT_CONFIGS[type];
  if (!config) {
    throw new Error(`Unknown agent type: ${type}`);
  }
  return config;
}
```

#### Step 4: Update API Routes

```typescript
// src/app/api/agents/route.ts

import { getAgentConfig } from '@/config/agents';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { agent_type, ...options } = body;

  // Get agent configuration
  const agentConfig = getAgentConfig(agent_type);

  // Validate agent-specific requirements
  if (!agentConfig.supportedModels.includes(options.model)) {
    return NextResponse.json(
      createProblemDetails(
        'validation-error',
        400,
        `Model ${options.model} not supported by ${agent_type}`
      ),
      { status: 400 }
    );
  }

  // Build command
  const command = agentConfig.command(options);

  // Forward to AgentAPI server
  const response = await fetch('http://localhost:3284/v1/agents/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      agent_type,
      command,
      workspace: options.workspace
    })
  });

  return NextResponse.json(await response.json());
}
```

#### Step 5: Add UI Components

```typescript
// src/components/agents/CustomAgentForm.tsx

import { useAgentStore } from '@/stores/agentStore';

export function CustomAgentForm() {
  const { startAgent } = useAgentStore();

  const handleSubmit = async (data: FormData) => {
    await startAgent({
      agent_type: 'custom',
      workspace: data.workspace,
      files: data.files,
      model: data.model,
      task: data.task
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
    </form>
  );
}
```

---

## Custom Model Integration

### Adding a New LLM Model

#### Step 1: Update Type Definitions

```typescript
// src/types/agent-api.ts

export type ModelType =
  | 'claude-3-5-sonnet-20241022'
  | 'claude-3-5-haiku-20241022'
  | 'gpt-4o'
  | 'gpt-4o-mini'
  | 'deepseek-chat'
  | 'custom-model';

export const MODEL_TYPES: ReadonlyArray<ModelType> = [
  'claude-3-5-sonnet-20241022',
  'claude-3-5-haiku-20241022',
  'gpt-4o',
  'gpt-4o-mini',
  'deepseek-chat',
  'custom-model',
] as const;
```

#### Step 2: Create Model Configuration

```typescript
// src/config/models/custom-model.config.ts

export interface ModelConfig {
  id: string;
  name: string;
  provider: string;
  contextWindow: number;
  maxOutputTokens: number;
  costPerToken: {
    input: number;
    output: number;
  };
  capabilities: {
    codeGeneration: boolean;
    codeAnalysis: boolean;
    multifile: boolean;
    streaming: boolean;
  };
  rateLimit: {
    requestsPerMinute: number;
    tokensPerMinute: number;
  };
}

export const customModelConfig: ModelConfig = {
  id: 'custom-model',
  name: 'Custom Model',
  provider: 'custom-provider',
  contextWindow: 128000,
  maxOutputTokens: 4096,
  costPerToken: {
    input: 0.000003,
    output: 0.000015
  },
  capabilities: {
    codeGeneration: true,
    codeAnalysis: true,
    multifile: true,
    streaming: true
  },
  rateLimit: {
    requestsPerMinute: 60,
    tokensPerMinute: 100000
  }
};
```

#### Step 3: Implement Model Client

```typescript
// src/lib/models/custom-model-client.ts

import { ModelClient, ModelResponse } from '@/types/model-client';

export class CustomModelClient implements ModelClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(config: { apiKey: string; baseUrl: string }) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl;
  }

  async generateCompletion(prompt: string, options: GenerateOptions): Promise<ModelResponse> {
    const response = await fetch(`${this.baseUrl}/v1/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: 'custom-model',
        prompt,
        max_tokens: options.maxTokens,
        temperature: options.temperature,
        stream: options.stream
      })
    });

    if (!response.ok) {
      throw new Error(`Model API error: ${response.statusText}`);
    }

    return await response.json();
  }

  async streamCompletion(prompt: string, options: StreamOptions): Promise<AsyncIterator<string>> {
    const response = await fetch(`${this.baseUrl}/v1/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: 'custom-model',
        prompt,
        stream: true
      })
    });

    if (!response.ok) {
      throw new Error(`Model API error: ${response.statusText}`);
    }

    return this.parseStreamResponse(response.body);
  }

  private async *parseStreamResponse(stream: ReadableStream): AsyncIterator<string> {
    const reader = stream.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim());

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));
            if (data.content) {
              yield data.content;
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}
```

#### Step 4: Register Model

```typescript
// src/config/models/index.ts

import { customModelConfig } from './custom-model.config';
import { CustomModelClient } from '@/lib/models/custom-model-client';

export const MODEL_CONFIGS: Record<ModelType, ModelConfig> = {
  'claude-3-5-sonnet-20241022': claudeConfig,
  'gpt-4o': gptConfig,
  'custom-model': customModelConfig
};

export function getModelClient(modelType: ModelType): ModelClient {
  switch (modelType) {
    case 'custom-model':
      return new CustomModelClient({
        apiKey: process.env.CUSTOM_MODEL_API_KEY!,
        baseUrl: process.env.CUSTOM_MODEL_BASE_URL!
      });
    // ... other models
  }
}
```

---

## Store Integration

### Extending Agent Store

```typescript
// src/stores/extensions/agentStoreExtension.ts

import { StateCreator } from 'zustand';
import { AgentStore } from '@/stores/agentStore';

export interface AgentStoreExtension {
  // Custom actions
  pauseAgent: (agentId: string) => Promise<void>;
  resumeAgent: (agentId: string) => Promise<void>;
  cloneAgent: (agentId: string) => Promise<AgentSession>;

  // Custom selectors
  getAgentHistory: (agentId: string) => AgentHistoryEntry[];
  getAgentMetrics: (agentId: string) => AgentMetrics;
}

export const createAgentStoreExtension: StateCreator<
  AgentStore & AgentStoreExtension,
  [],
  [],
  AgentStoreExtension
> = (set, get) => ({
  pauseAgent: async (agentId: string) => {
    set((state) => ({
      loading: {
        ...state.loading,
        pausing: new Set(state.loading.pausing).add(agentId)
      }
    }));

    try {
      const response = await fetch(`/api/agents/${agentId}/pause`, {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error('Failed to pause agent');
      }

      get().updateAgent(agentId, { status: 'paused' });
    } finally {
      set((state) => {
        const newLoading = { ...state.loading };
        newLoading.pausing.delete(agentId);
        return { loading: newLoading };
      });
    }
  },

  resumeAgent: async (agentId: string) => {
    // Implementation
  },

  cloneAgent: async (agentId: string) => {
    const agent = get().getAgent(agentId);
    if (!agent) {
      throw new Error('Agent not found');
    }

    return get().startAgent({
      agent_type: agent.agent_type,
      workspace: agent.workspace,
      model: agent.model,
      task: agent.task
    });
  },

  getAgentHistory: (agentId: string) => {
    // Return agent history from storage
    return [];
  },

  getAgentMetrics: (agentId: string) => {
    const agent = get().getAgent(agentId);
    if (!agent) {
      throw new Error('Agent not found');
    }

    return {
      uptime: agent.uptime_seconds,
      cpu: agent.resource_usage?.cpu_percent || 0,
      memory: agent.resource_usage?.memory_mb || 0,
      progress: agent.progress || 0
    };
  }
});
```

### Using Store Extensions

```typescript
// src/stores/agentStore.ts

import { create } from 'zustand';
import { createAgentStoreExtension } from './extensions/agentStoreExtension';

export const useAgentStore = create<AgentStore & AgentStoreExtension>()(
  devtools(
    persist(
      (...args) => ({
        ...createAgentStoreBase(...args),
        ...createAgentStoreExtension(...args)
      }),
      { name: 'agent-store' }
    )
  )
);
```

---

## Middleware Development

### Creating Custom Middleware

```typescript
// src/middleware/agent-middleware.ts

import { NextRequest, NextResponse } from 'next/server';

export interface AgentMiddleware {
  (
    request: NextRequest,
    context: AgentRequestContext
  ): Promise<NextResponse | void>;
}

export interface AgentRequestContext {
  agentId?: string;
  userId: string;
  sessionId: string;
}

// Audit logging middleware
export const auditLogMiddleware: AgentMiddleware = async (request, context) => {
  const startTime = Date.now();

  // Log request
  await logAuditEvent({
    type: 'agent_api_request',
    userId: context.userId,
    method: request.method,
    path: request.url,
    timestamp: new Date().toISOString()
  });

  // Continue to next middleware
  return undefined;
};

// Rate limiting middleware
export const rateLimitMiddleware: AgentMiddleware = async (request, context) => {
  const { userId } = context;

  const result = await checkRateLimit(userId, 'agent-api');

  if (!result.success) {
    return NextResponse.json(
      {
        type: 'rate-limit-exceeded',
        title: 'Rate Limit Exceeded',
        status: 429,
        detail: 'Too many requests'
      },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': result.limit.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': result.reset.toString(),
          'Retry-After': result.retryAfter.toString()
        }
      }
    );
  }
};

// Request validation middleware
export const validationMiddleware: AgentMiddleware = async (request, context) => {
  if (request.method === 'POST') {
    const body = await request.json();

    try {
      startAgentSchema.parse(body);
    } catch (error) {
      return NextResponse.json(
        {
          type: 'validation-error',
          title: 'Validation Error',
          status: 400,
          detail: 'Invalid request body',
          errors: error.errors
        },
        { status: 400 }
      );
    }
  }
};

// Compose middlewares
export function composeMiddlewares(...middlewares: AgentMiddleware[]) {
  return async (request: NextRequest, context: AgentRequestContext) => {
    for (const middleware of middlewares) {
      const result = await middleware(request, context);
      if (result) {
        return result;
      }
    }
  };
}
```

### Applying Middleware

```typescript
// src/app/api/agents/route.ts

import { composeMiddlewares, auditLogMiddleware, rateLimitMiddleware, validationMiddleware } from '@/middleware/agent-middleware';

const middleware = composeMiddlewares(
  auditLogMiddleware,
  rateLimitMiddleware,
  validationMiddleware
);

export async function POST(request: NextRequest) {
  const token = await getToken({ req: request });

  const context = {
    userId: token?.sub!,
    sessionId: token?.sessionId!
  };

  // Run middleware chain
  const middlewareResult = await middleware(request, context);
  if (middlewareResult) {
    return middlewareResult;
  }

  // Process request
  // ...
}
```

---

## Testing Strategies

### Unit Testing

```typescript
// src/stores/__tests__/agentStore.test.ts

import { renderHook, act } from '@testing-library/react';
import { useAgentStore } from '@/stores/agentStore';

describe('AgentStore', () => {
  beforeEach(() => {
    useAgentStore.getState().clearAll();
  });

  it('should start agent', async () => {
    const { result } = renderHook(() => useAgentStore());

    const mockAgent = {
      agent_type: 'aider',
      workspace: '/home/coder/workspace/test',
      model: 'claude-3-5-sonnet-20241022',
      task: 'Test task'
    };

    await act(async () => {
      await result.current.startAgent(mockAgent);
    });

    expect(result.current.sessions.size).toBe(1);
    expect(result.current.stats.running).toBe(1);
  });

  it('should update agent status', () => {
    const { result } = renderHook(() => useAgentStore());

    act(() => {
      result.current.updateAgent('test-agent', {
        status: 'completed',
        exit_code: 0
      });
    });

    const agent = result.current.getAgent('test-agent');
    expect(agent?.status).toBe('completed');
  });
});
```

### Integration Testing

```typescript
// tests/integration/agent-api.test.ts

import { testClient } from '@/tests/utils/test-client';

describe('Agent API Integration', () => {
  it('should create and monitor agent', async () => {
    // Start agent
    const createResponse = await testClient.post('/api/agents', {
      agent_type: 'aider',
      workspace: '/home/coder/workspace/test',
      files: ['test.py'],
      model: 'claude-3-5-sonnet-20241022',
      task: 'Add tests'
    });

    expect(createResponse.status).toBe(201);
    const agent = await createResponse.json();
    expect(agent.agent_id).toBeDefined();

    // Get status
    const statusResponse = await testClient.get(`/api/agents/${agent.agent_id}`);
    expect(statusResponse.status).toBe(200);

    const status = await statusResponse.json();
    expect(status.status).toBe('running');

    // Stop agent
    const stopResponse = await testClient.delete(`/api/agents/${agent.agent_id}`);
    expect(stopResponse.status).toBe(200);
  });
});
```

### E2E Testing

```typescript
// tests/e2e/agent-workflow.test.ts

import { test, expect } from '@playwright/test';

test('complete agent workflow', async ({ page }) => {
  await page.goto('/agents');

  // Create agent
  await page.click('[data-testid="create-agent-button"]');
  await page.fill('[data-testid="agent-type"]', 'aider');
  await page.fill('[data-testid="task"]', 'Add error handling');
  await page.click('[data-testid="submit"]');

  // Wait for agent to start
  await expect(page.locator('[data-testid="agent-status"]')).toContainText('running');

  // Monitor output
  await expect(page.locator('[data-testid="agent-output"]')).toBeVisible();

  // Wait for completion
  await expect(page.locator('[data-testid="agent-status"]')).toContainText('completed', {
    timeout: 30000
  });
});
```

---

## Performance Optimization

### Caching Strategy

```typescript
// src/lib/cache/agent-cache.ts

import { Redis } from 'ioredis';
import { AGENT_CACHE_TTL, AGENT_REDIS_PREFIXES } from '@/config/redis-agentapi.config';

export class AgentCache {
  private redis: Redis;

  constructor(redis: Redis) {
    this.redis = redis;
  }

  async getAgentStatus(agentId: string): Promise<AgentStatusResponse | null> {
    const key = `${AGENT_REDIS_PREFIXES.SESSION}${agentId}`;
    const cached = await this.redis.get(key);

    if (cached) {
      return JSON.parse(cached);
    }

    return null;
  }

  async setAgentStatus(agentId: string, status: AgentStatusResponse): Promise<void> {
    const key = `${AGENT_REDIS_PREFIXES.SESSION}${agentId}`;
    await this.redis.setex(
      key,
      AGENT_CACHE_TTL.SESSION_LOOKUP,
      JSON.stringify(status)
    );
  }

  async invalidateAgent(agentId: string): Promise<void> {
    const key = `${AGENT_REDIS_PREFIXES.SESSION}${agentId}`;
    await this.redis.del(key);
  }
}
```

### Connection Pooling

```typescript
// src/lib/http/agent-api-client.ts

import { Agent } from 'http';

export class AgentAPIClient {
  private httpAgent: Agent;

  constructor() {
    this.httpAgent = new Agent({
      keepAlive: true,
      keepAliveMsecs: 30000,
      maxSockets: 50,
      maxFreeSockets: 10
    });
  }

  async request(path: string, options: RequestInit = {}) {
    return fetch(`http://localhost:3284${path}`, {
      ...options,
      // @ts-ignore
      agent: this.httpAgent
    });
  }
}
```

### Batch Operations

```typescript
// src/lib/api/batch-operations.ts

export async function batchGetAgentStatus(agentIds: string[]): Promise<AgentStatusResponse[]> {
  // Use Redis MGET for efficient batch retrieval
  const keys = agentIds.map(id => `${AGENT_REDIS_PREFIXES.SESSION}${id}`);
  const cached = await redis.mget(...keys);

  const results: AgentStatusResponse[] = [];
  const missing: string[] = [];

  cached.forEach((value, index) => {
    if (value) {
      results.push(JSON.parse(value));
    } else {
      missing.push(agentIds[index]);
    }
  });

  // Fetch missing from API
  if (missing.length > 0) {
    const freshData = await Promise.all(
      missing.map(id => fetchAgentStatus(id))
    );
    results.push(...freshData);
  }

  return results;
}
```

---

## Security Considerations

### Input Validation

```typescript
// src/lib/validation/agent-validation.ts

import { z } from 'zod';

export const startAgentSchema = z.object({
  agent_type: z.enum(['aider', 'goose', 'cline']),
  workspace: z.string()
    .regex(/^\/home\/coder\/workspace/, 'Invalid workspace path')
    .max(500),
  files: z.array(z.string().max(500)).max(50).optional(),
  model: z.enum([
    'claude-3-5-sonnet-20241022',
    'gpt-4o',
    'deepseek-chat'
  ]),
  task: z.string().min(10).max(2000),
  metadata: z.record(z.unknown()).optional()
}).strict();

export function validateAgentRequest(data: unknown) {
  return startAgentSchema.parse(data);
}
```

### Authorization

```typescript
// src/lib/auth/agent-authorization.ts

export async function canUserAccessAgent(
  userId: string,
  agentId: string
): Promise<boolean> {
  // Check ownership
  const agent = await getAgentStatus(agentId);
  if (!agent) return false;

  // Verify user owns the agent
  return agent.user_id === userId;
}

export async function canUserCreateAgent(
  userId: string
): Promise<boolean> {
  // Check concurrent agent limit
  const activeAgents = await getActiveAgentsByUser(userId);
  return activeAgents.length < 5;
}
```

### Audit Logging

```typescript
// src/lib/audit/agent-audit.ts

export interface AuditLogEntry {
  timestamp: string;
  userId: string;
  action: string;
  resource: string;
  metadata: Record<string, any>;
}

export async function logAgentAction(
  userId: string,
  action: 'create' | 'stop' | 'message',
  agentId: string,
  metadata?: Record<string, any>
) {
  const entry: AuditLogEntry = {
    timestamp: new Date().toISOString(),
    userId,
    action,
    resource: agentId,
    metadata: metadata || {}
  };

  // Log to audit system
  await auditLogger.log(entry);

  // Also send to Datadog
  await datadogLogger.info('agent_action', entry);
}
```

---

## Next Steps

- [API Reference](./02-API-REFERENCE.md) - Complete API documentation
- [Troubleshooting Guide](./04-TROUBLESHOOTING.md) - Debugging agents
- [Migration Guide](./05-MIGRATION-GUIDE.md) - Upgrading from legacy API
