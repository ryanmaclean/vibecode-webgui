# VibeCode WebGUI System Architecture

**Version:** 1.0
**Last Updated:** 2025-10-01
**Status:** Production-Ready

## Table of Contents

- [System Overview](#system-overview)
- [Technology Stack](#technology-stack)
- [Architecture Layers](#architecture-layers)
- [Component Relationships](#component-relationships)
- [Data Flow](#data-flow)
- [Database Architecture](#database-architecture)
- [Security Architecture](#security-architecture)
- [Deployment Architecture](#deployment-architecture)
- [AI/ML Integration](#aiml-integration)
- [Monitoring & Observability](#monitoring--observability)
- [Scaling Strategy](#scaling-strategy)
- [Development Workflow](#development-workflow)

---

## System Overview

VibeCode WebGUI is an AI-powered development platform that provides a browser-based IDE with intelligent code completion, semantic search, and collaborative features. The system is built on modern web technologies with a focus on scalability, security, and observability.

```mermaid
graph TB
    subgraph "Client Layer"
        Browser[Web Browser]
        VSCode[VS Code Extensions]
    end

    subgraph "Application Layer"
        Next[Next.js 15 App]
        Monaco[Monaco Editor 0.53.0]
        API[API Routes]
    end

    subgraph "Service Layer"
        Auth[Authentication]
        AI[AI Services]
        Vector[Vector Search]
        Terminal[Terminal Service]
        MCP[MCP Servers]
    end

    subgraph "Data Layer"
        Postgres[(PostgreSQL 16<br/>+ pgvector)]
        Redis[(Redis/Valkey<br/>Cache)]
        Blob[Azure Blob Storage]
    end

    subgraph "Infrastructure"
        K8s[Kubernetes]
        Docker[Docker]
        Monitor[Datadog APM/DBM]
    end

    Browser --> Next
    VSCode --> API
    Next --> Monaco
    Next --> API
    API --> Auth
    API --> AI
    API --> Vector
    API --> Terminal
    API --> MCP

    Auth --> Postgres
    AI --> Postgres
    Vector --> Postgres
    Terminal --> K8s

    Next --> Redis
    AI --> Blob

    K8s --> Monitor
    Postgres --> Monitor
    Next --> Monitor
```

### Key Characteristics

- **Architecture Pattern:** Monolithic Next.js application with modular services
- **Runtime:** Node.js 18-24, Next.js 15 (App Router)
- **Deployment Targets:** Docker, Kubernetes (KinD/GKE/EKS/AKS), Azure App Service
- **Database:** PostgreSQL 16 with pgvector extension for semantic search
- **Primary Languages:** TypeScript (99%), JavaScript
- **Design Philosophy:** Server-side rendering with client-side hydration, API-first design

---

## Technology Stack

### Frontend Layer

| Technology | Version | Purpose |
|------------|---------|---------|
| **Next.js** | 15.5.4 | React framework with SSR/ISR capabilities |
| **React** | 19.1.1 | UI component library |
| **TypeScript** | 5.8.3 | Type-safe development |
| **Monaco Editor** | 0.53.0 | Browser-based code editor (VS Code core) |
| **Monacopilot** | 1.2.7 | AI-powered code completion in Monaco |
| **Tailwind CSS** | 4.0.0 | Utility-first CSS framework |
| **Tremor React** | 3.18.7 | Dashboard and data visualization components |
| **Framer Motion** | 12.23.22 | Animation library |
| **Radix UI** | Latest | Accessible component primitives |

### Backend Services

| Technology | Version | Purpose |
|------------|---------|---------|
| **PostgreSQL** | 16+ | Primary database with ACID guarantees |
| **pgvector** | Latest | Vector similarity search with HNSW indexes |
| **Prisma** | 6.12.0 | Type-safe ORM and schema management |
| **Redis/Valkey** | 5.8.1+ | Session storage and caching layer |
| **Node-PTY** | 1.0.0 | Terminal emulation for web-based shells |
| **Socket.IO** | 4.8.1 | Real-time bidirectional communication |
| **NextAuth.js** | 4.24.11 | Authentication with OAuth/SAML support |

### AI/ML Stack

| Technology | Purpose |
|------------|---------|
| **OpenAI SDK** | GPT-4, GPT-3.5, code completion models |
| **Anthropic SDK** | Claude 3.5 Sonnet, code generation |
| **Vercel AI SDK** | Unified AI interface with streaming support |
| **LangChain** | 0.3.34 - AI workflow orchestration |
| **Tiktoken** | Token counting and cost estimation |
| **ChromaDB** | 3.0.10 - Vector database client |
| **Weaviate Client** | 2.2.0 - Enterprise vector search |

### Infrastructure & DevOps

| Technology | Purpose |
|------------|---------|
| **Docker** | Containerization with multi-stage builds |
| **Kubernetes** | Container orchestration (KinD, GKE, EKS, AKS) |
| **Helm** | 3.19.0 - Kubernetes package management |
| **Datadog** | APM, DBM, RUM, logs, and distributed tracing |
| **OpenTelemetry** | Alternative observability instrumentation |
| **Playwright** | 1.54.2 - E2E testing and browser automation |
| **Jest** | 30.0.4 - Unit and integration testing |

### Model Context Protocol (MCP)

| MCP Server | Purpose |
|------------|---------|
| **Context7** | Official library documentation lookup |
| **Sequential** | Multi-step reasoning for complex analysis |
| **Serena** | Project memory and session persistence |
| **Playwright** | Browser automation and E2E testing |

---

## Architecture Layers

```mermaid
graph TB
    subgraph "Presentation Layer"
        UI[React Components]
        Pages[Next.js Pages]
        Monaco[Monaco Editor]
    end

    subgraph "Application Layer"
        Routes[API Routes]
        Middleware[Security Middleware]
        Auth[Auth Handlers]
    end

    subgraph "Business Logic Layer"
        AIService[AI Service]
        VectorService[Vector Search]
        WorkspaceService[Workspace Management]
        FileService[File Operations]
        MCPService[MCP Integration]
    end

    subgraph "Data Access Layer"
        PrismaClient[Prisma Client]
        RedisClient[Redis Client]
        BlobClient[Azure Blob Client]
        VectorDB[Vector DB Client]
    end

    subgraph "External Services"
        OpenAI[OpenAI API]
        Anthropic[Anthropic API]
        GitHub[GitHub OAuth]
        Azure[Azure Services]
    end

    UI --> Pages
    Pages --> Routes
    Routes --> Middleware
    Routes --> Auth
    Routes --> AIService
    Routes --> VectorService
    Routes --> WorkspaceService
    Routes --> FileService
    Routes --> MCPService

    AIService --> PrismaClient
    VectorService --> VectorDB
    WorkspaceService --> PrismaClient
    FileService --> BlobClient

    AIService --> OpenAI
    AIService --> Anthropic
    Auth --> GitHub
    FileService --> Azure
```

### Layer Responsibilities

#### 1. Presentation Layer (`/src/app`, `/src/components`)
- **React Components:** Reusable UI components with TypeScript props
- **Next.js Pages:** File-based routing with App Router
- **Monaco Integration:** Browser-based code editor with AI completion
- **Real-time UI:** WebSocket connections for collaboration

#### 2. Application Layer (`/src/app/api`, `/src/middleware`)
- **API Routes:** RESTful endpoints following Next.js conventions
- **Middleware:** Authentication, rate limiting, CORS, security headers
- **Request Validation:** Input sanitization and type checking
- **Error Handling:** Centralized error tracking with Datadog

#### 3. Business Logic Layer (`/src/lib`)
- **AI Services:** Code completion, chat, generation, analysis
- **Vector Search:** Semantic code search with embeddings
- **Workspace Management:** Project isolation and resource allocation
- **File Operations:** CRUD operations with Azure Blob storage
- **MCP Integration:** Model Context Protocol server implementations

#### 4. Data Access Layer (`/src/lib/db`, `/src/lib/cache`)
- **Prisma Client:** Type-safe database queries with connection pooling
- **Redis Client:** Session management and caching
- **Vector DB Clients:** ChromaDB, Weaviate, pgvector
- **Azure Clients:** Blob storage, Cosmos DB (optional)

---

## Component Relationships

### Core Components

```mermaid
graph LR
    subgraph "Frontend Components"
        IDE[IDE Component]
        Chat[Chat Interface]
        Terminal[Terminal Emulator]
        Projects[Project Manager]
    end

    subgraph "Shared Services"
        AuthService[Auth Service]
        FileSync[File Sync]
        Collaboration[Collaboration Engine]
    end

    subgraph "Backend Services"
        AIEngine[AI Engine]
        VectorStore[Vector Store]
        WorkspaceAPI[Workspace API]
    end

    IDE --> FileSync
    Chat --> AIEngine
    Terminal --> WorkspaceAPI
    Projects --> WorkspaceAPI

    IDE --> AuthService
    Chat --> AuthService
    Terminal --> AuthService
    Projects --> AuthService

    FileSync --> Collaboration
    AIEngine --> VectorStore
    WorkspaceAPI --> VectorStore
```

### Directory Structure

```
/src
├── app/                          # Next.js App Router
│   ├── api/                      # API route handlers
│   │   ├── auth/                 # Authentication endpoints
│   │   ├── chat/                 # Chat API with AI providers
│   │   ├── claude/               # Claude-specific endpoints
│   │   ├── code-completion/      # Code completion API
│   │   ├── health/               # Health check endpoints
│   │   ├── monitoring/           # Monitoring dashboards
│   │   ├── projects/             # Project management
│   │   ├── terminal/             # Terminal API
│   │   ├── vector-store/         # Vector search API
│   │   └── workspace/            # Workspace API
│   ├── auth/                     # Auth pages (signin, logout)
│   ├── chat/                     # Chat UI pages
│   ├── workspace/                # Workspace UI
│   └── layout.tsx                # Root layout with providers
│
├── components/                   # React components
│   ├── ide/                      # IDE-specific components
│   ├── ui/                       # Reusable UI primitives
│   ├── chat/                     # Chat components
│   ├── terminal/                 # Terminal UI
│   ├── collaboration/            # Real-time collaboration
│   └── workspace/                # Workspace management
│
├── lib/                          # Business logic & utilities
│   ├── ai/                       # AI service implementations
│   │   ├── agents/               # AI agents (code review, generation)
│   │   ├── prompts/              # Prompt templates
│   │   └── vector-stores/        # Vector DB integrations
│   ├── auth/                     # Auth configuration
│   ├── database/                 # Database utilities
│   ├── mcp/                      # MCP server implementations
│   │   ├── context7/             # Documentation lookup
│   │   ├── sequential/           # Multi-step reasoning
│   │   ├── serena/               # Project memory
│   │   └── playwright/           # Browser automation
│   ├── security/                 # Security utilities
│   ├── terminal/                 # Terminal service
│   └── workspace/                # Workspace management
│
├── middleware/                   # Next.js middleware
│   ├── middleware.ts             # Global middleware (auth, rate limit)
│   ├── security-middleware.ts    # Security headers
│   └── quota-middleware.ts       # API quota enforcement
│
└── types/                        # TypeScript type definitions
```

---

## Data Flow

### Request Processing Flow

```mermaid
sequenceDiagram
    participant Client
    participant Middleware
    participant API
    participant Service
    participant Database
    participant External

    Client->>Middleware: HTTP Request
    Middleware->>Middleware: Auth Check
    Middleware->>Middleware: Rate Limit
    Middleware->>Middleware: Security Headers

    Middleware->>API: Validated Request
    API->>Service: Business Logic Call

    par Parallel Operations
        Service->>Database: Query Data
        Service->>External: API Call (if needed)
    end

    Database-->>Service: Query Results
    External-->>Service: API Response

    Service->>Service: Process & Transform
    Service-->>API: Response Data
    API-->>Middleware: HTTP Response
    Middleware-->>Client: Final Response
```

### AI Code Completion Flow

```mermaid
sequenceDiagram
    participant Editor as Monaco Editor
    participant API as /api/code-completion
    participant Service as AI Service
    participant Cache as Redis Cache
    participant AI as AI Provider
    participant Monitor as Datadog

    Editor->>API: Completion Request<br/>(context, cursor position)
    API->>Monitor: Start Trace
    API->>Cache: Check Cache

    alt Cache Hit
        Cache-->>API: Cached Completion
    else Cache Miss
        API->>Service: Generate Completion
        Service->>AI: API Request<br/>(OpenAI/Anthropic)
        AI-->>Service: Completion Response
        Service->>Cache: Store Result
        Service-->>API: Completion
    end

    API->>Monitor: Log Metrics<br/>(latency, tokens, cost)
    API-->>Editor: Completion Suggestions
    Editor->>Editor: Display Inline
```

### Vector Search Flow

```mermaid
sequenceDiagram
    participant User
    participant API as /api/vector-store
    participant Embedding as Embedding Service
    participant Vector as pgvector
    participant Cache as Redis

    User->>API: Search Query<br/>("authentication logic")
    API->>Cache: Check Query Cache

    alt Cache Hit
        Cache-->>API: Cached Results
    else Cache Miss
        API->>Embedding: Generate Query Embedding
        Embedding-->>API: Vector [1536]
        API->>Vector: Similarity Search<br/>(HNSW index)
        Vector-->>API: Top K Results
        API->>Cache: Cache Results (5min TTL)
    end

    API-->>User: Ranked Code Snippets<br/>(with similarity scores)
```

---

## Database Architecture

### PostgreSQL Schema

```mermaid
erDiagram
    User ||--o{ Session : has
    User ||--o{ Workspace : owns
    User ||--o{ Project : creates
    User ||--o{ File : uploads
    User ||--o{ AIRequest : makes
    User ||--o{ RAGChunk : indexes
    User ||--o| UserPreference : configures

    Workspace ||--o{ Project : contains
    Workspace ||--o{ File : stores
    Workspace ||--o{ RAGChunk : has

    Project ||--o{ File : includes
    Project ||--o{ AIRequest : generates
    Project ||--o{ RAGChunk : indexes

    File ||--o{ RAGChunk : chunks

    Upload ||--o{ RAGIngestJob : triggers

    User {
        int id PK
        string email UK
        string name
        string role
        timestamp created_at
    }

    Workspace {
        int id PK
        string name
        int user_id FK
        string workspace_id UK
        string status
        timestamp dbm_last_sample_at
    }

    Project {
        int id PK
        string name
        int user_id FK
        int workspace_id FK
        string language
        string framework
        string status
    }

    File {
        int id PK
        string name
        string path
        text content
        int user_id FK
        int workspace_id FK
        int project_id FK
    }

    RAGChunk {
        int id PK
        text content
        vector embedding
        int file_id FK
        int user_id FK
        int chunk_index
        int token_count
    }

    AIRequest {
        int id PK
        int user_id FK
        string model
        string provider
        int input_tokens
        int output_tokens
        float cost
        string status
    }
```

### Vector Search with pgvector

**HNSW Index Configuration:**
```sql
-- pgvector extension with HNSW index for optimal performance
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE rag_chunks (
  id SERIAL PRIMARY KEY,
  content TEXT NOT NULL,
  embedding vector(1536), -- OpenAI ada-002 dimensions
  file_id INT REFERENCES files(id),
  user_id INT REFERENCES users(id),
  chunk_index INT,
  token_count INT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- HNSW index for fast approximate nearest neighbor search
CREATE INDEX ON rag_chunks USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Similarity search query
SELECT id, content, 1 - (embedding <=> query_vector) AS similarity
FROM rag_chunks
WHERE user_id = $1
ORDER BY embedding <=> query_vector
LIMIT 10;
```

**Index Performance:**
- **Search Speed:** ~10ms for 100K vectors
- **Index Type:** HNSW (Hierarchical Navigable Small World)
- **Metric:** Cosine similarity (vector_cosine_ops)
- **Dimensions:** 1536 (OpenAI text-embedding-ada-002)

### Connection Pooling

**Prisma Configuration:**
```typescript
// Connection pool settings for production
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// Pool sizing: (2 * CPU cores) + effective_spindle_count
// Default: 10 connections per instance
// Max: 100 connections (PostgreSQL default max_connections)
```

**Redis Caching Strategy:**
- **Session Storage:** 7-day TTL, sliding window
- **API Response Cache:** 5-minute TTL for vector search
- **Rate Limiting:** In-memory with Redis fallback
- **Cache Invalidation:** Event-driven on data mutations

---

## Security Architecture

### Authentication & Authorization

```mermaid
graph TB
    subgraph "Auth Providers"
        GitHub[GitHub OAuth]
        Google[Google OAuth]
        SAML[SAML 2.0]
        Local[Email/Password]
    end

    subgraph "Auth Layer"
        NextAuth[NextAuth.js]
        MFA[2FA/TOTP]
        Session[Session Manager]
    end

    subgraph "Authorization"
        RBAC[Role-Based Access Control]
        Quota[API Quota Management]
        RateLimit[Rate Limiter]
    end

    GitHub --> NextAuth
    Google --> NextAuth
    SAML --> NextAuth
    Local --> NextAuth

    NextAuth --> MFA
    NextAuth --> Session

    Session --> RBAC
    RBAC --> Quota
    RBAC --> RateLimit
```

### Security Headers

**Configured in `next.config.mjs` and `middleware.ts`:**

```javascript
// Security headers applied to all responses
{
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'X-XSS-Protection': '1; mode=block',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://cdn.jsdelivr.net",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "connect-src 'self' https://api.openai.com wss:",
    "img-src 'self' data: https: blob:",
    "worker-src 'self' blob:"
  ].join('; ')
}
```

### CORS Configuration

**Dynamic Origin Validation:**
```typescript
// Development: Localhost only
const devOrigins = ['http://localhost:3000', 'http://localhost:8080'];

// Production: Main domain + subdomains
const prodOrigins = [
  'https://vibecode.dev',
  'https://www.vibecode.dev',
  'https://*.vibecode.dev' // Regex validated in middleware
];

// Middleware validates origin and sets specific header (not wildcard)
if (isOriginAllowed(origin)) {
  response.headers.set('Access-Control-Allow-Origin', origin);
  response.headers.set('Access-Control-Allow-Credentials', 'true');
}
```

### Rate Limiting

**In-Memory Rate Limiter:**
```typescript
// Middleware rate limiting configuration
{
  enabled: true,
  maxRequests: 100,        // Requests per window
  windowMs: 60000,         // 1-minute sliding window
  skipStatic: true,        // Skip /_next/* assets
  keyGenerator: (req) => getClientIP(req) // IP-based limiting
}
```

### API Security

- **Authentication:** JWT tokens via NextAuth.js
- **Authorization:** Role-based access control (user, admin)
- **Input Validation:** Zod schemas for request validation
- **Output Sanitization:** DOMPurify for user-generated content
- **SQL Injection Prevention:** Prisma parameterized queries
- **XSS Protection:** CSP headers + input sanitization
- **CSRF Protection:** SameSite cookies + origin validation

---

## Deployment Architecture

### Docker Deployment

```mermaid
graph TB
    subgraph "Docker Compose Stack"
        App[Next.js App<br/>Port 3000]
        DB[PostgreSQL 16<br/>+ pgvector<br/>Port 5432]
        Redis[Redis/Valkey<br/>Port 6379]
        CodeServer[code-server<br/>Port 8080]
    end

    subgraph "Persistent Storage"
        AppData[/app-data]
        DBData[/postgres-data]
        RedisData[/redis-data]
        Workspace[/workspace]
    end

    App --> DB
    App --> Redis
    App --> CodeServer

    App -.-> AppData
    DB -.-> DBData
    Redis -.-> RedisData
    CodeServer -.-> Workspace
```

**Docker Compose Configuration:**
```yaml
services:
  app:
    image: vibecode/webgui:latest
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://postgres:password@db:5432/vibecode
      REDIS_URL: redis://redis:6379
    depends_on:
      - db
      - redis

  db:
    image: pgvector/pgvector:pg16
    volumes:
      - postgres-data:/var/lib/postgresql/data

  redis:
    image: valkey/valkey:7-alpine
    volumes:
      - redis-data:/data
```

### Kubernetes Deployment

```mermaid
graph TB
    subgraph "Ingress Layer"
        Ingress[Nginx Ingress<br/>vibecode.dev]
        TLS[TLS Termination<br/>Let's Encrypt]
    end

    subgraph "Application Layer"
        AppPod1[App Pod 1]
        AppPod2[App Pod 2]
        AppPod3[App Pod 3]
        AppService[Service<br/>ClusterIP]
    end

    subgraph "Data Layer"
        PostgresPod[PostgreSQL<br/>StatefulSet]
        RedisPod[Redis<br/>StatefulSet]
        PVC1[PVC<br/>postgres-data]
        PVC2[PVC<br/>redis-data]
    end

    subgraph "Monitoring"
        Datadog[Datadog Agent<br/>DaemonSet]
    end

    Ingress --> TLS
    TLS --> AppService
    AppService --> AppPod1
    AppService --> AppPod2
    AppService --> AppPod3

    AppPod1 --> PostgresPod
    AppPod2 --> PostgresPod
    AppPod3 --> PostgresPod

    AppPod1 --> RedisPod

    PostgresPod --> PVC1
    RedisPod --> PVC2

    Datadog -.-> AppPod1
    Datadog -.-> AppPod2
    Datadog -.-> AppPod3
    Datadog -.-> PostgresPod
```

**Kubernetes Resources:**

```yaml
# Deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: vibecode-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: vibecode
  template:
    spec:
      containers:
      - name: app
        image: vibecode/webgui:latest
        ports:
        - containerPort: 3000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: url
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "2000m"
        livenessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/readyz
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 5
```

### Cloud Deployment Options

| Platform | Configuration | Notes |
|----------|--------------|-------|
| **Azure AKS** | 3-node cluster (Standard_D4s_v3) | Production deployment with Azure Postgres Flexible Server |
| **Google GKE** | Autopilot or Standard cluster | GKE with CloudSQL for PostgreSQL |
| **AWS EKS** | Fargate or managed nodes | EKS with RDS PostgreSQL |
| **KinD (Local)** | Single-node development cluster | For local testing and development |

---

## AI/ML Integration

### AI Provider Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        Editor[Monaco Editor]
        Chat[Chat Interface]
    end

    subgraph "AI Service Layer"
        Router[AI Router]
        Cache[Response Cache]
        RateLimit[Rate Limiter]
    end

    subgraph "AI Providers"
        OpenAI[OpenAI<br/>GPT-4, GPT-3.5]
        Anthropic[Anthropic<br/>Claude 3.5]
        Google[Google<br/>Gemini]
        Local[Local Models<br/>Ollama]
    end

    subgraph "Vector Search"
        Embedding[Embedding Service<br/>text-embedding-ada-002]
        Vector[pgvector<br/>HNSW Index]
    end

    Editor --> Router
    Chat --> Router

    Router --> Cache
    Router --> RateLimit

    Cache --> OpenAI
    Cache --> Anthropic
    Cache --> Google
    Cache --> Local

    Chat --> Embedding
    Embedding --> Vector
```

### AI Features

#### 1. Code Completion
- **Provider:** OpenAI, Anthropic, or local models
- **Latency:** 50-200ms (cached: 5ms)
- **Context Window:** 2048 tokens
- **Caching:** 5-minute TTL for repeated queries

#### 2. Codebase Chat
- **Vector Search:** Semantic similarity with pgvector
- **RAG Pipeline:** Retrieve → Augment → Generate
- **Context Injection:** Top 10 relevant code snippets
- **Streaming:** Server-sent events for real-time responses

#### 3. Project Generation
- **Template Engine:** Predefined project scaffolds
- **AI Enhancement:** Custom generation from natural language
- **File Structure:** Automatic directory creation
- **Dependency Management:** package.json generation

#### 4. Code Review
- **Static Analysis:** ESLint, TypeScript diagnostics
- **AI Review:** Claude 3.5 for best practices
- **Security Scanning:** Secret detection, vulnerability analysis

### MCP Server Integration

**Model Context Protocol servers provide specialized capabilities:**

```typescript
// MCP Server Architecture
interface MCPServer {
  name: string;
  capabilities: string[];
  transport: 'stdio' | 'http';
}

const mcpServers: MCPServer[] = [
  {
    name: 'context7',
    capabilities: ['documentation', 'library-lookup'],
    transport: 'stdio'
  },
  {
    name: 'sequential',
    capabilities: ['multi-step-reasoning', 'analysis'],
    transport: 'stdio'
  },
  {
    name: 'serena',
    capabilities: ['memory', 'session-persistence'],
    transport: 'stdio'
  }
];
```

---

## Monitoring & Observability

### Datadog Integration

```mermaid
graph TB
    subgraph "Application"
        App[Next.js App]
        API[API Routes]
        DB[PostgreSQL]
    end

    subgraph "Datadog Services"
        APM[APM<br/>Application Performance]
        DBM[DBM<br/>Database Monitoring]
        RUM[RUM<br/>Real User Monitoring]
        Logs[Logs<br/>Centralized Logging]
        Metrics[Metrics<br/>Custom Metrics]
    end

    subgraph "Datadog Agent"
        Agent[Datadog Agent<br/>DaemonSet]
    end

    App --> APM
    API --> APM
    App --> RUM
    App --> Logs
    DB --> DBM
    App --> Metrics

    APM --> Agent
    DBM --> Agent
    RUM -.-> Agent
    Logs --> Agent
    Metrics --> Agent

    Agent --> DatadogCloud[Datadog Cloud]
```

### Instrumentation

**APM (Application Performance Monitoring):**
```typescript
// dd-trace initialization
import tracer from 'dd-trace';

tracer.init({
  service: 'vibecode-webgui',
  env: process.env.DD_ENV || 'production',
  version: process.env.DD_VERSION || '1.0.0',
  logInjection: true,
  profiling: true,
  runtimeMetrics: true
});

// Automatic instrumentation for:
// - HTTP requests (fetch, axios)
// - Database queries (Prisma, pg)
// - Redis operations
// - WebSocket connections
```

**DBM (Database Monitoring):**
```sql
-- Query samples collection
-- Tracks slow queries, execution plans, and resource usage
-- Configured via Datadog Agent with PostgreSQL integration

-- Sample queries tracked:
-- - Slow queries (>100ms)
-- - Lock contention
-- - Connection pool saturation
-- - Vector search performance
```

**RUM (Real User Monitoring):**
```typescript
// Browser-side instrumentation
if (window.DD_RUM) {
  DD_RUM.init({
    applicationId: process.env.NEXT_PUBLIC_DD_APPLICATION_ID,
    clientToken: process.env.NEXT_PUBLIC_DD_CLIENT_TOKEN,
    site: 'datadoghq.com',
    service: 'vibecode-webgui',
    sampleRate: 100,
    trackInteractions: true,
    trackResources: true,
    trackLongTasks: true
  });
}
```

### Key Metrics

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| **API Latency (p95)** | <200ms | >500ms |
| **Error Rate** | <0.1% | >1% |
| **Database Query Time (p95)** | <50ms | >200ms |
| **Vector Search Latency** | <100ms | >500ms |
| **Memory Usage** | <80% | >90% |
| **CPU Usage** | <70% | >85% |
| **Apdex Score** | >0.9 | <0.7 |

### Health Checks

```typescript
// /api/health endpoint
export async function GET() {
  const checks = await Promise.all([
    checkDatabase(),      // PostgreSQL connectivity
    checkRedis(),         // Redis connectivity
    checkVectorDB(),      // pgvector functionality
    checkAIProviders()    // AI API availability
  ]);

  const healthy = checks.every(c => c.status === 'healthy');

  return Response.json({
    status: healthy ? 'healthy' : 'degraded',
    checks,
    timestamp: new Date().toISOString()
  }, {
    status: healthy ? 200 : 503
  });
}
```

---

## Scaling Strategy

### Horizontal Scaling

```mermaid
graph TB
    subgraph "Load Balancer"
        ALB[Application Load Balancer<br/>Auto Scaling Group]
    end

    subgraph "Application Tier"
        App1[App Instance 1]
        App2[App Instance 2]
        AppN[App Instance N]
    end

    subgraph "Shared Services"
        Redis[Redis Cluster<br/>Master + Replicas]
        Postgres[PostgreSQL<br/>Primary + Read Replicas]
    end

    ALB --> App1
    ALB --> App2
    ALB --> AppN

    App1 --> Redis
    App2 --> Redis
    AppN --> Redis

    App1 --> Postgres
    App2 --> Postgres
    AppN --> Postgres
```

### Scaling Dimensions

| Component | Scaling Strategy | Configuration |
|-----------|-----------------|---------------|
| **Next.js App** | Horizontal Pod Autoscaling (HPA) | CPU >70% → Scale up, Min: 3, Max: 20 |
| **PostgreSQL** | Vertical + Read Replicas | Primary: 8 vCPU, 32GB RAM; Replicas: 2-5 |
| **Redis** | Sentinel/Cluster Mode | 3-node cluster with auto-failover |
| **Vector Search** | Database partitioning | Partition by user_id/workspace_id |

### Performance Optimization

**Caching Strategy:**
```typescript
// Multi-tier caching
1. Browser Cache → Static assets (immutable, 1 year)
2. CDN Cache → Public pages (5 minutes)
3. Redis Cache → API responses (1-5 minutes)
4. Application Cache → In-memory (request lifecycle)
```

**Database Optimization:**
```sql
-- Connection pooling
SET max_connections = 200;
SET shared_buffers = '8GB';
SET effective_cache_size = '24GB';

-- Vector search optimization
CREATE INDEX CONCURRENTLY ON rag_chunks
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Query optimization
CREATE INDEX CONCURRENTLY idx_files_user_workspace
ON files(user_id, workspace_id)
WHERE deleted_at IS NULL;
```

---

## Development Workflow

### Local Development

```bash
# Environment setup
git clone https://github.com/ryanmaclean/vibecode-webgui
cd vibecode-webgui
npm install

# Database setup
docker-compose up -d db redis
npx prisma migrate dev
npx prisma generate

# Development server
npm run dev  # Runs on http://localhost:3000
```

### CI/CD Pipeline

```mermaid
graph LR
    Commit[Git Commit] --> Lint[ESLint]
    Lint --> Type[TypeScript Check]
    Type --> Test[Jest Tests]
    Test --> Build[Next.js Build]
    Build --> E2E[Playwright E2E]
    E2E --> Security[Security Scan]
    Security --> Docker[Docker Build]
    Docker --> Registry[Push to Registry]
    Registry --> Deploy[Deploy to K8s]
```

### Testing Strategy

| Test Type | Framework | Coverage Target | Run Time |
|-----------|-----------|-----------------|----------|
| **Unit Tests** | Jest | 80%+ | <2 min |
| **Integration Tests** | Jest + Testcontainers | 70%+ | <5 min |
| **E2E Tests** | Playwright | Critical paths | <10 min |
| **Performance Tests** | Lighthouse | Score >90 | <5 min |
| **Security Tests** | npm audit, Snyk | Zero high/critical | <2 min |

### Code Quality Gates

```yaml
# GitHub Actions quality gates
quality-checks:
  - name: ESLint
    command: npm run lint
    fail-on: error

  - name: TypeScript
    command: npm run type-check
    fail-on: error

  - name: Tests
    command: npm run test
    fail-on: coverage <80%

  - name: Build
    command: npm run build
    fail-on: error
```

---

## Appendix

### Environment Variables

**Required Variables:**
```bash
# Database
DATABASE_URL="postgresql://user:password@host:5432/vibecode"

# Authentication
NEXTAUTH_URL="https://vibecode.dev"
NEXTAUTH_SECRET="<generated-secret>"

# AI Providers (at least one required)
OPENAI_API_KEY="sk-..."
ANTHROPIC_API_KEY="sk-ant-..."
```

**Optional Variables:**
```bash
# Redis/Valkey
REDIS_URL="redis://localhost:6379"

# Monitoring
DD_API_KEY="<datadog-api-key>"
DD_SITE="datadoghq.com"
NEXT_PUBLIC_DD_APPLICATION_ID="<rum-app-id>"
NEXT_PUBLIC_DD_CLIENT_TOKEN="<rum-client-token>"

# Azure (if using Azure services)
AZURE_STORAGE_CONNECTION_STRING="<connection-string>"
```

### API Endpoints Summary

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/health` | GET | System health check |
| `/api/auth/[...nextauth]` | ALL | NextAuth.js authentication |
| `/api/code-completion` | POST | AI code completion |
| `/api/chat/stream` | POST | Streaming chat with AI |
| `/api/vector-store` | POST | Semantic code search |
| `/api/projects` | GET/POST | Project management |
| `/api/workspace` | GET/POST/PUT | Workspace operations |
| `/api/terminal` | WebSocket | Terminal emulation |
| `/api/monitoring/dashboard` | GET | Monitoring metrics |

### Resource Requirements

**Minimum (Development):**
- 4 CPU cores
- 8GB RAM
- 20GB storage

**Recommended (Production):**
- 8 CPU cores
- 32GB RAM
- 100GB SSD storage
- PostgreSQL: 8 vCPU, 32GB RAM
- Redis: 2 vCPU, 4GB RAM

### Support & Documentation

- **Repository:** https://github.com/ryanmaclean/vibecode-webgui
- **Documentation:** `/docs` directory
- **Issues:** GitHub Issues
- **License:** MIT

---

**Document Version:** 1.0
**Last Updated:** 2025-10-01
**Maintainer:** VibeCode Development Team
