# AgentAPI Integration Design for VibeCode

**Document Version:** 1.0
**Date:** 2025-10-02
**Author:** Backend Architecture Team
**Status:** Design Proposal

---

## Executive Summary

This document outlines the backend architecture for integrating `agentapi` (HTTP server for controlling coding agents via terminal emulation) into VibeCode's existing Next.js application with code-server workspace management.

**Key Design Decisions:**
- **Deployment Model:** Sidecar containers alongside code-server instances
- **API Bridge:** Dedicated Next.js API routes with WebSocket upgrade support
- **Session Management:** Redis-backed session store mapping users → workspaces → agents
- **Message Routing:** Session-based routing with persistent connection pooling
- **State Persistence:** PostgreSQL + Redis hybrid for conversation history and agent state

---

## 1. System Architecture Overview

### 1.1 Current Architecture

```
User Browser
    ↓
Next.js Frontend (:3000)
    ↓
Next.js API Routes (/api/*)
    ↓
Docker code-server containers (dynamically provisioned)
    ↓ (via extensions)
AI Assistants (Cline, Continue, etc.)
```

### 1.2 Target Architecture with AgentAPI

```
User Browser
    ↓
Next.js Frontend (:3000)
    ↓
┌─────────────────────────────────────────────────┐
│ Next.js API Routes                              │
│  - /api/workspaces         (workspace mgmt)     │
│  - /api/agents             (agent lifecycle)    │
│  - /api/agents/message     (agent communication)│
│  - /api/agents/ws          (WebSocket upgrade)  │
└─────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────┐
│ Session Manager (Redis + PostgreSQL)            │
│  - User → Workspace mapping                     │
│  - Workspace → Agent mapping                    │
│  - Conversation history persistence             │
└─────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────┐
│ Container Orchestration Layer                   │
│  - Kubernetes (production)                      │
│  - Apple Container (local dev)                  │
└─────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────┐
│ Pod/Container: Workspace Instance               │
│  ┌───────────────────────────────────────────┐  │
│  │ code-server (:8765)                       │  │
│  │  - VSCode extensions                      │  │
│  │  - Terminal access                        │  │
│  │  - File system                            │  │
│  └───────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────┐  │
│  │ agentapi (:8766)                          │  │
│  │  - HTTP API server                        │  │
│  │  - Terminal emulation (pty)               │  │
│  │  - Agent process management               │  │
│  │  - Stream buffering                       │  │
│  └───────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────┐  │
│  │ Coding Agent Process (Aider/Claude/etc)   │  │
│  │  - Controlled by agentapi                 │  │
│  │  - Reads/writes via pty                   │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

---

## 2. Deployment Model: Sidecar Pattern

### 2.1 Design Choice: Sidecar Container

**Selected Approach:** Deploy agentapi as sidecar container in same pod/namespace as code-server

**Rationale:**
1. **Isolation:** Each workspace gets dedicated agentapi instance (security, resource accounting)
2. **Locality:** agentapi and code-server share filesystem via volume mounts (fast I/O)
3. **Lifecycle:** agentapi lifecycle tied to workspace (automatic cleanup)
4. **Scalability:** Scales linearly with workspaces (no bottleneck)
5. **Simplicity:** No complex routing, agent-to-workspace mapping is 1:1

**Alternatives Considered:**

| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| **Embedded in Next.js** | Simple deployment | Not scalable, shared state, resource contention | ❌ Rejected |
| **Separate Service** | Centralized management | Complex routing, single point of failure | ❌ Rejected |
| **Sidecar Container** | Isolation, scalability, simplicity | Higher resource overhead per workspace | ✅ **Selected** |

### 2.2 Container Specification

**Kubernetes Pod Template:**

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: workspace-${workspaceId}
  namespace: vibecode
  labels:
    app: vibecode
    component: workspace
    workspaceId: ${workspaceId}
    userId: ${userId}
spec:
  containers:
  # Existing code-server container
  - name: code-server
    image: vibecode/code-server:latest
    ports:
    - containerPort: 8765
      name: code-server
    volumeMounts:
    - name: workspace
      mountPath: /home/coder/workspace
    resources:
      requests:
        memory: "1Gi"
        cpu: "500m"
      limits:
        memory: "2Gi"
        cpu: "1000m"

  # NEW: agentapi sidecar
  - name: agentapi
    image: vibecode/agentapi:latest
    ports:
    - containerPort: 8766
      name: agentapi
    env:
    - name: AGENTAPI_PORT
      value: "8766"
    - name: WORKSPACE_PATH
      value: "/workspace"
    - name: LOG_LEVEL
      value: "info"
    - name: MAX_AGENTS
      value: "3"
    volumeMounts:
    - name: workspace
      mountPath: /workspace
    resources:
      requests:
        memory: "512Mi"
        cpu: "250m"
      limits:
        memory: "1Gi"
        cpu: "500m"
    livenessProbe:
      httpGet:
        path: /health
        port: 8766
      initialDelaySeconds: 10
      periodSeconds: 30
    readinessProbe:
      httpGet:
        path: /ready
        port: 8766
      initialDelaySeconds: 5
      periodSeconds: 10

  volumes:
  - name: workspace
    persistentVolumeClaim:
      claimName: workspace-${workspaceId}
```

