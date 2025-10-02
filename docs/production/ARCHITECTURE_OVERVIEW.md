# Production Architecture Overview

**Document Owner**: SRE Team
**Last Updated**: 2025-10-02
**Version**: 1.0.0
**Audience**: Production Operators, SREs, Platform Engineers

## Table of Contents

1. [System Overview](#system-overview)
2. [Component Architecture](#component-architecture)
3. [Data Flow Diagrams](#data-flow-diagrams)
4. [Integration Points](#integration-points)
5. [Security Architecture](#security-architecture)
6. [Scalability and Reliability](#scalability-and-reliability)

---

## System Overview

### High-Level Architecture

```
┌───────────────────────────────────────────────────────────────────┐
│                         Internet Users                             │
└─────────────────────────────┬─────────────────────────────────────┘
                              │
                      ┌───────▼───────┐
                      │  Cloudflare   │  (CDN, DDoS Protection)
                      │     WAF       │
                      └───────┬───────┘
                              │
                      ┌───────▼───────┐
                      │ Azure Load    │  (Layer 7 Load Balancer)
                      │   Balancer    │
                      └───────┬───────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
┌───────▼────────┐   ┌────────▼────────┐   ┌───────▼────────┐
│  Kubernetes    │   │   Ingress       │   │   cert-manager │
│    Cluster     │   │  Controller     │   │   (TLS Certs)  │
│ (AKS/EKS/GKE) │   │   (nginx)       │   │                │
└───────┬────────┘   └────────┬────────┘   └────────────────┘
        │                     │
┌───────┴─────────────────────┴───────────────────────────────────┐
│                      Application Layer                           │
│                                                                   │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────┐ │
│  │  Next.js WebGUI  │  │    Agent API     │  │  Tauri Native │ │
│  │  (6-20 replicas) │  │  (2-10 replicas) │  │   (macOS)     │ │
│  │                  │  │                  │  │               │ │
│  │  - Authentication│  │  - AI Agents     │  │  - mDNS       │ │
│  │  - Workspace Mgmt│  │  - Terminal Mux  │  │  - Container  │ │
│  │  - API Gateway   │  │  - Code Execution│  │    Runtime    │ │
│  └──────────────────┘  └──────────────────┘  └───────────────┘ │
└───────┬───────────────────────┬──────────────────────────────────┘
        │                       │
┌───────┴───────────────────────┴───────────────────────────────────┐
│                        Data Layer                                  │
│                                                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │  PostgreSQL  │  │     Redis    │  │  Azure Blob  │           │
│  │  (Primary +  │  │  (Session +  │  │   Storage    │           │
│  │   Replicas)  │  │    Cache)    │  │  (Files)     │           │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
└───────┬───────────────────────┬──────────────────────────────────┘
        │                       │
┌───────┴───────────────────────┴───────────────────────────────────┐
│                     Observability Layer                            │
│                                                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │   Datadog    │  │  Prometheus  │  │  SkyWalking  │           │
│  │  APM + DBM   │  │  (Metrics)   │  │   (Traces)   │           │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
└───────────────────────────────────────────────────────────────────┘
```

### Technology Stack

**Frontend**:
- Next.js 15.5.4 (React 19)
- TypeScript
- Tailwind CSS 4.0
- Monaco Editor
- shadcn/ui components

**Backend**:
- Next.js API Routes
- Tauri (Rust + Swift for macOS native)
- Python (Agent API)

**Databases**:
- PostgreSQL 15 (primary datastore)
- Redis 7 (session store, cache)
- MongoDB (vector embeddings)

**Infrastructure**:
- Kubernetes (AKS/EKS/GKE)
- Docker / OrbStack (macOS)
- Helm 3 (package management)
- cert-manager (TLS automation)

**Observability**:
- Datadog APM/DBM
- Prometheus + Grafana
- Apache SkyWalking
- OpenTelemetry

---

## Component Architecture

### Application Tier

#### Next.js WebGUI

**Purpose**: Main user interface and API gateway

**Key Responsibilities**:
- User authentication and session management
- Workspace creation and management
- Code editor interface (Monaco)
- AI agent orchestration
- API gateway for frontend requests

**Deployment**:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: vibecode-webgui
  namespace: vibecode
spec:
  replicas: 6  # Autoscales 6-20
  selector:
    matchLabels:
      app: vibecode-webgui
  template:
    spec:
      containers:
      - name: webgui
        image: ghcr.io/vibecode/webgui:latest
        ports:
        - containerPort: 3000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: postgres-credentials
              key: url
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: redis-credentials
              key: url
        - name: NEXTAUTH_SECRET
          valueFrom:
            secretKeyRef:
              name: vibecode-secrets
              key: jwt-secret
        resources:
          requests:
            cpu: 500m
            memory: 1Gi
          limits:
            cpu: 2000m
            memory: 4Gi
        livenessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 5
```

**Performance Characteristics**:
- Startup time: <30 seconds
- Response time (P95): 800ms
- Throughput: 1,200 req/s per replica
- Memory footprint: 1-2 GB per replica

---

#### Agent API

**Purpose**: AI agent execution and terminal multiplexing

**Key Responsibilities**:
- Execute AI coding agents (Aider, Goose, Cline)
- Terminal session management (tmux/screen)
- WebSocket connections for real-time collaboration
- Code execution sandboxing

**Deployment**:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: vibecode-agentapi
  namespace: vibecode
spec:
  replicas: 2  # Autoscales 2-10
  template:
    spec:
      containers:
      - name: agentapi
        image: ghcr.io/vibecode/agentapi:latest
        ports:
        - containerPort: 3284
        - containerPort: 9090  # Metrics
        env:
        - name: AGENTAPI_MAX_CONCURRENT_AGENTS
          value: "3"
        - name: AGENTAPI_AGENT_TIMEOUT
          value: "300"
        - name: PYTHONUNBUFFERED
          value: "1"
        resources:
          requests:
            cpu: 250m
            memory: 512Mi
          limits:
            cpu: 1000m
            memory: 2Gi
        volumeMounts:
        - name: workspace-data
          mountPath: /workspace
          readOnly: true
        - name: terminal-data
          mountPath: /tmp/terminals
```

**Performance Characteristics**:
- Startup time: <10 seconds
- Concurrent agents: 3-5 per replica
- Memory per agent: ~200-500 MB
- Terminal latency: <50ms

---

#### Tauri Native (macOS)

**Purpose**: Native macOS desktop application for local development

**Key Responsibilities**:
- Container runtime integration (Docker/OrbStack)
- mDNS service discovery
- Native system services (launchd, XPC)
- Menu bar interface
- Local workspace management

**Architecture**:
```
VibeCode.app (SwiftUI)
    ├── Menu Bar Interface
    ├── Service Discovery (Bonjour)
    └── XPC Service (Privilege Separation)
            ├── Container Lifecycle
            ├── LaunchDaemon Integration
            └── System Logging

com.vibecode.containerd (LaunchDaemon)
    ├── Container Runtime Management
    ├── Resource Limits Enforcement
    └── Health Monitoring
```

**Deployment** (via Homebrew):
```ruby
cask "vibecode" do
  version "1.0.0"
  url "https://github.com/vibecode/releases/download/v#{version}/VibeCode-#{version}-darwin-universal.dmg"

  app "VibeCode.app"

  postflight do
    system "#{staged_path}/install-daemon.sh"
  end
end
```

---

### Data Tier

#### PostgreSQL

**Purpose**: Primary relational database

**Schema** (key tables):
```sql
-- Users and authentication
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Workspaces
CREATE TABLE workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'active',
  container_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
);

-- Sessions
CREATE TABLE sessions (
  sid VARCHAR(255) PRIMARY KEY,
  sess JSONB NOT NULL,
  expire TIMESTAMP NOT NULL,
  INDEX idx_expire (expire)
);

-- Agent executions
CREATE TABLE agent_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  agent_type VARCHAR(50) NOT NULL,
  command TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'running',
  output TEXT,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  INDEX idx_workspace_id (workspace_id),
  INDEX idx_status (status)
);
```

**Deployment** (StatefulSet):
```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
  namespace: vibecode
spec:
  serviceName: postgres
  replicas: 3  # 1 primary + 2 read replicas
  template:
    spec:
      containers:
      - name: postgres
        image: postgres:15-alpine
        env:
        - name: POSTGRES_DB
          value: vibecode_db
        - name: POSTGRES_USER
          valueFrom:
            secretKeyRef:
              name: postgres-credentials
              key: username
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: postgres-credentials
              key: password
        - name: PGDATA
          value: /var/lib/postgresql/data/pgdata
        volumeMounts:
        - name: postgres-data
          mountPath: /var/lib/postgresql/data
        resources:
          requests:
            cpu: 1000m
            memory: 2Gi
          limits:
            cpu: 4000m
            memory: 8Gi
  volumeClaimTemplates:
  - metadata:
      name: postgres-data
    spec:
      accessModes: ["ReadWriteOnce"]
      resources:
        requests:
          storage: 100Gi
```

**Backup Strategy**:
- Full backup: Daily at 2 AM UTC (pg_dump)
- WAL archiving: Continuous (for PITR)
- Retention: 30 days full backups, 7 days WAL
- Storage: Azure Blob Storage (encrypted)

---

#### Redis

**Purpose**: Session store and application cache

**Usage Patterns**:
```typescript
// Session storage
redis.set(`session:${sessionId}`, JSON.stringify(sessionData), 'EX', 3600);

// Cache API responses
redis.set(`cache:workspace:${id}`, JSON.stringify(workspace), 'EX', 300);

// Rate limiting
redis.incr(`ratelimit:${userId}:${hour}`);
redis.expire(`ratelimit:${userId}:${hour}`, 3600);

// Pub/Sub for real-time updates
redis.publish('workspace:updates', JSON.stringify({ workspaceId, event }));
```

**Deployment** (StatefulSet):
```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: redis
  namespace: vibecode
spec:
  serviceName: redis
  replicas: 3  # 1 primary + 2 replicas
  template:
    spec:
      containers:
      - name: redis
        image: redis:7-alpine
        command:
        - redis-server
        - --appendonly yes
        - --appendfsync everysec
        - --maxmemory 2gb
        - --maxmemory-policy allkeys-lru
        ports:
        - containerPort: 6379
        volumeMounts:
        - name: redis-data
          mountPath: /data
        resources:
          requests:
            cpu: 500m
            memory: 1Gi
          limits:
            cpu: 2000m
            memory: 4Gi
```

**Performance Tuning**:
- Eviction policy: `allkeys-lru` (Least Recently Used)
- Max memory: 2 GB (with eviction)
- Persistence: AOF (every second)
- Connection pooling: 50 connections per app instance

---

### Observability Tier

#### Datadog APM/DBM

**Coverage**:
- Application Performance Monitoring (APM)
  - Distributed tracing
  - Service map
  - Error tracking
  - Performance profiling

- Database Monitoring (DBM)
  - Query performance
  - Explain plans
  - Connection pool metrics
  - Lock contention

**Instrumentation**:
```typescript
// dd-trace initialization (src/instrument.ts)
import tracer from 'dd-trace';

tracer.init({
  service: 'vibecode',
  env: process.env.NODE_ENV,
  version: process.env.APP_VERSION,
  logInjection: true,
  runtimeMetrics: true,
  profiling: true,
  appsec: true,  // Application Security Monitoring
});

// Custom span
import { Span } from 'dd-trace';

const span = tracer.startSpan('workspace.create', {
  resource: workspaceId,
  type: 'web',
  tags: {
    'user.id': userId,
    'workspace.type': 'container',
  },
});

try {
  // Operation
  const result = await createWorkspace(data);
  span.setTag('workspace.id', result.id);
  return result;
} catch (error) {
  span.setTag('error', true);
  span.setTag('error.message', error.message);
  throw error;
} finally {
  span.finish();
}
```

---

## Data Flow Diagrams

### Request Flow (User → Application → Database)

```
1. User Request
   │
   ├─> [Browser] GET /api/workspaces/:id
   │
2. Ingress Layer
   │
   ├─> [Cloudflare WAF] Security checks
   ├─> [Azure Load Balancer] SSL termination
   ├─> [nginx Ingress] Route to service
   │
3. Application Layer
   │
   ├─> [Next.js API Route] /api/workspaces/[id].ts
   │   │
   │   ├─> [NextAuth] Validate session
   │   │   └─> [Redis] GET session:abc123
   │   │
   │   ├─> [Authorization] Check workspace ownership
   │   │
   │   ├─> [Cache Layer] Check Redis cache
   │   │   └─> [Redis] GET cache:workspace:123 (MISS)
   │   │
   │   ├─> [Database Layer] Query PostgreSQL
   │   │   └─> [PostgreSQL] SELECT * FROM workspaces WHERE id = '123'
   │   │
   │   ├─> [Cache Update] Store in Redis
   │   │   └─> [Redis] SET cache:workspace:123 {...} EX 300
   │   │
   │   └─> [Response] Return JSON
   │
4. Observability
   │
   ├─> [Datadog APM] Trace span recorded
   ├─> [Prometheus] Metrics incremented
   └─> [Logs] Request logged
```

### WebSocket Flow (Real-Time Collaboration)

```
1. WebSocket Handshake
   │
   ├─> [Client] ws://vibecode.com/socket.io
   │   └─> [nginx] Upgrade to WebSocket
   │       └─> [Next.js] Socket.IO server
   │
2. Authentication
   │
   ├─> [Socket.IO Middleware] Verify token
   │   └─> [Redis] Validate session
   │
3. Room Subscription
   │
   ├─> [Client] emit('join', {workspaceId: '123'})
   │   └─> [Server] socket.join('workspace:123')
   │
4. Real-Time Updates
   │
   ├─> [User A] Edit file
   │   ├─> [Server] broadcast to room
   │   │   └─> [Redis Pub/Sub] Notify other pods
   │   │
   │   └─> [User B, User C] Receive update
   │
5. Persistence
   │
   ├─> [Debounced Save] After 2s of inactivity
   │   └─> [Database] UPDATE workspaces SET content = {...}
```

### Agent Execution Flow

```
1. User Triggers Agent
   │
   ├─> [WebGUI] POST /api/agents/execute
   │   └─> Body: {agentType: 'aider', command: 'fix bug'}
   │
2. Agent API Request
   │
   ├─> [Next.js] Forwards to Agent API
   │   └─> POST http://agentapi:3284/execute
   │
3. Agent API Processing
   │
   ├─> [Agent API] Validates request
   │   ├─> Check workspace exists
   │   ├─> Verify agent quota
   │   └─> Check concurrent agents < MAX
   │
4. Container Preparation
   │
   ├─> [Agent API] Prepare workspace
   │   ├─> Mount workspace directory (read-only)
   │   ├─> Create terminal session (tmux)
   │   └─> Set environment variables
   │
5. Agent Execution
   │
   ├─> [Agent API] Execute agent command
   │   ├─> Spawn: aider --yes "fix bug"
   │   ├─> Stream stdout/stderr via WebSocket
   │   └─> Capture exit code
   │
6. Result Processing
   │
   ├─> [Agent API] Parse output
   │   ├─> Extract file changes
   │   ├─> Generate summary
   │   └─> Update database (agent_executions)
   │
7. User Notification
   │
   ├─> [WebSocket] Emit 'agent:complete'
   │   └─> [WebGUI] Show diff and summary
```

---

## Integration Points

### External APIs

#### OpenAI API
```typescript
// src/lib/openai/client.ts
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  maxRetries: 3,
  timeout: 60000,  // 60 seconds
});

// Usage with tracing
import { tracer } from 'dd-trace';

const span = tracer.startSpan('openai.chat.completion');
try {
  const completion = await client.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: prompt }],
  });
  return completion.choices[0].message.content;
} catch (error) {
  span.setTag('error', true);
  throw error;
} finally {
  span.finish();
}
```

**Rate Limiting**:
- Requests per minute: 500 (shared across all users)
- Tokens per minute: 150,000
- Implementation: Upstash rate limiter + Redis

**Circuit Breaker**:
```typescript
import CircuitBreaker from 'opossum';

const options = {
  timeout: 60000,      // 60s timeout
  errorThresholdPercentage: 50,  // Open circuit if 50% fail
  resetTimeout: 30000,  // Try again after 30s
};

const breaker = new CircuitBreaker(openaiRequest, options);

breaker.on('open', () => {
  console.error('Circuit breaker opened for OpenAI');
  // Switch to fallback model or cache
});
```

---

#### GitHub API
```typescript
// src/lib/github/client.ts
import { Octokit } from '@octokit/rest';

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
  throttle: {
    onRateLimit: (retryAfter, options) => {
      console.warn(`Rate limit hit, retrying after ${retryAfter}s`);
      return true;  // Retry
    },
    onSecondaryRateLimit: (retryAfter, options) => {
      console.warn(`Secondary rate limit hit`);
      return false;  // Don't retry
    },
  },
});

// Clone repository
async function cloneRepo(owner: string, repo: string) {
  const { data } = await octokit.repos.get({ owner, repo });
  // Use git clone with auth token
  await exec(`git clone https://${token}@github.com/${owner}/${repo}.git`);
}
```

---

### Internal Services

#### Service-to-Service Communication

```yaml
# NetworkPolicy (allow WebGUI → Agent API)
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-webgui-to-agentapi
  namespace: vibecode
spec:
  podSelector:
    matchLabels:
      app: vibecode-agentapi
  policyTypes:
  - Ingress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: vibecode-webgui
    ports:
    - protocol: TCP
      port: 3284
```

**Service Discovery**:
```typescript
// Kubernetes DNS-based discovery
const AGENTAPI_URL = process.env.AGENTAPI_URL || 'http://vibecode-agentapi.vibecode.svc.cluster.local:3284';

// Health check before request
async function callAgentAPI(endpoint: string, data: any) {
  // Check if service is healthy
  try {
    await fetch(`${AGENTAPI_URL}/health`, { timeout: 5000 });
  } catch (error) {
    throw new Error('Agent API unavailable');
  }

  // Make request with retry
  return await fetchWithRetry(`${AGENTAPI_URL}${endpoint}`, {
    method: 'POST',
    body: JSON.stringify(data),
    headers: { 'Content-Type': 'application/json' },
  });
}
```

---

## Security Architecture

### Authentication Flow

```
1. User Login
   │
   ├─> [POST /api/auth/login]
   │   ├─> Validate credentials (bcrypt)
   │   ├─> Generate JWT token (RS256)
   │   ├─> Create session in Redis
   │   └─> Return token + cookie
   │
2. Subsequent Requests
   │
   ├─> [Authorization Header] Bearer <token>
   │   ├─> Verify JWT signature
   │   ├─> Check expiration
   │   ├─> Validate session in Redis
   │   └─> Attach user to request context
   │
3. Session Refresh
   │
   ├─> [POST /api/auth/refresh]
   │   ├─> Verify refresh token
   │   ├─> Generate new access token
   │   └─> Extend session TTL
```

### Secrets Management

**Kubernetes Secrets** (encrypted at rest):
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: vibecode-secrets
  namespace: vibecode
type: Opaque
data:
  jwt-secret: <base64-encoded>
  openai-api-key: <base64-encoded>
  github-token: <base64-encoded>
  datadog-api-key: <base64-encoded>
```

**External Secrets Operator** (Azure Key Vault integration):
```yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: vibecode-external-secrets
  namespace: vibecode
spec:
  secretStoreRef:
    name: azure-keyvault
    kind: SecretStore
  target:
    name: vibecode-secrets
  data:
  - secretKey: database-password
    remoteRef:
      key: vibecode-db-password
  - secretKey: openai-api-key
    remoteRef:
      key: vibecode-openai-key
```

### Network Security

**Network Policies** (Zero Trust):
```yaml
# Default deny all ingress
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-ingress
  namespace: vibecode
spec:
  podSelector: {}
  policyTypes:
  - Ingress

---
# Allow ingress from ingress controller
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-from-ingress
  namespace: vibecode
spec:
  podSelector:
    matchLabels:
      app: vibecode-webgui
  policyTypes:
  - Ingress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: ingress-nginx
    ports:
    - protocol: TCP
      port: 3000
```

**TLS Configuration**:
```yaml
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: vibecode-tls
  namespace: vibecode
spec:
  secretName: vibecode-tls
  issuerRef:
    name: letsencrypt-prod
    kind: ClusterIssuer
  dnsNames:
  - vibecode.eastus2.cloudapp.azure.com
  - api.vibecode.eastus2.cloudapp.azure.com
  privateKey:
    algorithm: RSA
    size: 4096
```

---

## Scalability and Reliability

### Horizontal Scaling

**Horizontal Pod Autoscaler**:
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: vibecode-webgui
  namespace: vibecode
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: vibecode-webgui
  minReplicas: 6
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  - type: Pods
    pods:
      metric:
        name: http_requests_per_second
      target:
        type: AverageValue
        averageValue: "1000"
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
      - type: Percent
        value: 50
        periodSeconds: 60
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 10
        periodSeconds: 60
```

### High Availability

**Multi-AZ Deployment**:
- Minimum 3 nodes across 3 availability zones
- Pod anti-affinity ensures replicas on different nodes
- Database replicas in separate AZs

**Pod Disruption Budget**:
```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: vibecode-webgui-pdb
  namespace: vibecode
spec:
  minAvailable: 4  # Always keep 4 pods running
  selector:
    matchLabels:
      app: vibecode-webgui
```

**Database Replication**:
```
Primary (AZ-1) ──┐
                 ├──> Read Replica (AZ-2)
                 └──> Read Replica (AZ-3)

Failover time: <60 seconds
RPO (Recovery Point Objective): <30 seconds
RTO (Recovery Time Objective): <5 minutes
```

### Disaster Recovery

**Backup Strategy**:
- **Database**: Daily full backup + continuous WAL archiving
- **Application State**: Redis persistence (AOF)
- **User Files**: Azure Blob Storage (geo-redundant)
- **Configuration**: GitOps (all infrastructure as code)

**Disaster Recovery Plan**:
1. **Data Loss**: Restore from latest backup (<15 min RPO)
2. **AZ Failure**: Automatic failover to healthy AZ (<2 min RTO)
3. **Region Failure**: Manual failover to DR region (<30 min RTO)

---

**Document Version**: 1.0.0
**Last Reviewed**: 2025-10-02
**Next Review**: 2025-11-02
**Owner**: SRE Team
