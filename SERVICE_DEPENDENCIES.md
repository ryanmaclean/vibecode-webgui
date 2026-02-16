# Service Dependencies Map

> **Last Updated:** 2026-02-16
> **Repository:** vibecode-webgui v5.1.0-beta

This document maps inter-service dependencies, communication patterns, shared databases, message queues, and API contracts in the VibeCode monorepo.

---

## Table of Contents

1. [Service Overview](#service-overview)
2. [Database Dependencies](#database-dependencies)
3. [Message Queue Communication](#message-queue-communication)
4. [Inter-Service Communication](#inter-service-communication)
5. [External Service Dependencies](#external-service-dependencies)
6. [API Contracts](#api-contracts)
7. [WebSocket Connections](#websocket-connections)
8. [Service Dependency Graph](#service-dependency-graph)

---

## Service Overview

The VibeCode platform consists of 6 primary services organized as a monorepo:

| Service | Type | Language/Framework | Purpose | Port |
|---------|------|-------------------|---------|------|
| **rig** | Frontend/API | Next.js 16 + TypeScript | Main web application and API gateway | 3000 |
| **docs** | Frontend | Astro + TypeScript | Documentation website | - |
| **td** | CLI | Go 1.22 | Tundra Dome task/workflow CLI | - |
| **airflow** | Backend | Python + Apache Airflow | Workflow orchestration and automation | - |
| **dd-skill-test** | Utility | Python | Datadog operations testing and CLI | - |
| **daemon** | Backend | Node.js + Python | Background services for event bridging | - |

---

## Database Dependencies

### PostgreSQL (Primary Database)

**Connection:** Port 5432
**Database Name:** `vibecode`
**Extensions:** pgvector (for vector embeddings)

**Services Using PostgreSQL:**

- **rig (Next.js)** - Primary consumer
  - Uses Prisma ORM
  - Schema: `./prisma/schema.prisma`
  - Models: Users, Sessions, Workspaces, Projects, Files, RAGChunks, AIRequests, Conversations, Messages, AgentMemory, Experiments
  - Health check: `/api/health/db`

**Key Tables:**
- `users` - User authentication and profiles
- `workspaces` - User workspace management
- `projects` - Project metadata
- `files` - File tracking and metadata
- `rag_chunks` - RAG system chunks with vector embeddings
- `ai_requests` - AI provider request tracking
- `conversations` + `messages` - Chat persistence
- `agent_memory` + `agent_beliefs` - Agent memory architecture
- `experiments` - A/B testing and feature flags

### MongoDB (Optional)

**Connection:** Configured via environment variables
**Usage:** Alternative chat storage and document database

**Services Using MongoDB:**

- **rig** - Optional chat backend
  - Connection: `src/lib/mongodb.ts`
  - API routes: `/api/chat/mongodb`, `/api/chat/mongodb-simple`

### Redis/Valkey (Caching Layer)

**Connection:** Port 6379
**Type:** Redis-compatible (Valkey 7)

**Services Using Redis:**

- **rig** - Primary consumer
  - Session caching
  - Rate limiting
  - Health check caching
  - Vector cache adapter
  - Connection pools: `src/lib/cache/valkey-client.ts`, `src/lib/cache/redis-client.ts`
  - Health check: `/api/health/services?service=valkey`

**Redis Use Cases:**
- Session storage (Redis DB 1)
- API rate limiting
- Health check caching (5-second TTL)
- Vector search caching
- WebSocket connection pooling

---

## Message Queue Communication

### Kafka (Event Streaming)

**Brokers:** localhost:9092 (default)
**Purpose:** Async event-driven communication between services

**Services Using Kafka:**

1. **td (Go CLI)**
   - Producer/Consumer: `td/internal/tdkafka/`
   - Commands: `td kafka status|summary|topics`
   - Topics: work, in-progress, created, completed, nudges

2. **airflow (Python)**
   - DAG: `airflow/dags/tundra_dome_kafka.py`
   - Consumer for workflow triggers
   - Dependencies: `kafka-python>=2.0.2`, `confluent-kafka>=2.11.0`

3. **daemon/gitea-kafka-bridge (Node.js)**
   - Bridges Gitea webhook events to Kafka
   - Package: `kafkajs@^2.2.4`

4. **daemon/kafka-dsm (Node.js)**
   - Data Stream Manager for Kafka
   - Datadog tracing integration

5. **rig (Next.js)**
   - Producer: `kafkajs@2.2.4` dependency
   - Event emission for system events

**Kafka Topics:**

| Topic | Producer | Consumer | Purpose |
|-------|----------|----------|---------|
| `tundra-beads-created` | td, rig | airflow, td | New task/bead creation events |
| `tundra-beads-work` | td | td, airflow | Work assignments |
| `tundra-beads-in-progress` | td | td | Task status updates |
| `tundra-beads-completed` | td | td, airflow | Task completion events |
| `tundra-nudges` | td | td | Notification/alert events |
| `gitea-webhooks` | gitea-bridge | td | Git repository events |

**Kafka Environment Variables:**
```bash
KAFKA_BROKERS=localhost:9092
KAFKA_TOPIC=tundra-beads-created
TD_KAFKA_BROKERS=localhost:9092
```

---

## Inter-Service Communication

### 1. rig → PostgreSQL
- **Protocol:** TCP/SQL (Prisma)
- **Direction:** Bidirectional
- **Purpose:** Primary data persistence
- **Failure Mode:** Service degraded, returns 503 on health check

### 2. rig → Redis/Valkey
- **Protocol:** Redis Protocol
- **Direction:** Bidirectional
- **Purpose:** Caching, session management, rate limiting
- **Failure Mode:** Service continues with degraded performance

### 3. rig → Kafka
- **Protocol:** Kafka Protocol
- **Direction:** Producer (publish events)
- **Purpose:** Event emission for system events
- **Failure Mode:** Events lost, no retry logic

### 4. td → Kafka
- **Protocol:** Kafka Protocol (segmentio/kafka-go)
- **Direction:** Producer + Consumer
- **Purpose:** Task management, workflow orchestration
- **Failure Mode:** CLI commands fail

### 5. airflow → Kafka
- **Protocol:** Kafka Protocol (kafka-python)
- **Direction:** Consumer
- **Purpose:** Workflow triggers from task events
- **Failure Mode:** Workflows not triggered

### 6. daemon/gitea-kafka-bridge → Kafka
- **Protocol:** Kafka Protocol (kafkajs)
- **Direction:** Producer
- **Purpose:** Bridge Git events to Kafka
- **Failure Mode:** Git events not propagated

### 7. rig → AI Providers (External)
- **Protocol:** HTTPS/REST
- **Direction:** Outbound
- **Purpose:** AI completions, embeddings, chat
- **Providers:** OpenAI, Anthropic, Azure OpenAI, OpenRouter, Google AI
- **Failure Mode:** AI features unavailable

### 8. rig → Datadog (External)
- **Protocol:** HTTPS (dd-trace)
- **Direction:** Outbound
- **Purpose:** APM, logs, metrics, RUM
- **Failure Mode:** Monitoring disabled, service continues

### 9. rig → Docker (Local)
- **Protocol:** Docker API
- **Direction:** Bidirectional
- **Purpose:** Container management
- **Health Check:** `/api/health/services?service=docker`

### 10. rig → SSH/Dropbear (Local)
- **Protocol:** SSH
- **Direction:** Outbound
- **Purpose:** Remote workspace access
- **Health Check:** `/api/health/services?service=ssh`

### 11. rig → OpenVSCode (Local)
- **Protocol:** HTTP/WebSocket
- **Direction:** Bidirectional
- **Purpose:** IDE integration
- **Health Check:** `/api/health/services?service=openvscode`

### 12. docs (Standalone)
- **Dependencies:** None
- **Purpose:** Static documentation site
- **Build:** Astro SSG

---

## External Service Dependencies

### AI Providers

**OpenAI**
- Base URL: `https://api.openai.com/v1`
- Auth: `OPENAI_API_KEY`
- Models: GPT-4 Turbo, GPT-3.5, text-embedding-ada-002

**Anthropic**
- Auth: `ANTHROPIC_API_KEY`
- Models: Claude 3.5 Sonnet, Claude 3.5 Haiku

**Azure OpenAI**
- Base URL: `AZURE_OPENAI_ENDPOINT`
- Auth: `AZURE_OPENAI_API_KEY`
- Deployments: gpt-4-turbo, text-embedding-3-large

**OpenRouter**
- Base URL: `https://openrouter.ai/api/v1`
- Auth: `OPENROUTER_API_KEY`
- Purpose: Unified API for multiple models

**Google AI**
- Auth: `GOOGLE_AI_API_KEY`
- Models: Gemini

**HuggingFace**
- Auth: `HUGGINGFACE_API_KEY`
- Purpose: Model inference

### Monitoring & Observability

**Datadog**
- APM Agent: Port 8126
- Site: `datadoghq.com`
- Services: APM, Logs, RUM, Database Monitoring, LLM Observability
- Auth: `DD_API_KEY`, `DD_APP_KEY`

**OpenTelemetry (Optional)**
- Endpoint: `http://localhost:4318`
- Protocol: OTLP/HTTP
- Purpose: Alternative observability backend

### Cloud Services

**Azure**
- Blob Storage: File uploads
- Cosmos DB: Optional document storage
- Queue Storage: Task queuing
- Auth: `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_TENANT_ID`

**GitHub**
- OAuth: User authentication
- Webhooks: CI/CD integration
- API: Repository operations
- Auth: `GITHUB_TOKEN`, `GITHUB_WEBHOOK_SECRET`

### Vector Databases (Optional)

**ChromaDB**
- URL: `http://localhost:8000`
- Purpose: Vector similarity search

**Weaviate**
- URL: `http://localhost:8080`
- Protocol: HTTP/gRPC
- Purpose: Vector database

**Supabase**
- URL: `SUPABASE_URL`
- Auth: `SUPABASE_SERVICE_ROLE_KEY`
- Purpose: Managed PostgreSQL + Vector search

---

## API Contracts

### Core API Routes (rig service)

**Health & Status**
```
GET  /api/health              - Overall health
GET  /api/health/db           - Database health
GET  /api/health/services     - All services health
GET  /api/readyz              - Kubernetes readiness probe
GET  /api/dashboard/status    - Dashboard status
```

**Authentication**
```
POST /api/auth/[...nextauth]  - NextAuth.js authentication
POST /api/auth/mfa/setup      - MFA setup
POST /api/auth/mfa/verify     - MFA verification
GET  /api/auth/csrf           - CSRF token
POST /api/auth/login-tracking - Login audit
GET  /api/auth/saml/metadata  - SAML metadata
POST /api/auth/saml/sso       - SAML SSO
```

**Workspaces**
```
GET    /api/workspaces              - List workspaces
POST   /api/workspaces              - Create workspace
GET    /api/workspaces/[id]         - Get workspace
PATCH  /api/workspaces/[id]         - Update workspace
DELETE /api/workspaces/[id]         - Delete workspace
POST   /api/workspace/auto-scaling  - Auto-scaling config
POST   /api/workspace/[id]/init-goose - Initialize Goose agent
```

**AI & Chat**
```
POST /api/chat/stream           - Streaming chat
POST /api/chat/mongodb          - MongoDB chat backend
POST /api/chat/mongodb-simple   - Simple MongoDB chat
POST /api/claude/generate       - Claude generation
POST /api/claude/analyze        - Claude analysis
POST /api/code-completion       - Code completion
```

**Vector & RAG**
```
POST /api/vector-store          - Vector store operations
POST /api/vector-search         - Vector similarity search
POST /api/uploads/pdf           - PDF upload for RAG
GET  /api/docs/search           - Documentation search
```

**VM & Infrastructure**
```
GET    /api/vm/instances         - List VM instances
POST   /api/vm/instances         - Create VM instance
GET    /api/vm/instances/[id]    - Get VM instance
DELETE /api/vm/instances/[id]    - Delete VM instance
POST   /api/vm/instances/[id]/start   - Start VM
POST   /api/vm/instances/[id]/stop    - Stop VM
POST   /api/vm/instances/[id]/clone   - Clone VM
GET    /api/vm/snapshots         - List snapshots
POST   /api/vm/snapshots         - Create snapshot
GET    /api/vm/snapshots/[id]    - Get snapshot
POST   /api/vm/snapshots/[id]/restore - Restore snapshot
POST   /api/vm/snapshots/[id]/export  - Export snapshot
POST   /api/vm/snapshots/import  - Import snapshot
GET    /api/vm/snapshots/estimate - Estimate snapshot size
GET    /api/vm/profiles          - List VM profiles
```

**Terminal & IDE**
```
GET  /api/terminal/ws           - Terminal WebSocket
POST /api/terminal/session      - Create terminal session
GET  /api/ide/session           - List IDE sessions
POST /api/ide/session           - Create IDE session
GET  /api/ide/session/[id]      - Get IDE session
```

**Agents**
```
ALL /api/agents/[...path]       - Agent API proxy
POST /api/agent-builder/session - Agent builder session
```

**Monitoring & Dashboards**
```
GET /api/dashboard/overview     - Dashboard overview
GET /api/dashboard/performance  - Performance metrics
GET /api/dashboard/ai-usage     - AI usage statistics
GET /api/monitoring/dashboard   - Monitoring dashboard
GET /api/monitoring/metrics     - System metrics
GET /api/monitoring/otel-config - OpenTelemetry config
GET /api/monitoring/traces      - Trace data
```

**Webhooks**
```
POST /api/webhooks/github-actions - GitHub Actions webhook
```

**Docker & Projects**
```
GET  /api/docker/status          - Docker daemon status
POST /api/projects/template      - Create from template
POST /api/gradio/run             - Run Gradio app
```

**User & Settings**
```
GET   /api/user/preferences      - User preferences
PATCH /api/user/preferences      - Update preferences
GET   /api/experiments           - Feature experiments
GET   /api/updates               - System updates
```

**Security**
```
POST /api/security/csp-report    - CSP violation reports
```

---

## WebSocket Connections

### Terminal WebSocket
- **Endpoint:** `ws://localhost:3000/api/terminal/ws`
- **Purpose:** Interactive terminal sessions
- **Protocol:** WebSocket with node-pty
- **Authentication:** JWT token

### IDE Session WebSocket
- **Endpoint:** `ws://localhost:3000/api/ide/session/[sessionId]`
- **Purpose:** IDE state synchronization
- **Protocol:** WebSocket

### Collaboration WebSocket
- **Endpoint:** `ws://localhost:3000/api/collaboration/socket`
- **Purpose:** Real-time collaboration (Yjs)
- **Protocol:** Socket.io
- **Features:** Cursor sharing, document sync

### Agent API WebSocket
- **Endpoint:** `ws://localhost:3000/api/agents/[...path]`
- **Purpose:** Agent communication
- **Protocol:** WebSocket

**WebSocket Configuration:**
```env
NEXT_PUBLIC_WS_URL=ws://localhost:3001
MCP_SERVER_PORT=3001
```

**WebSocket Client Implementations:**
- `src/lib/websocket-connection-pooling.ts` - Connection pooling
- `src/lib/streaming/optimized-websocket-client.ts` - Optimized client
- `src/lib/streaming/websocket-streaming-client.ts` - Streaming client

---

## Service Dependency Graph

```
┌─────────────────────────────────────────────────────────────────┐
│                     External Services                            │
├─────────────────────────────────────────────────────────────────┤
│  OpenAI │ Anthropic │ Azure OpenAI │ OpenRouter │ Google AI     │
│  Datadog (APM, Logs, RUM) │ GitHub │ Azure Blob Storage        │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    rig (Next.js Application)                     │
│  Port: 3000 │ Framework: Next.js 16 │ Language: TypeScript      │
├─────────────────────────────────────────────────────────────────┤
│  • REST API Gateway (100+ endpoints)                            │
│  • WebSocket Server (terminal, collaboration, IDE)              │
│  • Kafka Producer (system events)                               │
│  • Frontend (React 19, Tailwind CSS)                            │
└───┬───────────┬────────────┬─────────────┬──────────────────────┘
    │           │            │             │
    ▼           ▼            ▼             ▼
┌─────────┐ ┌────────┐ ┌─────────┐ ┌─────────────┐
│PostgreSQL│ │Redis/  │ │ Kafka   │ │Docker/SSH/  │
│pgvector  │ │Valkey  │ │         │ │OpenVSCode   │
│Port: 5432│ │Port:   │ │Port:    │ │             │
│          │ │6379    │ │9092     │ │             │
└─────────┘ └────────┘ └────┬────┘ └─────────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
       ┌────────────┐ ┌────────────┐ ┌──────────────┐
       │td (Go CLI) │ │airflow     │ │daemon/       │
       │            │ │(Python)    │ │gitea-bridge  │
       │Kafka       │ │            │ │              │
       │Consumer/   │ │Kafka       │ │Kafka Producer│
       │Producer    │ │Consumer    │ │              │
       └────────────┘ └────────────┘ └──────────────┘
              │              │              │
              └──────────────┼──────────────┘
                             │
                             ▼
                      ┌─────────────┐
                      │Kafka Cluster│
                      │Topics:      │
                      │- beads-*    │
                      │- nudges     │
                      │- gitea-*    │
                      └─────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                  docs (Astro Documentation)                      │
│  Framework: Astro │ Language: TypeScript │ Status: Standalone   │
│  No runtime dependencies on other services                       │
└─────────────────────────────────────────────────────────────────┘
```

### Dependency Flow

**Request Flow (User → AI Chat):**
1. User → `rig` (Browser)
2. `rig` → PostgreSQL (load conversation history)
3. `rig` → Redis (check rate limit)
4. `rig` → OpenAI/Anthropic (AI completion)
5. `rig` → PostgreSQL (save message)
6. `rig` → Kafka (emit analytics event)
7. `rig` → User (stream response)

**Task Flow (td CLI → Airflow):**
1. User → `td sling` command
2. `td` → Kafka (publish bead-created event)
3. Kafka → `airflow` (consume event)
4. `airflow` → Execute DAG
5. `td` → Kafka (publish bead-completed event)
6. Kafka → `rig` (analytics)

**Git Event Flow:**
1. GitHub/Gitea → Webhook → `daemon/gitea-kafka-bridge`
2. `gitea-bridge` → Kafka (publish gitea-webhook event)
3. Kafka → `td` (consume event)
4. `td` → Execute workflow

---

## Communication Patterns Summary

### Synchronous Communication
- **HTTP/REST**: rig ↔ External APIs (AI providers, GitHub, Datadog)
- **WebSocket**: rig ↔ Browser (terminal, collaboration, IDE)
- **SQL**: rig ↔ PostgreSQL (via Prisma)
- **Redis Protocol**: rig ↔ Redis/Valkey

### Asynchronous Communication
- **Kafka**: td ↔ airflow ↔ daemon services
- **Message Queues**: Azure Queue Storage (optional)

### Data Storage
- **Primary**: PostgreSQL (relational data, vector embeddings)
- **Cache**: Redis/Valkey (sessions, rate limiting, health checks)
- **Optional**: MongoDB (chat), ChromaDB/Weaviate (vectors), Azure Blob (files)

### Observability
- **APM**: Datadog dd-trace (Node.js, Python)
- **Logs**: Datadog Logs, Pino (structured logging)
- **Metrics**: Datadog Metrics, OpenTelemetry (optional)
- **RUM**: Datadog Browser RUM

---

## Failure Modes & Resilience

| Service | Failure Impact | Mitigation | Recovery |
|---------|---------------|------------|----------|
| PostgreSQL | Critical - app unavailable | Health checks, connection pooling | Auto-reconnect, failover |
| Redis/Valkey | Degraded - slower performance | Fallback to direct queries | Auto-reconnect |
| Kafka | Partial - events lost | Event buffering (not implemented) | Manual replay |
| AI Providers | Partial - AI features down | Multiple providers, fallback | Retry with backoff |
| Docker | Partial - container ops fail | Health checks | Manual restart |
| OpenVSCode | Partial - IDE unavailable | Health checks, multi-instance | Manual restart |
| Datadog | No impact - monitoring only | Continue without monitoring | Automatic retry |

---

## Configuration Matrix

### Environment Variables by Service

**rig (Next.js):**
```env
DATABASE_URL                 # PostgreSQL connection
REDIS_URL                    # Redis/Valkey connection
KAFKA_BROKERS                # Kafka brokers
OPENAI_API_KEY               # OpenAI
ANTHROPIC_API_KEY            # Anthropic
DD_API_KEY                   # Datadog
NEXTAUTH_SECRET              # Auth
JWT_SECRET                   # WebSocket auth
```

**td (Go CLI):**
```env
TD_KAFKA_BROKERS             # Kafka brokers
TD_REPO_ROOT                 # Repository root path
TD_RIG                       # Rig identifier
TD_ROLE                      # Role identifier
TD_LANE                      # Lane identifier
```

**airflow (Python):**
```env
AIRFLOW_HOME                 # Airflow home directory
KAFKA_BROKERS                # Kafka brokers
DD_API_KEY                   # Datadog (optional)
```

**daemon/gitea-kafka-bridge:**
```env
KAFKA_BROKERS                # Kafka brokers
```

---

## Security Considerations

### Authentication & Authorization
- **NextAuth.js**: OAuth (GitHub, Google), credentials
- **JWT**: WebSocket authentication
- **MFA**: TOTP-based multi-factor authentication
- **SAML**: Enterprise SSO support

### Secrets Management
- Environment variables (`.env` files)
- Keychain integration (macOS)
- Azure Key Vault (optional)

### Network Security
- HTTPS only in production
- CORS configuration
- Rate limiting (Redis-backed)
- CSP headers

### Data Security
- Encrypted connections (TLS)
- Database encryption at rest
- Secure cookie flags
- HSTS headers

---

## Monitoring & Observability Matrix

| Service | APM | Logs | Metrics | Traces | RUM |
|---------|-----|------|---------|--------|-----|
| rig | ✅ dd-trace | ✅ Pino | ✅ hot-shots | ✅ dd-trace | ✅ Browser RUM |
| td | ❌ | ❌ | ❌ | ❌ | ❌ |
| airflow | ✅ ddtrace | ✅ Python logging | ❌ | ✅ ddtrace | ❌ |
| daemon | ❌ | ✅ Console | ❌ | ❌ | ❌ |
| docs | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## Build & Deployment Dependencies

### Docker Compose Services (Development)

```yaml
services:
  vibecode-dev:     # Main Next.js application
  valkey:           # Redis-compatible cache
  postgres:         # PostgreSQL with pgvector
  docker:           # Docker-in-Docker
  dropbear:         # SSH service
```

### Service Start Order

1. PostgreSQL (required)
2. Redis/Valkey (required)
3. Kafka (optional, for td/airflow)
4. rig (main application)
5. Docker/SSH/OpenVSCode (infrastructure)
6. daemon services (optional)
7. airflow (optional)

### Health Check Sequence

```bash
# Check database
curl http://localhost:3000/api/health/db

# Check all services
curl http://localhost:3000/api/health/services

# Check specific service
curl http://localhost:3000/api/health/services?service=postgresql
```

---

## Development Workflow

### Starting Services Locally

```bash
# Option 1: Docker Compose (Recommended)
docker-compose -f config/docker/docker-compose.dev.yml up

# Option 2: Native (requires manual setup)
# 1. Start PostgreSQL (port 5432)
# 2. Start Redis (port 6379)
# 3. Start Kafka (port 9092) - optional
npm run dev

# Option 3: VM Backend
python3 scripts/launch_ubuntu_vm.py
npm run tauri:dev
```

### Testing Service Dependencies

```bash
# Test database connection
npm run test:root:database

# Test AI providers
npm run test:integration

# Test Kafka (requires td CLI)
cd td && ./bin/td kafka status
```

---

## Future Considerations

### Potential Improvements

1. **Service Mesh**: Implement Istio/Linkerd for better service-to-service communication
2. **API Gateway**: Centralized Kong/Traefik for routing and rate limiting
3. **Event Sourcing**: Full event sourcing with Kafka for audit trail
4. **Circuit Breakers**: Implement circuit breakers for external service calls
5. **Message Deduplication**: Kafka exactly-once semantics
6. **Multi-Region**: Geo-distributed deployments with data replication
7. **gRPC**: Replace some REST APIs with gRPC for better performance

### Scalability Considerations

- **PostgreSQL**: Read replicas, connection pooling (PgBouncer)
- **Redis**: Redis Cluster or Sentinel for HA
- **Kafka**: Multi-broker setup with replication
- **rig**: Horizontal scaling with session affinity
- **Load Balancing**: NGINX/HAProxy for load distribution

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-02-16 | Initial dependency map created | auto-claude |

---

## References

- [Architecture Documentation](./docs/ARCHITECTURE.md)
- [API Documentation](./docs/api/)
- [Deployment Guide](./RELEASE_PROCESS.md)
- [Environment Variables](./.env.example)
- [Docker Compose](./config/docker/docker-compose.dev.yml)
- [Prisma Schema](./prisma/schema.prisma)

---

**Note**: This document represents the current state of service dependencies as of February 2026. As the system evolves, this document should be updated to reflect new services, dependencies, and communication patterns.