**Resource Requirements per Workspace:**

| Component | Memory | CPU | Notes |
|-----------|--------|-----|-------|
| code-server | 1-2 GB | 0.5-1 vCPU | Existing baseline |
| agentapi | 512MB-1GB | 0.25-0.5 vCPU | HTTP server + pty overhead |
| Agent process | 256-512MB | 0.1-0.25 vCPU | Per agent (up to 3) |
| **Total** | **2-4 GB** | **1-2 vCPU** | Per workspace |

---

## 3. API Bridge Design

### 3.1 Next.js API Routes

**New API Endpoints:**

```typescript
/api/agents
  GET    - List all agents for authenticated user
  POST   - Create new agent in workspace

/api/agents/[agentId]
  GET    - Get agent status and metadata
  DELETE - Stop and remove agent
  PATCH  - Update agent configuration

/api/agents/[agentId]/message
  POST   - Send message to agent (HTTP)

/api/agents/[agentId]/stream
  GET    - Server-Sent Events (SSE) for agent output

/api/agents/ws
  GET    - WebSocket upgrade for real-time bidirectional communication
```

### 3.2 API Schemas

**Create Agent Request:**

```typescript
POST /api/agents
Authorization: Bearer <session-token>

{
  "workspaceId": "ws-abc123",
  "agentType": "aider" | "goose" | "claude-cli",
  "config": {
    "model": "claude-3-7-sonnet-20250219",
    "temperature": 0.7,
    "maxTokens": 4096,
    "systemPrompt": "You are a helpful coding assistant..."
  },
  "environment": {
    "ANTHROPIC_API_KEY": "sk-ant-...",
    "OPENROUTER_API_KEY": "sk-or-..."
  }
}

Response 201:
{
  "agentId": "agent-xyz789",
  "workspaceId": "ws-abc123",
  "status": "starting",
  "agentapiUrl": "http://agentapi-ws-abc123.vibecode.svc.cluster.local:8766",
  "createdAt": "2025-10-02T10:30:00Z"
}
```

**Send Message Request:**

```typescript
POST /api/agents/agent-xyz789/message
Authorization: Bearer <session-token>

{
  "message": "Refactor the authentication module to use bcrypt",
  "context": {
    "files": ["/workspace/src/lib/auth.ts"],
    "selection": { "start": 50, "end": 80 }
  },
  "options": {
    "streaming": true,
    "timeout": 300000  // 5 minutes
  }
}

Response 200 (streaming):
data: {"type":"status","status":"processing"}
data: {"type":"token","content":"I'll help you"}
data: {"type":"token","content":" refactor the"}
data: {"type":"file_edit","path":"/workspace/src/lib/auth.ts","diff":"..."}
data: {"type":"complete","tokensUsed":1250}
```

### 3.3 Request Flow

```
1. User → Next.js /api/agents/[id]/message
2. Next.js validates session + ownership
3. Next.js looks up workspace from agentId (Redis)
4. Next.js gets agentapi URL for workspace (Redis)
5. Next.js proxies request to agentapi HTTP endpoint
6. agentapi writes to agent pty stdin
7. agentapi buffers pty stdout
8. Next.js streams response back to user
9. Next.js logs request metrics (Datadog)
```

