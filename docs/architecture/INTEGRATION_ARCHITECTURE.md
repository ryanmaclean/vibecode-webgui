# VibeCode Integration Architecture
**Component Integration Patterns and Data Flow**

**Version:** 1.0
**Date:** February 28, 2026
**Status:** Active

---

## Table of Contents

1. [Integration Overview](#integration-overview)
2. [Architecture Layers](#architecture-layers)
3. [Platform Integration Patterns](#platform-integration-patterns)
4. [Service Integration Patterns](#service-integration-patterns)
5. [Infrastructure Integration](#infrastructure-integration)
6. [Data Flow Patterns](#data-flow-patterns)
7. [Communication Protocols](#communication-protocols)
8. [Integration Security](#integration-security)
9. [Failure Modes and Resilience](#failure-modes-and-resilience)
10. [Integration Best Practices](#integration-best-practices)

---

## Integration Overview

VibeCode uses a **layered integration architecture** that separates concerns across four primary layers: Platforms, Services, Infrastructure, and Shared Libraries. This document describes how these components integrate and communicate.

### Integration Principles

1. **Loose Coupling** - Components interact through well-defined interfaces
2. **Protocol Diversity** - Multiple communication patterns for different use cases
3. **Resilient Design** - Graceful degradation when dependencies fail
4. **Observable Integration** - All integration points instrumented with monitoring
5. **Security by Default** - Authentication and authorization at every boundary

### High-Level Integration Map

```mermaid
graph TB
    subgraph "Platform Layer"
        Web[Web Platform<br/>Next.js 15]
        Desktop[Desktop Platform<br/>Tauri + Rust]
        Mobile[Mobile Platform<br/>iOS/Android]
        CLI[CLI Platform<br/>td/Go]
    end

    subgraph "API Gateway Layer"
        Gateway[API Gateway<br/>rig/Next.js]
    end

    subgraph "Service Layer"
        AIGateway[AI Gateway<br/>Model Routing]
        Auth[Auth Service<br/>JWT/OAuth]
        Chat[Chat Service<br/>WebSocket]
        Workflow[Workflow Service<br/>Airflow]
        Webhook[Webhook Service<br/>Event Processing]
        Git[Git Service<br/>Gitea Integration]
    end

    subgraph "Data Layer"
        Postgres[(PostgreSQL<br/>Primary DB)]
        Redis[(Redis/Valkey<br/>Cache)]
        Kafka[Kafka<br/>Event Stream]
        MongoDB[(MongoDB<br/>Optional)]
    end

    subgraph "Infrastructure Layer"
        Monitoring[Datadog<br/>Monitoring]
        Secrets[Azure KeyVault<br/>Secrets]
        Storage[Azure Blob<br/>Storage]
    end

    Web --> Gateway
    Desktop --> Gateway
    Mobile --> Gateway
    CLI -.-> Kafka

    Gateway --> AIGateway
    Gateway --> Auth
    Gateway --> Chat
    Gateway --> Webhook

    AIGateway --> Postgres
    Auth --> Postgres
    Chat --> Postgres
    Webhook --> Kafka

    Workflow -.-> Kafka
    Git -.-> Kafka

    Gateway --> Redis
    Gateway --> Monitoring

    Auth --> Secrets
    Chat --> Storage

    style Web fill:#61DAFB
    style Desktop fill:#FFC131
    style Mobile fill:#3DDC84
    style CLI fill:#00ADD8
    style Gateway fill:#000000,color:#fff
    style Postgres fill:#336791
    style Redis fill:#DC382D
    style Kafka fill:#231F20
```

---

## Architecture Layers

### Layer Responsibilities

| Layer | Purpose | Components | Integration Type |
|-------|---------|-----------|------------------|
| **Platform** | User interfaces and platform-specific code | Web, Desktop, Mobile, CLI | Synchronous HTTP/WebSocket |
| **Gateway** | API routing, authentication, rate limiting | rig (Next.js) | HTTP REST, WebSocket |
| **Service** | Business logic and domain services | AI, Auth, Chat, Workflow | HTTP, gRPC, Message Queue |
| **Data** | Persistence and caching | PostgreSQL, Redis, Kafka, MongoDB | TCP, Redis Protocol, Kafka Protocol |
| **Infrastructure** | Cross-cutting concerns | Monitoring, Secrets, Storage | HTTPS, SDK |

### Layer Interaction Rules

1. **Platforms** → **Gateway Only** - Platforms never call services directly
2. **Gateway** → **Services** - Gateway routes requests to appropriate services
3. **Services** → **Data Layer** - Services access data stores directly
4. **Services** ↔ **Services** - Async via message queue, sync via HTTP/gRPC
5. **All Layers** → **Infrastructure** - All layers can use infrastructure services

---

## Platform Integration Patterns

### Web Platform Integration

```mermaid
sequenceDiagram
    participant User
    participant NextJS as Web Platform<br/>(Next.js 15)
    participant Gateway as API Gateway
    participant Service as Backend Service
    participant DB as PostgreSQL

    User->>NextJS: Interact with UI
    NextJS->>Gateway: HTTP/REST Request
    Note over NextJS,Gateway: Authorization: Bearer <token>
    Gateway->>Gateway: Validate JWT
    Gateway->>Service: Forward Request
    Service->>DB: Query/Mutation
    DB-->>Service: Result
    Service-->>Gateway: Response
    Gateway-->>NextJS: JSON Response
    NextJS-->>User: Update UI
```

**Integration Details:**
- **Protocol:** HTTPS/REST, WebSocket (for real-time features)
- **Authentication:** JWT tokens in Authorization header
- **Data Format:** JSON
- **Error Handling:** Standard HTTP status codes with error details
- **Rate Limiting:** Enforced at Gateway layer
- **Caching:** Redis-backed caching for static resources

### Desktop Platform Integration

```mermaid
graph LR
    subgraph "Desktop App (Tauri)"
        Frontend[React Frontend]
        Backend[Rust Backend]
        IPC[IPC Bridge]
    end

    subgraph "API Gateway"
        Gateway[Next.js Gateway]
    end

    Frontend -->|invoke| IPC
    IPC -->|command| Backend
    Backend -->|HTTPS| Gateway
    Gateway -.->|response| Backend
    Backend -.->|emit| IPC
    IPC -.->|event| Frontend

    style Frontend fill:#61DAFB
    style Backend fill:#CE412B
    style Gateway fill:#000000,color:#fff
```

**Integration Details:**
- **Frontend-Backend:** Tauri IPC commands and events
- **Backend-Gateway:** HTTPS/REST with client certificates
- **Local Storage:** SQLite for offline data
- **Sync Strategy:** Delta sync on connection restore
- **Security:** Native keychain for token storage

### Mobile Platform Integration

**Integration Details:**
- **Protocol:** HTTPS/REST with mobile-optimized payloads
- **Offline Support:** Local SQLite with background sync
- **Authentication:** OAuth 2.0 with refresh tokens
- **Push Notifications:** FCM (Android), APNs (iOS)
- **Data Compression:** gzip for large payloads

### CLI Platform Integration

```mermaid
graph TB
    subgraph "CLI (td/Go)"
        CLI[CLI Commands]
        KafkaClient[Kafka Client<br/>segmentio/kafka-go]
        HTTPClient[HTTP Client]
    end

    subgraph "Message Queue"
        Kafka[Kafka Brokers]
    end

    subgraph "Services"
        Airflow[Airflow DAGs]
        Gateway[API Gateway]
    end

    CLI -->|produce| KafkaClient
    CLI -->|consume| KafkaClient
    CLI -->|HTTP| HTTPClient

    KafkaClient <-->|Kafka Protocol| Kafka
    HTTPClient -->|REST| Gateway

    Kafka <-.->|consume| Airflow

    style CLI fill:#00ADD8
    style Kafka fill:#231F20,color:#fff
```

**Integration Details:**
- **Primary:** Kafka for event-driven workflows
- **Secondary:** REST API for queries and management
- **Topics:** tundra-beads-created, tundra-beads-work, tundra-beads-completed
- **Authentication:** API keys for REST, mTLS for Kafka (production)
- **Reliability:** At-least-once delivery, idempotent handlers

---

## Service Integration Patterns

### Synchronous Integration (HTTP/REST)

**Use Cases:**
- User-initiated actions requiring immediate response
- CRUD operations
- Health checks and status queries

**Pattern:**

```mermaid
sequenceDiagram
    participant Client
    participant Gateway
    participant ServiceA
    participant ServiceB
    participant DB

    Client->>Gateway: POST /api/action
    Gateway->>Gateway: Authenticate & Authorize
    Gateway->>ServiceA: POST /internal/process
    ServiceA->>ServiceB: GET /internal/validate
    ServiceB-->>ServiceA: 200 OK
    ServiceA->>DB: Transaction
    DB-->>ServiceA: Committed
    ServiceA-->>Gateway: 200 OK + Result
    Gateway-->>Client: 200 OK + Result
```

**Implementation:**
- **Timeout:** 30s default, 60s for AI operations
- **Retries:** 3 attempts with exponential backoff
- **Circuit Breaker:** Open after 5 consecutive failures
- **Monitoring:** Request tracing via Datadog APM

### Asynchronous Integration (Message Queue)

**Use Cases:**
- Event notifications
- Background processing
- Cross-service workflows
- Audit logging

**Pattern:**

```mermaid
sequenceDiagram
    participant ServiceA
    participant Kafka
    participant ServiceB
    participant ServiceC

    ServiceA->>Kafka: Publish Event<br/>(tundra-beads-created)
    Note over Kafka: Event stored in topic
    Kafka->>ServiceB: Consume Event
    Kafka->>ServiceC: Consume Event
    ServiceB->>ServiceB: Process Event
    ServiceC->>ServiceC: Process Event
    ServiceB->>Kafka: Publish Result<br/>(tundra-beads-completed)
    ServiceC->>Kafka: Publish Status<br/>(tundra-beads-in-progress)
```

**Kafka Topics:**

| Topic | Producer | Consumer | Purpose | Retention |
|-------|----------|----------|---------|-----------|
| `tundra-beads-created` | rig, td | airflow, td | New task creation | 7 days |
| `tundra-beads-work` | td | airflow, td | Work assignment | 7 days |
| `tundra-beads-in-progress` | td | td | Status updates | 3 days |
| `tundra-beads-completed` | td | airflow, td | Completion events | 30 days |
| `tundra-nudges` | td | td | Notifications | 3 days |
| `gitea-webhooks` | gitea-bridge | td | Git events | 7 days |

**Implementation:**
- **Partitioning:** By user_id or workspace_id for ordering
- **Consumer Groups:** One per service for load balancing
- **Delivery Guarantee:** At-least-once with idempotent handlers
- **Dead Letter Queue:** Failed messages after 3 retries
- **Monitoring:** Lag monitoring, throughput metrics

### WebSocket Integration (Real-Time)

**Use Cases:**
- Live chat
- Real-time collaboration
- Notification streams
- Live updates

**Pattern:**

```mermaid
sequenceDiagram
    participant Client
    participant Gateway
    participant ChatService
    participant Redis
    participant Kafka

    Client->>Gateway: WebSocket Upgrade
    Gateway->>Gateway: Authenticate
    Gateway->>ChatService: Establish WS Connection
    ChatService->>Redis: Subscribe to channel

    Note over Client,Kafka: User sends message
    Client->>Gateway: WS: send_message
    Gateway->>ChatService: Process message
    ChatService->>Redis: Publish to channel
    ChatService->>Kafka: Publish event
    Redis-->>ChatService: Broadcast
    ChatService-->>Gateway: WS: new_message
    Gateway-->>Client: WS: new_message
```

**Implementation:**
- **Connection Pool:** Redis for pub/sub across instances
- **Heartbeat:** 30s ping/pong for connection health
- **Reconnection:** Exponential backoff, max 5 attempts
- **Message Queue:** In-memory queue with overflow to Kafka
- **Authentication:** JWT validation on upgrade

---

## Infrastructure Integration

### Database Integration

#### PostgreSQL Primary Database

```mermaid
graph TB
    subgraph "Application Layer"
        Rig[rig<br/>Prisma ORM]
    end

    subgraph "Connection Pool"
        Pool[PgBouncer<br/>Connection Pooling]
    end

    subgraph "Database Cluster"
        Primary[(PostgreSQL Primary<br/>Read/Write)]
        Replica1[(Replica 1<br/>Read-Only)]
        Replica2[(Replica 2<br/>Read-Only)]
    end

    subgraph "Extensions"
        PgVector[pgvector<br/>Vector Embeddings]
        PgCrypto[pgcrypto<br/>Encryption]
    end

    Rig -->|Connection Pool| Pool
    Pool -->|Write| Primary
    Pool -->|Read| Replica1
    Pool -->|Read| Replica2

    Primary -.->|Streaming Replication| Replica1
    Primary -.->|Streaming Replication| Replica2

    Primary --- PgVector
    Primary --- PgCrypto

    style Primary fill:#336791
    style Replica1 fill:#336791
    style Replica2 fill:#336791
```

**Configuration:**
- **Connection Pool:** Max 100 connections, 20s timeout
- **Read Replicas:** 2 replicas with lag < 100ms
- **Transactions:** SERIALIZABLE for critical operations
- **Migrations:** Prisma migrate with zero-downtime strategy
- **Backup:** Continuous archiving + daily snapshots

#### Redis/Valkey Cache

```mermaid
graph LR
    subgraph "Application"
        App[rig App]
    end

    subgraph "Redis Cluster"
        Master[Redis Master<br/>Read/Write]
        Slave1[Redis Slave 1<br/>Read-Only]
        Slave2[Redis Slave 2<br/>Read-Only]
    end

    subgraph "Use Cases"
        Sessions[Sessions<br/>DB 1]
        Cache[Cache<br/>DB 0]
        RateLimit[Rate Limiting<br/>DB 2]
    end

    App -->|Write| Master
    App -->|Read| Slave1
    App -->|Read| Slave2

    Master -.->|Replication| Slave1
    Master -.->|Replication| Slave2

    Master --- Sessions
    Master --- Cache
    Master --- RateLimit

    style Master fill:#DC382D
    style Slave1 fill:#DC382D
    style Slave2 fill:#DC382D
```

**Configuration:**
- **Topology:** 1 master + 2 slaves with Sentinel
- **Databases:** DB 0 (cache), DB 1 (sessions), DB 2 (rate limits)
- **Eviction:** LRU for cache DB, no eviction for sessions
- **TTL:** 5s (health checks), 3600s (API responses), 86400s (sessions)
- **Persistence:** RDB snapshots every 60s if 1000+ keys changed

### Monitoring Integration

```mermaid
graph TB
    subgraph "Application Services"
        Rig[rig Service]
        TD[td CLI]
        Airflow[Airflow]
        Daemon[daemon]
    end

    subgraph "Datadog Agent"
        Agent[DD Agent<br/>StatsD + APM]
    end

    subgraph "Datadog Platform"
        APM[APM Traces]
        Logs[Log Management]
        Metrics[Metrics]
        RUM[Real User Monitoring]
        Synthetics[Synthetic Monitoring]
    end

    Rig -->|dd-trace| Agent
    TD -->|dd-trace-go| Agent
    Airflow -->|ddtrace| Agent
    Daemon -->|dd-trace| Agent

    Agent -->|HTTPS| APM
    Agent -->|HTTPS| Logs
    Agent -->|HTTPS| Metrics

    Rig -->|RUM SDK| RUM

    Datadog -.->|Synthetics| Rig

    style Agent fill:#632CA6
    style APM fill:#632CA6
    style Logs fill:#632CA6
    style Metrics fill:#632CA6
```

**Integration Points:**
- **APM:** Distributed tracing across all services
- **Logs:** JSON structured logs with correlation IDs
- **Metrics:** Custom metrics, system metrics, business metrics
- **RUM:** Frontend performance and user sessions
- **Synthetics:** API and browser tests every 5 minutes
- **Alerts:** PagerDuty integration for critical alerts

### Secrets Management

```mermaid
graph TB
    subgraph "Application Runtime"
        App[Application]
        EnvVars[Environment Variables]
    end

    subgraph "Azure KeyVault"
        Vault[KeyVault Secrets]
    end

    subgraph "Secret Types"
        APIKeys[API Keys]
        DBCreds[Database Credentials]
        JWTSecret[JWT Secrets]
        Certs[TLS Certificates]
    end

    subgraph "Access Control"
        MSI[Managed Service Identity]
        RBAC[RBAC Policies]
    end

    App -->|Azure SDK| Vault
    Vault --- APIKeys
    Vault --- DBCreds
    Vault --- JWTSecret
    Vault --- Certs

    App -.->|Fallback| EnvVars

    MSI --> Vault
    RBAC --> Vault

    style Vault fill:#0078D4
```

**Configuration:**
- **Access:** Managed Service Identity for Azure resources
- **Rotation:** Automatic 90-day rotation for DB credentials
- **Caching:** 5-minute local cache to reduce API calls
- **Fallback:** Environment variables for local development
- **Auditing:** All secret access logged to Azure Monitor

---

## Data Flow Patterns

### User Request Flow

```mermaid
graph TB
    User[User Browser]

    subgraph "Web Platform"
        UI[React UI]
        NextAPI[Next.js API Routes]
    end

    subgraph "Gateway Layer"
        Auth[Auth Middleware]
        RateLimit[Rate Limiter]
        Router[Request Router]
    end

    subgraph "Service Layer"
        AIGateway[AI Gateway]
        ChatService[Chat Service]
    end

    subgraph "Data Layer"
        Cache[Redis Cache]
        DB[(PostgreSQL)]
        Events[Kafka Events]
    end

    subgraph "External"
        OpenAI[OpenAI API]
        Anthropic[Anthropic API]
    end

    User -->|HTTPS| UI
    UI -->|API Call| NextAPI
    NextAPI --> Auth
    Auth --> RateLimit
    RateLimit --> Router

    Router -->|AI Request| AIGateway
    Router -->|Chat Request| ChatService

    AIGateway --> Cache
    Cache -.->|Cache Miss| AIGateway
    AIGateway --> OpenAI
    AIGateway --> Anthropic

    ChatService --> DB
    ChatService --> Events

    OpenAI -.->|Response| AIGateway
    Anthropic -.->|Response| AIGateway
    AIGateway -.->|Cache| Cache
    AIGateway -.->|Response| Router

    ChatService -.->|Response| Router
    Router -.->|Response| NextAPI
    NextAPI -.->|JSON| UI
    UI -.->|Update| User

    style UI fill:#61DAFB
    style Cache fill:#DC382D
    style DB fill:#336791
    style Events fill:#231F20,color:#fff
```

### Background Job Flow

```mermaid
sequenceDiagram
    participant User
    participant API as API Gateway
    participant DB as PostgreSQL
    participant Queue as Kafka
    participant Worker as Background Worker
    participant Storage as Azure Blob

    User->>API: Upload File
    API->>DB: Create File Record<br/>(status: pending)
    API->>Queue: Publish process_file event
    API-->>User: 202 Accepted<br/>(job_id: 123)

    Queue->>Worker: Consume event
    Worker->>DB: Update status: processing
    Worker->>Storage: Upload to Blob Storage
    Worker->>Worker: Process File
    Worker->>DB: Update status: completed
    Worker->>Queue: Publish file_processed event

    Note over User,Storage: Async notification
    Queue->>API: WebSocket notification
    API-->>User: WS: job_complete
```

### Event-Driven Workflow

```mermaid
graph LR
    subgraph "Event Sources"
        User[User Action]
        Git[Git Webhook]
        Cron[Scheduled Job]
    end

    subgraph "Event Bus"
        Kafka[Kafka Topics]
    end

    subgraph "Event Processors"
        Airflow[Airflow DAG]
        TD[td Worker]
        Webhook[Webhook Service]
    end

    subgraph "Side Effects"
        Notify[Notifications]
        Storage[File Storage]
        DB[(Database)]
    end

    User -->|API| Kafka
    Git -->|Webhook| Kafka
    Cron -->|Schedule| Kafka

    Kafka --> Airflow
    Kafka --> TD
    Kafka --> Webhook

    Airflow --> DB
    Airflow --> Storage
    TD --> Notify
    Webhook --> DB

    style Kafka fill:#231F20,color:#fff
```

---

## Communication Protocols

### Protocol Selection Matrix

| Use Case | Protocol | Latency | Reliability | Complexity |
|----------|----------|---------|-------------|------------|
| User API calls | HTTP/REST | 50-200ms | High | Low |
| Real-time chat | WebSocket | <10ms | Medium | Medium |
| Service-to-service sync | HTTP/gRPC | 10-50ms | High | Medium |
| Event streaming | Kafka | 5-20ms | Very High | High |
| Caching | Redis Protocol | <5ms | Medium | Low |
| Database | PostgreSQL Protocol | 5-20ms | Very High | Low |
| File transfer | HTTPS + Multipart | Varies | High | Low |

### REST API Standards

**Endpoint Naming:**
```
GET    /api/v1/resources          # List resources
GET    /api/v1/resources/:id      # Get single resource
POST   /api/v1/resources          # Create resource
PUT    /api/v1/resources/:id      # Update resource (full)
PATCH  /api/v1/resources/:id      # Update resource (partial)
DELETE /api/v1/resources/:id      # Delete resource
```

**Response Format:**
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "timestamp": "2026-02-28T10:00:00Z",
    "request_id": "uuid-v4"
  },
  "errors": []
}
```

**Error Response:**
```json
{
  "success": false,
  "errors": [
    {
      "code": "VALIDATION_ERROR",
      "message": "Invalid email format",
      "field": "email"
    }
  ],
  "meta": {
    "timestamp": "2026-02-28T10:00:00Z",
    "request_id": "uuid-v4"
  }
}
```

### WebSocket Protocol

**Connection Lifecycle:**
```
1. Client: HTTP Upgrade Request
2. Server: 101 Switching Protocols
3. Server: {type: "connection_ack", data: {session_id}}
4. Client/Server: Bidirectional messages
5. Client/Server: Ping/Pong (30s interval)
6. Client/Server: Close frame
```

**Message Format:**
```json
{
  "type": "message|subscribe|unsubscribe|ping|pong",
  "channel": "chat:room:123",
  "data": { ... },
  "meta": {
    "timestamp": "2026-02-28T10:00:00Z",
    "message_id": "uuid-v4"
  }
}
```

---

## Integration Security

### Authentication Layers

```mermaid
graph TB
    subgraph "Client Layer"
        Browser[Browser/App]
    end

    subgraph "Gateway Layer"
        JWT[JWT Validation]
        APIKey[API Key Validation]
    end

    subgraph "Service Layer"
        mTLS[Mutual TLS]
        ServiceAuth[Service Identity]
    end

    subgraph "Data Layer"
        DBAuth[Database Credentials]
        SecretMgmt[Secret Management]
    end

    Browser -->|JWT Bearer Token| JWT
    Browser -->|API Key| APIKey

    JWT --> mTLS
    APIKey --> mTLS

    mTLS --> ServiceAuth
    ServiceAuth --> DBAuth
    ServiceAuth --> SecretMgmt

    style JWT fill:#4CAF50
    style mTLS fill:#4CAF50
    style DBAuth fill:#4CAF50
```

### Security Controls

| Layer | Control | Implementation |
|-------|---------|----------------|
| **Transport** | TLS 1.3 | All external communication |
| **Application** | JWT | RS256, 1h expiry, refresh tokens |
| **Service** | mTLS | Internal service-to-service |
| **Data** | Encryption at rest | AES-256 for sensitive fields |
| **Network** | Network policies | K8s NetworkPolicy, Azure NSG |
| **Secrets** | KeyVault | Azure KeyVault with RBAC |

### Authorization Model

```mermaid
graph TB
    User[User Request]

    subgraph "Authentication"
        JWT[JWT Verification]
        Session[Session Validation]
    end

    subgraph "Authorization"
        RBAC[Role-Based Access Control]
        ABAC[Attribute-Based Access Control]
        Workspace[Workspace Membership]
    end

    subgraph "Resource Access"
        Resource[Protected Resource]
    end

    User --> JWT
    JWT --> Session
    Session --> RBAC
    Session --> ABAC
    Session --> Workspace

    RBAC --> Resource
    ABAC --> Resource
    Workspace --> Resource

    style JWT fill:#FF9800
    style RBAC fill:#FF9800
    style Resource fill:#4CAF50
```

**Roles:**
- `admin` - Full system access
- `user` - Standard user permissions
- `viewer` - Read-only access
- `service` - Service-to-service communication

**Workspace Permissions:**
- `owner` - Full workspace control
- `editor` - Read/write access
- `viewer` - Read-only access

---

## Failure Modes and Resilience

### Circuit Breaker Pattern

```mermaid
stateDiagram-v2
    [*] --> Closed
    Closed --> Open: Failure threshold reached<br/>(5 consecutive failures)
    Open --> HalfOpen: Timeout elapsed<br/>(30 seconds)
    HalfOpen --> Closed: Success
    HalfOpen --> Open: Failure

    Closed: Requests pass through<br/>Monitoring failure rate
    Open: Requests fail fast<br/>No downstream calls
    HalfOpen: Test request sent<br/>Evaluate recovery
```

**Configuration:**
- **Failure Threshold:** 5 consecutive failures or 50% error rate
- **Timeout:** 30 seconds before attempting recovery
- **Half-Open Test:** Single request to verify recovery
- **Monitoring:** Circuit state exposed as Datadog metric

### Retry Strategy

**Exponential Backoff:**
```
Attempt 1: Immediate
Attempt 2: 1 second
Attempt 3: 2 seconds
Attempt 4: 4 seconds
Max: 3 retries
```

**Retry Conditions:**
- HTTP 5xx errors (server errors)
- Network timeouts
- Connection refused
- DNS resolution failures

**No Retry Conditions:**
- HTTP 4xx errors (client errors, except 429 Rate Limit)
- Authentication failures
- Validation errors

### Graceful Degradation

| Component | Failure Mode | Degraded Behavior |
|-----------|--------------|-------------------|
| **PostgreSQL** | Down | Return 503, queue writes to Kafka |
| **Redis** | Down | Skip cache, direct database access |
| **Kafka** | Down | Store events in PostgreSQL, sync later |
| **AI Provider** | Down | Failover to alternative provider |
| **Datadog** | Down | Log locally, continue operation |
| **KeyVault** | Down | Use cached secrets (5 min TTL) |

### Health Check Strategy

```mermaid
graph TB
    subgraph "Health Check Endpoint"
        Health[/api/health]
    end

    subgraph "Component Checks"
        DB[(PostgreSQL<br/>Status)]
        Cache[(Redis<br/>Status)]
        Queue[Kafka<br/>Status]
        External[External APIs<br/>Status]
    end

    subgraph "Aggregation"
        Overall[Overall Health]
        Details[Component Details]
    end

    Health --> DB
    Health --> Cache
    Health --> Queue
    Health --> External

    DB --> Overall
    Cache --> Overall
    Queue --> Overall
    External --> Overall

    DB --> Details
    Cache --> Details
    Queue --> Details
    External --> Details

    style DB fill:#336791
    style Cache fill:#DC382D
    style Queue fill:#231F20,color:#fff
```

**Health Check Response:**
```json
{
  "status": "healthy|degraded|unhealthy",
  "timestamp": "2026-02-28T10:00:00Z",
  "uptime": 86400,
  "components": {
    "database": {
      "status": "healthy",
      "latency": 5,
      "details": "PostgreSQL 16.1"
    },
    "cache": {
      "status": "healthy",
      "latency": 2,
      "details": "Redis 7.2"
    },
    "kafka": {
      "status": "degraded",
      "latency": 150,
      "details": "High lag on consumer group"
    }
  }
}
```

---

## Integration Best Practices

### Design Principles

1. **Idempotency**
   - All API endpoints support idempotent operations
   - Use idempotency keys for non-idempotent operations
   - Message consumers handle duplicate events

2. **Timeouts**
   - Set explicit timeouts on all external calls
   - Use shorter timeouts for non-critical operations
   - Implement timeout budgets for cascading calls

3. **Rate Limiting**
   - Enforce rate limits at gateway layer
   - Use token bucket algorithm (100 req/min per user)
   - Return `Retry-After` header on 429 responses

4. **Versioning**
   - API versioning in URL path (`/api/v1/`)
   - Support N-1 version compatibility
   - Deprecation notices 90 days before removal

5. **Monitoring**
   - Instrument all integration points
   - Track latency, error rate, throughput
   - Set up alerts for SLA violations

### Common Patterns

#### Request ID Propagation

```
Client → Gateway: X-Request-ID: uuid-1
Gateway → Service A: X-Request-ID: uuid-1
Service A → Service B: X-Request-ID: uuid-1
Service B → Database: /* request_id: uuid-1 */
```

#### Correlation ID for Distributed Tracing

```
User Action → Request ID → Trace ID → Span IDs
                            └─> Service A Span
                                └─> Service B Span
                                    └─> Database Span
```

#### Circuit Breaker + Retry

```typescript
try {
  return await circuitBreaker.execute(async () => {
    return await retry(
      () => externalService.call(),
      { retries: 3, backoff: 'exponential' }
    );
  });
} catch (error) {
  if (error instanceof CircuitBreakerOpenError) {
    // Return cached data or fallback
    return fallbackData;
  }
  throw error;
}
```

### Anti-Patterns to Avoid

❌ **Avoid:**
- Direct database access from platforms
- Synchronous calls to slow external APIs
- Unbounded retry loops
- Chatty API calls (N+1 queries)
- Hardcoded credentials
- Missing timeout configuration
- Ignoring circuit breaker state

✅ **Instead:**
- Route all data access through Gateway/Services
- Use async jobs for slow operations
- Implement exponential backoff with max retries
- Batch API calls, use GraphQL for complex queries
- Use KeyVault or environment variables
- Set explicit timeouts (default: 30s)
- Monitor circuit state and adjust thresholds

---

## Related Documentation

- [Service Dependencies Map](../SERVICE_DEPENDENCIES.md) - Detailed service dependency matrix
- [Folder Structure](../FOLDER_STRUCTURE.md) - Code organization and module boundaries
- [Deployment Architecture](./DEPLOYMENT_ARCHITECTURE.md) - Deployment patterns and infrastructure
- [Agent Orchestration](./AGENT_ORCHESTRATION.md) - AI agent integration patterns
- [AKS Architecture](./AKS_ARCHITECTURE.md) - Kubernetes cluster architecture

---

**Document Maintenance:**
- **Owner:** Platform Architecture Team
- **Review Frequency:** Quarterly
- **Last Review:** 2026-02-28
- **Next Review:** 2026-05-28
