# VibeCode Architecture Overview

**Setup Documentation - Understanding the System**

This document provides an architecture overview for developers setting up VibeCode. It explains the system's components, how they interact, and what you need to understand for successful setup and development.

---

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Component Layers](#component-layers)
3. [Deployment Architectures](#deployment-architectures)
4. [Data Flow](#data-flow)
5. [Technology Stack Summary](#technology-stack-summary)
6. [Setup Implications](#setup-implications)

---

## System Architecture

### High-Level Overview

VibeCode is a hybrid desktop/web application with multiple deployment options. The core architecture consists of layered components that work together to provide an AI-powered development environment.

```mermaid
graph TB
    subgraph "Client Layer"
        Desktop[Desktop App<br/>Tauri + Swift]
        Browser[Web Browser<br/>Next.js 15]
        Editor[Monaco Editor<br/>0.53.0]
    end

    subgraph "Application Layer"
        NextJS[Next.js App Router]
        React[React 19]
        API[API Routes]
        Auth[Authentication]
    end

    subgraph "Service Layer"
        AI[AI Services<br/>Multi-Provider]
        Vector[Vector Search<br/>Semantic Code Search]
        Terminal[Terminal Service<br/>node-pty]
        Collab[Collaboration<br/>WebSocket]
    end

    subgraph "Backend Layer"
        VSCode[OpenVSCode Server<br/>Port 8080]
        Gateway[OpenClaw Gateway<br/>Port 18789]
        Proxy[Caddy Proxy<br/>Port 8443]
    end

    subgraph "Infrastructure Layer"
        VM[Ubuntu VM<br/>vfkit/QEMU]
        Docker[Docker Compose]
        K8s[Kubernetes<br/>Kind]
    end

    subgraph "Data Layer"
        Postgres[(PostgreSQL 16<br/>+ pgvector)]
        Cache[(Redis/Valkey)]
        FS[(File System<br/>Workspaces)]
        Keychain[(macOS Keychain<br/>Secrets)]
    end

    Desktop --> NextJS
    Browser --> NextJS
    Editor --> NextJS
    NextJS --> API
    API --> Auth
    API --> AI
    API --> Vector
    API --> Terminal
    API --> Collab
    API --> VSCode
    API --> Gateway
    Auth --> Proxy
    Proxy --> VSCode
    VSCode --> VM
    Gateway --> Docker
    Gateway --> K8s
    AI --> Postgres
    Vector --> Postgres
    Terminal --> FS
    Auth --> Keychain
    NextJS --> Cache

    style Desktop fill:#4A90E2
    style NextJS fill:#61DAFB
    style AI fill:#50C878
    style Postgres fill:#336791
    style VM fill:#FFB347
```

---

## Component Layers

### 1. Client Layer

The client layer provides the user interface and can run in multiple modes:

**Desktop Mode (Recommended)**
- **Tauri Runtime**: Rust-based application framework
- **Swift Integration**: Native macOS features (Touch ID, Keychain)
- **WKWebView**: Renders the web UI with native performance

**Web Mode**
- **Next.js 15**: Modern React framework with App Router
- **Monaco Editor**: VS Code's editor component
- **React 19**: UI rendering with concurrent features

```mermaid
graph LR
    subgraph "Desktop Client"
        Tauri[Tauri App]
        Swift[Swift Auth]
        WebView[WKWebView]
    end

    subgraph "Web Client"
        Browser[Browser]
        Monaco[Monaco Editor]
        React[React UI]
    end

    Tauri --> WebView
    Swift --> Tauri
    WebView --> App[Next.js App]
    Browser --> App
    Monaco --> App
    React --> App

    style Tauri fill:#FFC131
    style Browser fill:#61DAFB
    style App fill:#000000,color:#fff
```

### 2. Application Layer

The application layer handles business logic and routing:

**Components:**
- **Next.js App Router**: File-based routing with server components
- **API Routes**: RESTful endpoints for services
- **Authentication**: JWT + OAuth2 with multiple providers
- **Middleware**: Request validation, rate limiting, security

**Key Patterns:**
- Server-side rendering (SSR) for initial load
- Client-side navigation for SPA experience
- API route handlers for backend operations
- Edge runtime for performance-critical paths

### 3. Service Layer

Services provide specialized functionality:

**AI Services**
```
Multi-Provider Support:
├── OpenAI (GPT-4, GPT-3.5)
├── Anthropic (Claude 3.5 Sonnet, Opus)
├── Google (Gemini Pro, Flash)
├── Groq (Llama 3.1, Mixtral)
└── DeepSeek (DeepSeek-V2)

Features:
├── Code completion (Monacopilot)
├── Chat assistance
├── Code explanation
├── Refactoring suggestions
└── Cost-aware routing
```

**Vector Search**
```
PostgreSQL + pgvector:
├── Embedding generation (OpenAI)
├── HNSW indexing
├── Semantic code search
├── RAG (Retrieval-Augmented Generation)
└── Context-aware completions
```

**Terminal Service**
```
node-pty Integration:
├── Web-based terminal
├── SSH connection support
├── Shell environment
├── Process management
└── PTY emulation
```

**Collaboration**
```
WebSocket-based:
├── Real-time editing
├── Cursor presence
├── Live share
├── Chat integration
└── Session management
```

### 4. Backend Layer

Backend services provide the core IDE and gateway functionality:

```mermaid
graph TD
    subgraph "OpenVSCode Server"
        VSCodeCore[VS Code Core<br/>Monaco Editor]
        Extensions[Extension Host<br/>Open-VSX]
        Language[Language Server<br/>Protocol]
        Debug[Debug Adapter<br/>Protocol]
    end

    subgraph "OpenClaw Gateway"
        Router[Request Router]
        Pool[Connection Pool]
        Load[Load Balancer]
        Health[Health Check]
    end

    subgraph "Caddy Proxy"
        TLS[TLS Termination]
        JWT[JWT Validation]
        OAuth[OAuth2 Flow]
        Upstream[Upstream Routing]
    end

    Client[Client Request] --> Caddy
    Caddy --> TLS
    TLS --> JWT
    JWT --> OAuth
    OAuth --> Upstream
    Upstream --> VSCodeCore
    Upstream --> Router
    Router --> Pool
    Pool --> Health
    VSCodeCore --> Extensions
    Extensions --> Language
    Extensions --> Debug

    style VSCodeCore fill:#E94E77
    style Router fill:#FFB347
    style TLS fill:#50C878
```

### 5. Infrastructure Layer

Infrastructure supports the runtime environment:

**VM Option (Ubuntu via vfkit)**
```
macOS Virtualization Framework:
├── vfkit VM provider
├── Ubuntu 24.04 LTS
├── Network bridge (host ↔ VM)
├── Shared file systems
└── Resource management
```

**Docker Option (Lightweight)**
```
Docker Compose:
├── PostgreSQL container
├── Redis/Valkey container
├── Next.js container
├── Gateway container
└── Network isolation
```

**Kubernetes Option (Production-like)**
```
Kind (Kubernetes in Docker):
├── Multi-node cluster
├── Ingress controller
├── Service mesh (optional)
├── Persistent volumes
└── Resource limits
```

### 6. Data Layer

Data storage and persistence:

```mermaid
graph TB
    subgraph "PostgreSQL 16"
        Users[Users Table]
        Projects[Projects Table]
        Workspaces[Workspaces Table]
        Vectors[rag_chunks Table<br/>vector(1536)]
        Sessions[Sessions Table]
    end

    subgraph "Redis/Valkey"
        SessionCache[Session Cache]
        QueryCache[Query Cache]
        RateLimit[Rate Limiting]
        PubSub[Pub/Sub Channel]
    end

    subgraph "File System"
        WorkspacesFS[~/.vibecode/workspaces/]
        Extensions[~/.vibecode/extensions/]
        Configs[~/.vibecode/config/]
        Logs[~/.vibecode/logs/]
    end

    subgraph "macOS Keychain"
        Tokens[JWT Tokens]
        Secrets[API Keys]
        Passwords[Encrypted Passwords]
    end

    App[Application] --> Users
    App --> Projects
    App --> Workspaces
    App --> Vectors
    App --> Sessions
    App --> SessionCache
    App --> QueryCache
    App --> RateLimit
    App --> PubSub
    App --> WorkspacesFS
    App --> Extensions
    App --> Configs
    App --> Logs
    App --> Tokens
    App --> Secrets
    App --> Passwords

    style Users fill:#336791
    style SessionCache fill:#DC382D
    style WorkspacesFS fill:#FFB347
    style Tokens fill:#50C878
```

---

## Deployment Architectures

### Desktop Mode (Recommended for Development)

```mermaid
graph TB
    subgraph "macOS Host"
        Desktop[VibeCode.app]
        SwiftAuth[Swift Auth Module]
        Keychain[Keychain]
    end

    subgraph "VM (Ubuntu 24.04)"
        Caddy[Caddy Proxy<br/>:8443]
        VSCode[OpenVSCode<br/>:8080]
        Next[Next.js<br/>:3000]
        Postgres[PostgreSQL<br/>:5432]
        Redis[Redis<br/>:6379]
    end

    Desktop --> SwiftAuth
    SwiftAuth --> Keychain
    SwiftAuth --> Caddy
    Caddy --> VSCode
    Caddy --> Next
    Next --> Postgres
    Next --> Redis
    VSCode --> Postgres

    style Desktop fill:#4A90E2
    style Caddy fill:#1F88C7
    style Next fill:#000000,color:#fff
```

**Characteristics:**
- Best native performance
- macOS integration (Touch ID, Keychain)
- VM isolation for backend
- Single-user focused
- Easiest to debug

### Docker Compose Mode

```mermaid
graph TB
    subgraph "Docker Host"
        Browser[Web Browser]
    end

    subgraph "Docker Network"
        Gateway[OpenClaw Gateway<br/>:18789]
        Next[Next.js<br/>:3000]
        Postgres[PostgreSQL<br/>:5432]
        Redis[Redis<br/>:6379]
    end

    Browser --> Gateway
    Gateway --> Next
    Next --> Postgres
    Next --> Redis

    style Gateway fill:#FFB347
    style Next fill:#000000,color:#fff
    style Postgres fill:#336791
```

**Characteristics:**
- Lightweight and fast
- Easy to start/stop
- Container isolation
- Good for testing
- Multi-platform support

### Kubernetes Mode (Kind)

```mermaid
graph TB
    subgraph "Kind Cluster"
        Ingress[Ingress Controller]

        subgraph "Namespace: vibecode"
            NextPod1[Next.js Pod 1]
            NextPod2[Next.js Pod 2]
            GatewayPod[Gateway Pod]
            PostgresPod[PostgreSQL Pod]
            RedisPod[Redis Pod]
        end

        Service[ClusterIP Service]
        PV[Persistent Volumes]
    end

    Browser[Browser] --> Ingress
    Ingress --> Service
    Service --> NextPod1
    Service --> NextPod2
    Service --> GatewayPod
    NextPod1 --> PostgresPod
    NextPod2 --> PostgresPod
    NextPod1 --> RedisPod
    NextPod2 --> RedisPod
    PostgresPod --> PV

    style Ingress fill:#326CE5
    style Service fill:#50C878
    style PV fill:#FFB347
```

**Characteristics:**
- Production-like environment
- Horizontal scaling
- Service discovery
- Resource management
- Complex but powerful

---

## Data Flow

### Request Flow (Desktop Mode)

```mermaid
sequenceDiagram
    participant User
    participant Desktop as VibeCode.app
    participant Auth as Swift Auth
    participant Keychain
    participant Caddy as Caddy Proxy
    participant VSCode as OpenVSCode
    participant Next as Next.js
    participant DB as PostgreSQL

    User->>Desktop: Launch app
    Desktop->>Auth: Initialize
    Auth->>Keychain: Check token
    Keychain-->>Auth: Return JWT
    Auth->>Caddy: Start proxy (JWT validation)
    Caddy->>VSCode: Start OpenVSCode
    Caddy->>Next: Start Next.js
    VSCode-->>Desktop: IDE ready
    Next-->>Desktop: Dashboard ready

    User->>Desktop: Open project
    Desktop->>Next: API: GET /api/projects
    Next->>DB: Query projects
    DB-->>Next: Return projects
    Next-->>Desktop: JSON response
    Desktop-->>User: Display projects

    User->>Desktop: Code completion request
    Desktop->>VSCode: LSP request
    VSCode->>Next: API: POST /api/ai/complete
    Next->>DB: Get context (vector search)
    DB-->>Next: Related code chunks
    Next->>AI[AI Provider]: Generate completion
    AI-->>Next: Completion result
    Next-->>VSCode: Completion response
    VSCode-->>Desktop: Display completion
    Desktop-->>User: Show suggestion
```

### Authentication Flow

```mermaid
sequenceDiagram
    participant User
    participant Swift as Swift Auth Module
    participant Keychain as macOS Keychain
    participant OAuth as OAuth Provider
    participant Caddy as Caddy Proxy
    participant Next as Next.js
    participant DB as PostgreSQL

    User->>Swift: Launch VibeCode
    Swift->>Keychain: Check for stored token

    alt Token exists and valid
        Keychain-->>Swift: Return JWT
        Swift->>Caddy: Configure JWT validation
        Caddy->>Next: Forward authenticated requests
        Next-->>User: Show IDE
    else No token or expired
        Swift->>User: Show login screen

        alt Local Password
            User->>Swift: Enter password + Touch ID
            Swift->>Swift: Generate JWT
            Swift->>Keychain: Store tokens securely
        else OAuth (GitHub/Google/Apple)
            User->>Swift: Select OAuth provider
            Swift->>OAuth: Initiate OAuth flow
            User->>OAuth: Authenticate
            OAuth-->>Swift: Authorization code
            Swift->>OAuth: Exchange for access token
            OAuth-->>Swift: Access + refresh tokens
            Swift->>Swift: Generate internal JWT
            Swift->>Keychain: Store tokens securely
            Swift->>DB: Create/update user session
        end

        Swift->>Caddy: Configure JWT validation
        Caddy->>Next: Forward authenticated requests
        Next-->>User: Show IDE
    end

    loop Token refresh (every 15 min)
        Swift->>Swift: Check token expiry
        alt Token expiring soon
            Swift->>OAuth: Refresh token request
            OAuth-->>Swift: New access token
            Swift->>Keychain: Update stored token
        end
    end
```

### AI Code Completion Flow

```mermaid
sequenceDiagram
    participant Editor as Monaco Editor
    participant Next as Next.js API
    participant Vector as Vector Search
    participant DB as PostgreSQL
    participant AI as AI Provider
    participant Cache as Redis

    Editor->>Next: POST /api/ai/complete<br/>{code, cursor, file}

    Next->>Cache: Check completion cache
    alt Cache hit
        Cache-->>Next: Cached completion
        Next-->>Editor: Return completion
    else Cache miss
        Next->>Vector: Generate query embedding
        Vector->>DB: Vector similarity search<br/>SELECT * FROM rag_chunks<br/>ORDER BY embedding <=> query<br/>LIMIT 5
        DB-->>Vector: Related code chunks
        Vector-->>Next: Context chunks

        Next->>AI: Generate completion<br/>{context, code, cursor}
        AI-->>Next: Completion result

        Next->>Cache: Store completion (15 min TTL)
        Next->>DB: Log AI request (analytics)
        Next-->>Editor: Return completion
    end

    Editor-->>User: Display suggestion
```

---

## Technology Stack Summary

### Core Technologies

| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| **Desktop** | Tauri | 2.x | Native desktop app framework |
| | Swift | 5.x | macOS native integration |
| **Frontend** | Next.js | 15.5.4 | React framework with App Router |
| | React | 19.1.1 | UI library |
| | TypeScript | 5.8.3 | Type safety |
| | Monaco Editor | 0.53.0 | Code editor component |
| **Backend** | Node.js | 18.18.0+ | JavaScript runtime |
| | OpenVSCode Server | Latest | Web-based IDE |
| | Caddy | 2.x | Reverse proxy |
| **Database** | PostgreSQL | 16 | Primary data store |
| | pgvector | Latest | Vector similarity search |
| | Prisma | 6.12.0 | ORM and migrations |
| **Cache** | Redis/Valkey | Latest | In-memory cache |
| | ioredis | 5.7.0 | Redis client |
| **AI/ML** | OpenAI | 4.104.0 | GPT models |
| | Anthropic | Latest | Claude models |
| | Langchain | 0.3.34 | AI orchestration |
| **VM** | vfkit | Latest | macOS Virtualization Framework |
| | QEMU | 8.x | Alternative VM provider |
| **Containers** | Docker | Latest | Containerization |
| | Kind | Latest | Kubernetes in Docker |

### Development Dependencies

```
Testing:
├── Jest (30.0.4) - Unit testing
├── Playwright (1.54.2) - E2E testing
├── Testcontainers (11.3.1) - Integration testing
└── React Testing Library - Component testing

Build Tools:
├── Turbo - Monorepo build system
├── esbuild - Fast bundler
├── SWC - Fast TypeScript compiler
└── PostCSS - CSS processing

Code Quality:
├── ESLint - Linting
├── Prettier - Formatting
├── TypeScript - Type checking
└── Husky - Git hooks
```

---

## Setup Implications

### What You Need to Understand

**For Desktop Development:**
1. **VM Setup**: Ubuntu VM via vfkit needs to be running
2. **Swift Build**: Desktop app requires Xcode and Swift toolchain
3. **Certificates**: Code signing for macOS distribution
4. **Keychain Access**: Requires appropriate entitlements

**For Web Development:**
1. **Database**: PostgreSQL with pgvector extension
2. **Node.js**: Version 18.18.0 or higher
3. **Environment**: `.env` file with required variables
4. **Dependencies**: All npm packages installed

**For Full-Stack Development:**
1. **All of the above** plus:
2. **Docker**: For containerized services
3. **Redis**: For caching layer
4. **AI API Keys**: For AI provider integration

### Key Configuration Files

```
VibeCode Configuration:
├── .env                          # Environment variables
├── .env.local                    # Local overrides
├── next.config.js                # Next.js configuration
├── tsconfig.json                 # TypeScript configuration
├── docker-compose.yml            # Docker services
├── prisma/schema.prisma          # Database schema
├── src-tauri/tauri.conf.json     # Tauri app config
└── platforms/macos/              # macOS-specific code
    ├── VibeCode/                 # Swift app
    └── VibeCodeMenubar/          # Menubar app
```

### Port Allocation

```
Standard Ports:
├── 3000  - Next.js development server
├── 8080  - OpenVSCode Server
├── 8443  - Caddy HTTPS proxy
├── 18789 - OpenClaw Gateway
├── 5432  - PostgreSQL
├── 6379  - Redis/Valkey
└── 9090  - Prometheus metrics (optional)
```

### Data Directories

```
~/.vibecode/
├── workspaces/               # User workspaces
├── extensions/               # VS Code extensions
├── config/                   # User configuration
│   ├── settings.json         # User settings
│   ├── keybindings.json      # Custom keybindings
│   └── snippets/             # Code snippets
├── logs/                     # Application logs
│   ├── app.log               # Main app log
│   ├── vscode.log            # VS Code log
│   └── vm.log                # VM log
├── cache/                    # Cached data
└── db/                       # SQLite databases (dev)
```

---

## Next Steps

After understanding this architecture:

1. **Choose Your Setup Path**:
   - [Desktop Setup](TAURI_DESKTOP_SETUP.md) - Recommended for development
   - [Docker Setup](DOCKER_COMPOSE_SETUP.md) - Lightweight alternative
   - [Kubernetes Setup](KIND_KUBERNETES_SETUP.md) - Production-like environment

2. **Review Specific Guides**:
   - [Getting Started](GETTING_STARTED.md) - Basic setup walkthrough
   - [Apple Virtualization](APPLE_VIRTUALIZATION_SETUP.md) - VM setup details
   - [Troubleshooting](TROUBLESHOOTING_GUIDE.md) - Common issues

3. **Explore the Codebase**:
   - [Full Architecture Docs](../ARCHITECTURE.md) - Comprehensive technical details
   - [Architecture Diagrams](../ARCHITECTURE_DIAGRAM.md) - Detailed flow diagrams
   - [API Documentation](../api/) - API reference

---

**For Questions or Issues:**
- Check the [Troubleshooting Guide](TROUBLESHOOTING_GUIDE.md)
- Review the [Full Architecture Documentation](../ARCHITECTURE.md)
- Open an issue on GitHub