---

## 4. Session Management

### 4.1 Data Model

**Redis Keys (Fast Access):**

```redis
# User → Workspaces mapping
user:sessions:{userId}                    → Set<workspaceId>

# Workspace → Agent mapping
workspace:agents:{workspaceId}            → Set<agentId>

# Agent metadata (hot cache, 1h TTL)
agent:{agentId}:metadata                  → Hash {
  workspaceId, userId, agentType, status,
  agentapiUrl, createdAt, lastActivity
}

# Active connections (WebSocket tracking)
agent:{agentId}:connections               → Set<connectionId>

# Rate limiting
user:{userId}:agent_requests:{window}     → Counter (TTL 60s)
```

**PostgreSQL Tables (Durable Storage):**

```sql
-- Agent instances (persistent metadata)
CREATE TABLE agents (
  id VARCHAR(64) PRIMARY KEY,
  workspace_id VARCHAR(64) NOT NULL REFERENCES workspaces(id),
  user_id VARCHAR(64) NOT NULL,
  agent_type VARCHAR(32) NOT NULL,
  config JSONB NOT NULL,
  status VARCHAR(32) NOT NULL,
  agentapi_url VARCHAR(512) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,

  INDEX idx_workspace_agents (workspace_id, deleted_at),
  INDEX idx_user_agents (user_id, deleted_at),
  INDEX idx_status (status)
);

-- Conversation history (messages + context)
CREATE TABLE agent_messages (
  id BIGSERIAL PRIMARY KEY,
  agent_id VARCHAR(64) NOT NULL REFERENCES agents(id),
  direction VARCHAR(16) NOT NULL,  -- 'user_to_agent' | 'agent_to_user'
  content TEXT NOT NULL,
  metadata JSONB,
  tokens_used INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  INDEX idx_agent_messages (agent_id, created_at DESC),
  INDEX idx_created_at (created_at)
);

-- Agent events (lifecycle tracking)
CREATE TABLE agent_events (
  id BIGSERIAL PRIMARY KEY,
  agent_id VARCHAR(64) NOT NULL REFERENCES agents(id),
  event_type VARCHAR(32) NOT NULL,  -- 'created', 'started', 'stopped', 'error', 'message_sent'
  event_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  INDEX idx_agent_events (agent_id, created_at DESC)
);
```

### 4.2 Session Lifecycle

**Agent Creation:**

```typescript
async function createAgent(req: CreateAgentRequest): Promise<Agent> {
  // 1. Validate workspace ownership
  const workspace = await db.workspaces.findUnique({
    where: { id: req.workspaceId, userId: req.userId }
  })
  if (!workspace) throw new ForbiddenError()

  // 2. Check agent limits (max 3 per workspace)
  const activeAgents = await redis.scard(`workspace:agents:${req.workspaceId}`)
  if (activeAgents >= 3) throw new ResourceLimitError()

  // 3. Generate agent ID
  const agentId = `agent-${nanoid()}`

  // 4. Construct agentapi URL (Kubernetes service DNS)
  const agentapiUrl = `http://agentapi-${req.workspaceId}.vibecode.svc.cluster.local:8766`

  // 5. Store in PostgreSQL
  const agent = await db.agents.create({
    data: {
      id: agentId,
      workspaceId: req.workspaceId,
      userId: req.userId,
      agentType: req.agentType,
      config: req.config,
      status: 'starting',
      agentapiUrl
    }
  })

  // 6. Cache in Redis (1h TTL)
  await redis.hset(`agent:${agentId}:metadata`, agent)
  await redis.expire(`agent:${agentId}:metadata`, 3600)
  await redis.sadd(`workspace:agents:${req.workspaceId}`, agentId)
  await redis.sadd(`user:sessions:${req.userId}`, req.workspaceId)

  // 7. Call agentapi to start agent process
  try {
    await axios.post(`${agentapiUrl}/agents`, {
      agentId,
      agentType: req.agentType,
      config: req.config,
      environment: req.environment
    })

    // 8. Update status
    await updateAgentStatus(agentId, 'ready')
  } catch (error) {
    await updateAgentStatus(agentId, 'error')
    throw new AgentStartupError(error)
  }

  return agent
}
```

**Agent Cleanup (Workspace Deletion):**

```typescript
async function deleteWorkspace(workspaceId: string) {
  // 1. Get all agents for workspace
  const agentIds = await redis.smembers(`workspace:agents:${workspaceId}`)

  // 2. Stop all agents
  await Promise.all(
    agentIds.map(agentId => stopAgent(agentId))
  )

  // 3. Clean Redis cache
  await redis.del(`workspace:agents:${workspaceId}`)
  await Promise.all(
    agentIds.map(agentId =>
      redis.del(`agent:${agentId}:metadata`, `agent:${agentId}:connections`)
    )
  )

  // 4. Soft-delete in PostgreSQL
  await db.agents.updateMany({
    where: { workspaceId },
    data: { status: 'deleted', deletedAt: new Date() }
  })

  // 5. Delete workspace container/pod
  await containerOrchestrator.deleteWorkspace(workspaceId)
}
```

---

## 5. Message Routing

### 5.1 Routing Strategy

**Key Principle:** Session-based routing with connection pooling

**Implementation:**

```typescript
class AgentAPIRouter {
  private connectionPool: Map<string, AxiosInstance> = new Map()

