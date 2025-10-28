# OpenAI Agents API Reference

**Version**: 1.0.0
**Last Updated**: 2025-10-02
**Base URL**: `/api/agents`

## Table of Contents

1. [Authentication](#authentication)
2. [Rate Limiting](#rate-limiting)
3. [Error Handling](#error-handling)
4. [Endpoints](#endpoints)
5. [Data Types](#data-types)
6. [SSE Events](#sse-events)
7. [WebSocket Protocol](#websocket-protocol)
8. [Examples](#examples)

---

## Authentication

All API requests require authentication using NextAuth session cookies or API key header.

### Session Authentication (Recommended)

```typescript
// Automatic with Next.js session
const response = await fetch('/api/agents', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(agentConfig),
  credentials: 'include' // Include session cookie
});
```

### API Key Authentication

```typescript
const response = await fetch('/api/agents', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'your-api-key'
  },
  body: JSON.stringify(agentConfig)
});
```

---

## Rate Limiting

### Rate Limit Headers

All responses include rate limit information:

```
X-RateLimit-Limit: 30          # Maximum requests per window
X-RateLimit-Remaining: 25      # Remaining requests
X-RateLimit-Reset: 1696248000  # Reset time (Unix timestamp)
```

### Rate Limit Response (429)

```json
{
  "type": "https://vibecode.com/errors/rate-limit-exceeded",
  "title": "Rate Limit Exceeded",
  "status": 429,
  "detail": "Too many agent creation requests. Please wait before retrying.",
  "instance": "/api/agents",
  "trace_id": "abc123-def456"
}
```

Response includes additional header:
```
Retry-After: 60  # Seconds until rate limit resets
```

### Rate Limits

**Per User:**
- 30 messages per minute per agent
- 5 concurrent agents maximum
- 1000 messages per hour per workspace

**Global:**
- 10,000 active agents maximum
- 100 messages per second system-wide

---

## Error Handling

All errors follow RFC 7807 Problem Details standard.

### Error Response Format

```typescript
interface ProblemDetails {
  type: string;        // URI identifying error type
  title: string;       // Short, human-readable summary
  status: number;      // HTTP status code
  detail?: string;     // Detailed explanation
  instance?: string;   // URI reference to specific occurrence
  trace_id?: string;   // Distributed tracing ID
  [key: string]: any;  // Additional context
}
```

### Common Error Types

#### 400 Bad Request
```json
{
  "type": "https://vibecode.com/errors/validation-error",
  "title": "Validation Error",
  "status": 400,
  "detail": "Invalid workspace path: must start with /home/coder/workspace",
  "instance": "/api/agents",
  "errors": {
    "workspace": ["Invalid path format"]
  }
}
```

#### 401 Unauthorized
```json
{
  "type": "https://vibecode.com/errors/unauthorized",
  "title": "Unauthorized",
  "status": 401,
  "detail": "Authentication required to access this resource"
}
```

#### 404 Not Found
```json
{
  "type": "https://vibecode.com/errors/not-found",
  "title": "Not Found",
  "status": 404,
  "detail": "Agent with ID 'aider-abc12345' not found",
  "agent_id": "aider-abc12345"
}
```

#### 429 Rate Limit Exceeded
```json
{
  "type": "https://vibecode.com/errors/rate-limit-exceeded",
  "title": "Rate Limit Exceeded",
  "status": 429,
  "detail": "Maximum concurrent agents reached (5/5)",
  "current": 5,
  "limit": 5,
  "reset_at": "2025-10-02T10:30:00Z"
}
```

#### 500 Internal Server Error
```json
{
  "type": "https://vibecode.com/errors/internal-error",
  "title": "Internal Server Error",
  "status": 500,
  "detail": "An unexpected error occurred",
  "trace_id": "abc123-def456"
}
```

---

## Endpoints

### POST /api/agents

Create and start a new agent.

**Request Body:**
```typescript
{
  agent_type: 'aider' | 'goose' | 'cline';
  workspace: string;              // Absolute path
  files?: string[];               // Max 50 files
  model: ModelType;
  task: string;                   // 10-2000 characters
  metadata?: Record<string, any>;
}
```

**Response (201 Created):**
```typescript
{
  agent_id: string;        // e.g., "aider-abc12345"
  status: 'running';
  terminal_id: string;
  pid: number;
  command: string;
  created_at: string;      // ISO 8601
  stream_url: string;      // SSE endpoint
  ws_url: string;          // WebSocket endpoint
}
```

**Example:**
```typescript
const response = await fetch('/api/agents', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    agent_type: 'aider',
    workspace: '/home/coder/workspace/my-project',
    files: ['src/main.py'],
    model: 'claude-3-5-sonnet-20241022',
    task: 'Add error handling to login function'
  })
});

const agent = await response.json();
console.log('Agent ID:', agent.agent_id);
```

---

### GET /api/agents

List all agents with optional filtering and pagination.

**Query Parameters:**
```typescript
{
  status?: 'running' | 'completed' | 'failed' | 'stopped' | 'error';
  agent_type?: 'aider' | 'goose' | 'cline';
  page?: number;      // Default: 1
  limit?: number;     // Default: 50, Max: 100
}
```

**Response (200 OK):**
```typescript
{
  agents: AgentStatusResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  summary?: {
    active: number;
    completed: number;
    failed: number;
    by_type: {
      aider: number;
      goose: number;
      cline: number;
    };
  };
}
```

**Example:**
```typescript
// Get all running agents
const response = await fetch('/api/agents?status=running&limit=20');
const data = await response.json();

console.log(`Found ${data.agents.length} running agents`);
data.agents.forEach(agent => {
  console.log(`- ${agent.agent_id} (${agent.agent_type})`);
});
```

---

### GET /api/agents/:agentId

Get detailed status for a specific agent.

**Path Parameters:**
- `agentId`: Agent identifier (e.g., "aider-abc12345")

**Response (200 OK):**
```typescript
{
  agent_id: string;
  agent_type: 'aider' | 'goose' | 'cline';
  status: AgentStatus;
  terminal_id: string;
  pid: number;
  workspace: string;
  uptime_seconds: number;
  exit_code: number | null;
  resource_usage?: {
    cpu_percent: number;
    memory_mb: number;
    disk_io_mb: number;
  };
  output_lines?: number;
  last_output?: string;
  last_output_at: string | null;
  created_at: string;
}
```

**Example:**
```typescript
const response = await fetch('/api/agents/aider-abc12345');
const agent = await response.json();

console.log('Status:', agent.status);
console.log('Uptime:', agent.uptime_seconds, 'seconds');
console.log('CPU:', agent.resource_usage?.cpu_percent, '%');
console.log('Memory:', agent.resource_usage?.memory_mb, 'MB');
```

---

### DELETE /api/agents/:agentId

Stop a running agent.

**Path Parameters:**
- `agentId`: Agent identifier

**Query Parameters:**
```typescript
{
  force?: boolean;  // Force termination (SIGKILL)
}
```

**Response (200 OK):**
```typescript
{
  agent_id: string;
  status: 'stopped';
  message: string;
  stopped_at: string;      // ISO 8601
  exit_code: number | null;
  forced: boolean;
}
```

**Example:**
```typescript
// Graceful stop
const response = await fetch('/api/agents/aider-abc12345', {
  method: 'DELETE'
});

// Force stop
const response = await fetch('/api/agents/aider-abc12345?force=true', {
  method: 'DELETE'
});

const result = await response.json();
console.log('Agent stopped:', result.agent_id);
```

---

### POST /api/agents/:agentId/message

Send a message to a running agent.

**Path Parameters:**
- `agentId`: Agent identifier

**Request Body:**
```typescript
{
  message: string;        // 1-5000 characters
  type?: 'user' | 'system';  // Default: 'user'
}
```

**Response (200 OK):**
```typescript
{
  message_id: string;     // UUID
  status: 'sent' | 'queued' | 'failed';
  timestamp: string;      // ISO 8601
}
```

**Example:**
```typescript
const response = await fetch('/api/agents/aider-abc12345/message', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: 'Please add unit tests for this function',
    type: 'user'
  })
});

const result = await response.json();
console.log('Message sent:', result.message_id);
```

---

### GET /api/agents/:agentId/events

Server-Sent Events (SSE) stream for real-time agent output.

**Path Parameters:**
- `agentId`: Agent identifier

**Query Parameters:**
```typescript
{
  from_sequence?: number;  // Resume from specific event
}
```

**Response Headers:**
```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

**Event Stream Format:**
```
event: output
id: 123
data: {"timestamp":"2025-10-02T10:30:00Z","line":"Processing file..."}

event: status
id: 124
data: {"timestamp":"2025-10-02T10:30:01Z","status":"running","progress":0.5}

event: complete
id: 125
data: {"timestamp":"2025-10-02T10:30:05Z","status":"completed","exit_code":0}
```

**Example:**
```typescript
const eventSource = new EventSource('/api/agents/aider-abc12345/events');

eventSource.addEventListener('output', (event) => {
  const data = JSON.parse(event.data);
  console.log('[Agent]:', data.line);
});

eventSource.addEventListener('status', (event) => {
  const data = JSON.parse(event.data);
  console.log('Status:', data.status, 'Progress:', data.progress * 100 + '%');
});

eventSource.addEventListener('error', (event) => {
  const data = JSON.parse(event.data);
  console.error('Error:', data.error);
});

eventSource.addEventListener('complete', (event) => {
  const data = JSON.parse(event.data);
  console.log('Completed with exit code:', data.exit_code);
  eventSource.close();
});
```

---

### GET /api/agents/:agentId/ws

WebSocket connection for bidirectional agent communication.

**Path Parameters:**
- `agentId`: Agent identifier

**WebSocket Subprotocol:**
```
agent-v1
```

**Client → Server Messages:**
```typescript
// Send message to agent
{
  type: 'message',
  content: string
}

// Ping for keep-alive
{
  type: 'ping'
}
```

**Server → Client Messages:**
```typescript
// Agent output
{
  type: 'output',
  content: string,
  timestamp: string
}

// Status update
{
  type: 'status',
  status: AgentStatus,
  progress?: number
}

// Error
{
  type: 'error',
  error: string
}

// Completion
{
  type: 'complete',
  exit_code: number
}

// Pong response
{
  type: 'pong'
}
```

**Example:**
```typescript
const ws = new WebSocket(
  'ws://localhost:3000/api/agents/aider-abc12345/ws',
  'agent-v1'
);

ws.onopen = () => {
  console.log('WebSocket connected');

  // Send message to agent
  ws.send(JSON.stringify({
    type: 'message',
    content: 'Add error handling'
  }));
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);

  switch (message.type) {
    case 'output':
      console.log('[Agent]:', message.content);
      break;

    case 'status':
      console.log('Status:', message.status);
      break;

    case 'error':
      console.error('Error:', message.error);
      break;

    case 'complete':
      console.log('Completed:', message.exit_code);
      ws.close();
      break;
  }
};

ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};

ws.onclose = () => {
  console.log('WebSocket closed');
};
```

---

### GET /api/agents/health

Health check endpoint for monitoring.

**Response (200 OK):**
```typescript
{
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  timestamp: string;    // ISO 8601
  checks?: {
    [component: string]: {
      status: 'pass' | 'warn' | 'fail';
      response_time_ms: number;
      error?: string;
    };
  };
  agents?: {
    active: number;
    max_concurrent: number;
    user_limit: number;
  };
  uptime_seconds?: number;
}
```

**Example:**
```typescript
const response = await fetch('/api/agents/health');
const health = await response.json();

console.log('System status:', health.status);
console.log('Active agents:', health.agents?.active);
console.log('Uptime:', health.uptime_seconds, 'seconds');
```

---

## Data Types

### AgentType
```typescript
type AgentType = 'aider' | 'goose' | 'cline';
```

### ModelType
```typescript
type ModelType =
  | 'claude-3-5-sonnet-20241022'
  | 'claude-3-5-haiku-20241022'
  | 'gpt-4o'
  | 'gpt-4o-mini'
  | 'deepseek-chat';
```

### AgentStatus
```typescript
type AgentStatus =
  | 'running'
  | 'completed'
  | 'failed'
  | 'stopped'
  | 'error';
```

### StartAgentRequest
```typescript
interface StartAgentRequest {
  agent_type: AgentType;
  workspace: string;              // Absolute path starting with /home/coder/workspace
  files?: string[];               // Max 50 files, relative paths
  model: ModelType;
  task: string;                   // 10-2000 characters
  metadata?: Record<string, unknown>;
}
```

### AgentResponse
```typescript
interface AgentResponse {
  agent_id: string;               // Format: {type}-{hex8}
  status: AgentStatus;
  terminal_id: string;
  pid?: number;
  command?: string;
  created_at: string;             // ISO 8601
  stream_url?: string;
  ws_url?: string;
}
```

### AgentStatusResponse
```typescript
interface AgentStatusResponse extends AgentResponse {
  agent_type: AgentType;
  workspace: string;
  uptime_seconds: number;
  exit_code: number | null;
  resource_usage?: {
    cpu_percent: number;
    memory_mb: number;
    disk_io_mb: number;
  };
  output_lines?: number;
  last_output?: string;
  last_output_at: string | null;
}
```

---

## SSE Events

### Event Types

#### output
Agent standard output line.

```typescript
{
  event: 'output',
  id: string,
  data: {
    timestamp: string,
    line: string
  }
}
```

#### status
Agent status change.

```typescript
{
  event: 'status',
  id: string,
  data: {
    timestamp: string,
    status: AgentStatus,
    progress?: number  // 0.0 to 1.0
  }
}
```

#### error
Agent error occurred.

```typescript
{
  event: 'error',
  id: string,
  data: {
    timestamp: string,
    error: string,
    code?: string
  }
}
```

#### complete
Agent task completed.

```typescript
{
  event: 'complete',
  id: string,
  data: {
    timestamp: string,
    status: 'completed' | 'failed' | 'stopped',
    exit_code: number
  }
}
```

#### heartbeat
Keep-alive heartbeat (every 30 seconds).

```typescript
{
  event: 'heartbeat',
  id: string,
  data: {
    timestamp: string
  }
}
```

---

## WebSocket Protocol

### Connection

```typescript
const ws = new WebSocket(wsUrl, 'agent-v1');
```

### Client Messages

```typescript
// Send message
{
  type: 'message',
  content: string
}

// Ping
{
  type: 'ping'
}
```

### Server Messages

```typescript
// Output
{
  type: 'output',
  content: string,
  timestamp: string
}

// Status
{
  type: 'status',
  status: AgentStatus,
  progress?: number
}

// Error
{
  type: 'error',
  error: string
}

// Complete
{
  type: 'complete',
  exit_code: number
}

// Pong
{
  type: 'pong'
}
```

---

## Examples

### Complete Agent Lifecycle

```typescript
import { useAgentStore } from '@/stores/agentStore';

async function runAgentTask() {
  const { startAgent, stopAgent } = useAgentStore.getState();

  // 1. Start agent
  const agent = await startAgent({
    agent_type: 'aider',
    workspace: '/home/coder/workspace/my-project',
    files: ['src/main.py'],
    model: 'claude-3-5-sonnet-20241022',
    task: 'Add comprehensive error handling'
  });

  console.log('Agent started:', agent.agent_id);

  // 2. Connect to SSE stream
  const eventSource = new EventSource(agent.stream_url);

  eventSource.addEventListener('output', (event) => {
    const data = JSON.parse(event.data);
    console.log('[Agent]:', data.line);
  });

  eventSource.addEventListener('complete', async (event) => {
    const data = JSON.parse(event.data);
    console.log('Agent completed with exit code:', data.exit_code);
    eventSource.close();

    // 3. Clean up
    if (data.exit_code === 0) {
      console.log('Task completed successfully!');
    } else {
      console.error('Task failed');
    }
  });

  // 4. Optional: Stop after timeout
  setTimeout(async () => {
    await stopAgent(agent.agent_id);
    eventSource.close();
  }, 300000); // 5 minutes
}
```

### Error Handling

```typescript
async function createAgentWithRetry(config, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });

      if (!response.ok) {
        const problem = await response.json();

        // Handle rate limiting
        if (response.status === 429) {
          const retryAfter = parseInt(
            response.headers.get('Retry-After') || '60'
          );
          console.log(`Rate limited. Retrying in ${retryAfter}s...`);
          await new Promise(r => setTimeout(r, retryAfter * 1000));
          continue;
        }

        // Handle other errors
        throw new Error(problem.detail || problem.title);
      }

      return await response.json();

    } catch (error) {
      if (i === maxRetries - 1) throw error;
      console.log(`Attempt ${i + 1} failed, retrying...`);
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
}
```

---

## Rate Limits Summary

| Resource | Limit | Window |
|----------|-------|--------|
| Agent creation | 10 per user | 1 minute |
| Messages per agent | 30 | 1 minute |
| Messages per workspace | 1000 | 1 hour |
| Concurrent agents per user | 5 | N/A |
| Global concurrent agents | 10,000 | N/A |

---

## Agent Builder Workflows

### POST /api/agent-builder/session

Creates a ChatKit session for a published Agent Builder workflow. Sessions return a short-lived `clientSecret` used by the `/agent-builder` UI to embed ChatKit. Requires an authenticated user session.

#### Request Body
```jsonc
{
  "workflowId": "wf_12345",
  "version": "2024-10-06",
  "stateVariables": {
    "tenant": "acme",
    "region": "us-east-1"
  },
  "expiresInSeconds": 900,
  "rateLimitPerMinute": 20,
  "chatkit": {
    "automaticThreadTitling": { "enabled": false },
    "uploads": { "enabled": true, "maxFiles": 5, "maxFileSizeMB": 50 },
    "history": { "enabled": true, "recentThreads": 10 }
  }
}
```

#### Response
```json
{
  "sessionId": "cksess_xxx",
  "clientSecret": "chatkit-ephemeral-secret",
  "expiresAt": 1759853618,
  "status": "active",
  "workflow": {
    "id": "wf_12345",
    "version": "2024-10-06"
  },
  "maxRequestsPerMinute": 20
}
```

Errors follow the standard RFC 7807 structure documented earlier in this reference.

---

## Next Steps

- [User Guide](./01-USER-GUIDE.md) - Getting started guide
- [Developer Guide](./03-DEVELOPER-GUIDE.md) - Extending agents
- [Troubleshooting](./04-TROUBLESHOOTING.md) - Common issues