  async routeMessage(agentId: string, message: AgentMessage): Promise<void> {
    // 1. Get agent metadata (Redis cache)
    let agent = await redis.hgetall(`agent:${agentId}:metadata`)

    if (!agent || !agent.agentapiUrl) {
      // Cache miss, fetch from DB
      agent = await db.agents.findUnique({ where: { id: agentId } })
      if (!agent) throw new NotFoundError('Agent not found')

      // Refresh cache
      await redis.hset(`agent:${agentId}:metadata`, agent)
      await redis.expire(`agent:${agentId}:metadata`, 3600)
    }

    // 2. Get or create HTTP client for agentapi
    let client = this.connectionPool.get(agent.agentapiUrl)
    if (!client) {
      client = axios.create({
        baseURL: agent.agentapiUrl,
        timeout: 300000,  // 5 min
        headers: { 'X-Agent-ID': agentId }
      })
      this.connectionPool.set(agent.agentapiUrl, client)
    }

    // 3. Forward message to agentapi
    const response = await client.post(`/agents/${agentId}/message`, {
      content: message.content,
      context: message.context
    })

    // 4. Log message in database (async, non-blocking)
    setImmediate(async () => {
      await db.agentMessages.create({
        data: {
          agentId,
          direction: 'user_to_agent',
          content: message.content,
          metadata: message.context
        }
      })
    })

    return response.data
  }

  // Periodic cleanup of stale connections
  async cleanupPool() {
    for (const [url, client] of this.connectionPool) {
      // Remove clients with no recent activity
      const lastUsed = client.defaults.headers['X-Last-Used']
      if (Date.now() - lastUsed > 300000) {  // 5 min
        this.connectionPool.delete(url)
      }
    }
  }
}
```

### 5.2 WebSocket Routing

**For real-time streaming:**

```typescript
// /api/agents/ws - WebSocket upgrade handler
export async function GET(req: NextRequest) {
  // 1. Validate session
  const session = await getServerSession(authOptions)
  if (!session) return new Response('Unauthorized', { status: 401 })

  // 2. Extract agentId from query params
  const { searchParams } = new URL(req.url)
  const agentId = searchParams.get('agentId')

  // 3. Verify ownership
  const agent = await db.agents.findFirst({
    where: { id: agentId, userId: session.user.id }
  })
  if (!agent) return new Response('Forbidden', { status: 403 })

  // 4. Upgrade to WebSocket
  const { socket, response } = Deno.upgradeWebSocket(req)

  // 5. Connect to agentapi WebSocket
  const agentapiWs = new WebSocket(`${agent.agentapiUrl}/agents/${agentId}/stream`)

  // 6. Bidirectional proxy
  socket.onmessage = (e) => {
    agentapiWs.send(e.data)
    logMessage(agentId, 'user_to_agent', e.data)
  }

  agentapiWs.onmessage = (e) => {
    socket.send(e.data)
    logMessage(agentId, 'agent_to_user', e.data)
  }

  // 7. Cleanup on disconnect
  socket.onclose = () => {
    agentapiWs.close()
    redis.srem(`agent:${agentId}:connections`, socket.id)
  }

  // 8. Track connection
  await redis.sadd(`agent:${agentId}:connections`, socket.id)

  return response
}
```

---

## 6. State Persistence

### 6.1 Data Flow

```
User Message
    ↓
┌─────────────────────────────────────┐
│ Next.js API                         │
│  - Log to PostgreSQL (async)        │
│  - Update Redis (activity timestamp)│
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ AgentAPI                            │
│  - Buffer in memory (ring buffer)   │
│  - Stream to agent pty              │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ Agent Process                       │
│  - Process message                  │
│  - Generate response                │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ AgentAPI                            │
│  - Read from pty                    │
│  - Parse structured output          │
│  - Stream back to Next.js           │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ Next.js API                         │
│  - Log response to PostgreSQL       │
│  - Stream to user                   │
└─────────────────────────────────────┘
```

### 6.2 Conversation History

**Retrieval Strategy:**

```typescript
async function getConversationHistory(
  agentId: string,
  options: { limit?: number; before?: Date } = {}
): Promise<AgentMessage[]> {
  const limit = options.limit || 50

  return await db.agentMessages.findMany({
    where: {
      agentId,
      createdAt: options.before ? { lt: options.before } : undefined
    },
    orderBy: { createdAt: 'desc' },
    take: limit
  })
}

// Optimized for context injection
async function getRecentContext(agentId: string): Promise<string> {
  const messages = await getConversationHistory(agentId, { limit: 10 })

  return messages
    .reverse()
    .map(m => `${m.direction === 'user_to_agent' ? 'User' : 'Agent'}: ${m.content}`)
    .join('\n\n')
}
```

**Archival Policy:**

```sql
-- Archive messages older than 90 days
CREATE TABLE agent_messages_archive (LIKE agent_messages INCLUDING ALL);

-- Daily job (via cron or Kubernetes CronJob)
INSERT INTO agent_messages_archive
SELECT * FROM agent_messages
WHERE created_at < NOW() - INTERVAL '90 days';

DELETE FROM agent_messages
WHERE created_at < NOW() - INTERVAL '90 days';
```

---

## 7. Error Handling

### 7.1 Failure Scenarios

| Scenario | Detection | Recovery | User Impact |
|----------|-----------|----------|-------------|
| **Agent crash** | agentapi health check fails | Restart agent process, notify user | "Agent restarting..." |
| **AgentAPI crash** | Kubernetes liveness probe | Restart container, reconnect | Brief disconnection |
| **Terminal hang** | Message timeout (5 min) | Kill agent process, restart | "Agent timeout, restarting" |
| **Workspace deleted** | Session lookup fails | Return 404, cleanup Redis | "Workspace not found" |
| **Network partition** | Connection timeout | Retry with exponential backoff | "Reconnecting..." |
| **Agent process OOM** | Container OOM kill | Log error, don't restart | "Agent out of memory" |

### 7.2 Circuit Breaker Pattern

```typescript
class AgentAPICircuitBreaker {
  private failures: Map<string, number> = new Map()
  private readonly threshold = 5
  private readonly resetTimeout = 60000  // 1 min

  async call(agentapiUrl: string, fn: () => Promise<any>): Promise<any> {
    const failures = this.failures.get(agentapiUrl) || 0

    // Circuit open: fail fast
    if (failures >= this.threshold) {
      throw new ServiceUnavailableError('Circuit breaker open')
    }

    try {
      const result = await fn()

      // Success: reset failure count
      this.failures.set(agentapiUrl, 0)
      return result

    } catch (error) {
      // Failure: increment counter
      this.failures.set(agentapiUrl, failures + 1)

      // Schedule reset
      if (failures + 1 >= this.threshold) {
        setTimeout(() => {
          this.failures.set(agentapiUrl, 0)
        }, this.resetTimeout)
      }

      throw error
    }
  }
}
```

---

## 8. Security Considerations

### 8.1 Authentication & Authorization

**Request Flow:**

```
1. User authenticates with Next.js (NextAuth.js JWT)
2. JWT contains userId claim
3. API validates JWT signature
4. API checks agent ownership (agentId → workspace → userId)
5. API adds X-User-ID header when proxying to agentapi
6. AgentAPI trusts X-User-ID (internal network only)
```

**Authorization Rules:**

```typescript
async function authorizeAgentAccess(
  userId: string,
  agentId: string
): Promise<boolean> {
  const agent = await db.agents.findUnique({
    where: { id: agentId },
    select: { userId: true }
  })

  return agent?.userId === userId
}

// Middleware for all agent endpoints
export async function agentAuthMiddleware(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const agentId = req.url.match(/\/agents\/([^\/]+)/)?.[1]
  if (agentId) {
    const authorized = await authorizeAgentAccess(session.user.id, agentId)
    if (!authorized) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  return null  // Continue to handler
}
```

### 8.2 Input Validation

```typescript
// Message content validation
const MessageContentSchema = z.object({
  message: z.string().min(1).max(50000),  // 50KB max
  context: z.object({
    files: z.array(z.string()).max(100),
    selection: z.object({
      start: z.number().int().min(0),
      end: z.number().int().min(0)
    }).optional()
  }).optional(),
  options: z.object({
    streaming: z.boolean().default(true),
    timeout: z.number().int().min(1000).max(600000).default(300000)
  }).optional()
})

// Prevent path traversal in file references
function validateFilePath(path: string, workspaceRoot: string): boolean {
  const resolved = nodePath.resolve(workspaceRoot, path)
  return resolved.startsWith(workspaceRoot)
}
```

### 8.3 Rate Limiting

```typescript
// Per-user rate limits
const RATE_LIMITS = {
  messagesPerMinute: 30,
  agentsPerWorkspace: 3,
  workspacesPerUser: 10
}

async function checkRateLimit(userId: string): Promise<void> {
  const key = `user:${userId}:agent_requests:${Math.floor(Date.now() / 60000)}`
  const count = await redis.incr(key)
  await redis.expire(key, 60)

  if (count > RATE_LIMITS.messagesPerMinute) {
    throw new RateLimitError('Too many requests')
  }
}
```

---

## 9. Multi-Tenancy Design

### 9.1 Isolation Levels

| Level | Mechanism | Scope |
|-------|-----------|-------|
| **User** | NextAuth session | All API requests |
| **Workspace** | Kubernetes namespace | Container isolation |
| **Agent** | Process isolation | pty + cgroups |
| **Data** | Row-level security | PostgreSQL policies |

### 9.2 Resource Quotas

**Per-User Limits:**

```typescript
const USER_QUOTAS = {
  maxWorkspaces: 10,
  maxAgentsPerWorkspace: 3,
  maxConcurrentMessages: 5,
  maxStorageGB: 10,
  maxCPUCores: 4,
  maxMemoryGB: 8
}

async function checkUserQuota(userId: string): Promise<void> {
  const workspaceCount = await db.workspaces.count({
    where: { userId, deletedAt: null }
  })

  if (workspaceCount >= USER_QUOTAS.maxWorkspaces) {
    throw new QuotaExceededError('Maximum workspaces reached')
  }
}
```

**Kubernetes ResourceQuota:**

```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: user-${userId}-quota
  namespace: vibecode
spec:
  hard:
    requests.cpu: "4"
    requests.memory: 8Gi
    limits.cpu: "8"
    limits.memory: 16Gi
    persistentvolumeclaims: "10"
```

---

## 10. Implementation Steps

### Phase 1: Foundation (Week 1-2)

1. **Infrastructure Setup**
   - [ ] Create agentapi Docker image
   - [ ] Update code-server pod spec with sidecar
   - [ ] Deploy to test namespace

2. **API Routes**
   - [ ] Implement `/api/agents` (CRUD)
   - [ ] Implement `/api/agents/[id]/message` (POST)
   - [ ] Add authentication middleware

3. **Session Management**
   - [ ] Create PostgreSQL tables
   - [ ] Implement Redis caching layer
   - [ ] Build session lookup service

### Phase 2: Core Features (Week 3-4)

4. **Message Routing**
   - [ ] Build HTTP proxy to agentapi
   - [ ] Implement connection pooling
   - [ ] Add circuit breaker pattern

5. **State Persistence**
   - [ ] Log messages to PostgreSQL
   - [ ] Implement conversation history API
   - [ ] Build archival job

6. **Error Handling**
   - [ ] Add retry logic
   - [ ] Implement graceful degradation
   - [ ] Create health check endpoints

### Phase 3: Advanced Features (Week 5-6)

7. **WebSocket Support**
   - [ ] Implement `/api/agents/ws`
   - [ ] Add real-time streaming
   - [ ] Handle reconnection logic

8. **Rate Limiting**
   - [ ] Implement per-user rate limits
   - [ ] Add quota enforcement
   - [ ] Create admin override API

9. **Monitoring**
   - [ ] Add Datadog metrics
   - [ ] Implement distributed tracing
   - [ ] Create alerting rules

### Phase 4: Production Readiness (Week 7-8)

10. **Testing**
    - [ ] Unit tests for API routes
    - [ ] Integration tests with agentapi
    - [ ] Load testing (1000 concurrent agents)

11. **Documentation**
    - [ ] API documentation (OpenAPI)
    - [ ] Deployment guide
    - [ ] Runbook for operations

12. **Migration**
    - [ ] Gradual rollout (10% → 50% → 100%)
    - [ ] Feature flag for agentapi toggle
    - [ ] Fallback to legacy extension flow

---

## 11. Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| Agent creation time | < 5s p99 | End-to-end latency |
| Message latency | < 500ms p95 | User send → first token |
| Concurrent agents | 1000+ | Load testing |
| Message throughput | 100 msg/s | Per Next.js instance |
| WebSocket connections | 5000+ | Per Next.js instance |
| Memory per agent | < 512MB | Container RSS |
| CPU per agent | < 0.25 vCPU | Container CPU usage |

---

## 12. Monitoring & Observability

### 12.1 Metrics (Datadog)

```typescript
// Agent lifecycle metrics
metrics.increment('agent.created', { agent_type, workspace_id })
metrics.increment('agent.started')
metrics.increment('agent.stopped')
metrics.increment('agent.error', { error_type })

// Performance metrics
metrics.histogram('agent.message.latency', latency, { agent_type })
metrics.gauge('agent.active_count', activeAgents)
metrics.histogram('agent.response_tokens', tokensUsed)

// Resource metrics
metrics.gauge('agent.memory_usage', memoryMB, { agent_id })
metrics.gauge('agent.cpu_usage', cpuPercent, { agent_id })
```

### 12.2 Distributed Tracing

```typescript
// APM trace for message flow
tracer.trace('agent.message.send', async (span) => {
  span.setTag('agent.id', agentId)
  span.setTag('agent.type', agentType)
  span.setTag('message.length', message.length)

  // Child span for database lookup
  const agent = await tracer.trace('db.agent.lookup', () =>
    db.agents.findUnique({ where: { id: agentId } })
  )

  // Child span for agentapi call
  const response = await tracer.trace('agentapi.proxy', () =>
    axios.post(`${agent.agentapiUrl}/message`, message)
  )

  span.setTag('response.tokens', response.tokensUsed)
  return response
})
```

### 12.3 Logging

```typescript
// Structured logging
logger.info('Agent message sent', {
  agentId,
  userId,
  workspaceId,
  messageLength: message.length,
  latencyMs,
  tokensUsed
})

logger.error('Agent error', {
  agentId,
  errorType: error.constructor.name,
  errorMessage: error.message,
  stack: error.stack
})
```

---

## 13. API Examples

### Example 1: Create Agent and Send Message

```bash
# 1. Authenticate
curl -X POST http://localhost:3000/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"email":"developer@vibecode.dev","password":"dev123"}' \
  -c cookies.txt

# 2. Create workspace
curl -X POST http://localhost:3000/api/workspaces \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "projectId": "proj-abc",
    "projectName": "My Project",
    "framework": "nextjs",
    "files": {},
    "dependencies": []
  }'

# Response: {"workspace":{"id":"ws-xyz",...}}

# 3. Create agent
curl -X POST http://localhost:3000/api/agents \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "workspaceId": "ws-xyz",
    "agentType": "aider",
    "config": {
      "model": "claude-3-7-sonnet-20250219"
    },
    "environment": {
      "ANTHROPIC_API_KEY": "sk-ant-..."
    }
  }'

# Response: {"agentId":"agent-123","status":"starting",...}

# 4. Wait for agent to start (poll until status='ready')
curl http://localhost:3000/api/agents/agent-123 -b cookies.txt

# 5. Send message
curl -X POST http://localhost:3000/api/agents/agent-123/message \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "message": "Create a function to calculate fibonacci numbers",
    "context": {
      "files": ["/workspace/src/math.ts"]
    },
    "options": {
      "streaming": true
    }
  }'

# Response (SSE stream):
# data: {"type":"status","status":"processing"}
# data: {"type":"token","content":"I'll create"}
# data: {"type":"token","content":" a fibonacci"}
# data: {"type":"file_edit","path":"/workspace/src/math.ts","diff":"..."}
# data: {"type":"complete","tokensUsed":542}
```

### Example 2: WebSocket Streaming

```typescript
// Frontend code
const ws = new WebSocket(
  `ws://localhost:3000/api/agents/ws?agentId=agent-123`
)

ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'message',
    content: 'Refactor authentication to use bcrypt'
  }))
}

ws.onmessage = (event) => {
  const data = JSON.parse(event.data)

  if (data.type === 'token') {
    appendToOutput(data.content)
  } else if (data.type === 'file_edit') {
    showDiffPreview(data.path, data.diff)
  } else if (data.type === 'complete') {
    console.log(`Used ${data.tokensUsed} tokens`)
  }
}
```

---

## 14. Alternative Approaches Considered

### Alternative 1: Embedded Node.js Server

**Approach:** Run agentapi as embedded Express server in Next.js process

**Pros:**
- Simple deployment
- No container orchestration needed

**Cons:**
- Shared memory space (security risk)
- Resource contention
- Process crash affects entire Next.js app
- Can't scale independently

**Verdict:** ❌ Rejected (poor isolation)

### Alternative 2: Centralized Agent Service

**Approach:** Single agentapi deployment serving all workspaces

**Pros:**
- Simple architecture
- Easy to monitor

**Cons:**
- Single point of failure
- Complex routing logic
- Workspace file access requires network mount (slow)
- Hard to scale horizontally

**Verdict:** ❌ Rejected (scalability bottleneck)

### Alternative 3: Lambda/Serverless Functions

**Approach:** Deploy agent handlers as serverless functions

**Pros:**
- Auto-scaling
- Pay-per-use

**Cons:**
- Cold start latency (unacceptable for real-time)
- Limited execution time (15 min max)
- No persistent pty sessions
- High cost at scale

**Verdict:** ❌ Rejected (poor fit for streaming)

---

## 15. Conclusion

The sidecar container approach provides the best balance of:

- **Isolation:** Each workspace gets dedicated agentapi instance
- **Performance:** Local filesystem access, no network overhead
- **Scalability:** Linear scaling with workspaces
- **Reliability:** Fault isolation, automatic recovery
- **Simplicity:** 1:1 mapping, straightforward routing

**Next Steps:**

1. Build agentapi Docker image with health checks
2. Update code-server Kubernetes manifests with sidecar
3. Implement Next.js API routes with Redis session store
4. Deploy to staging environment for testing
5. Load test with 100 concurrent agents
6. Gradual production rollout with feature flag

**Success Criteria:**

- [ ] Agent creation time < 5s (p99)
- [ ] Message latency < 500ms (p95)
- [ ] Support 1000+ concurrent agents
- [ ] 99.9% uptime for agent sessions
- [ ] Zero data loss in message persistence

---

**Document Status:** Ready for Technical Review
**Next Review Date:** 2025-10-09
**Approvers:** @backend-team @devops-team @security-team
