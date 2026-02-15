# VibeCode Folder Structure

**Version:** 1.0.0
**Last Updated:** 2026-02-14
**Status:** Active

## Table of Contents

1. [Overview](#overview)
2. [Top-Level Structure](#top-level-structure)
3. [Services Directory](#services-directory)
4. [Platforms Directory](#platforms-directory)
5. [Shared Directory](#shared-directory)
6. [Infrastructure Directory](#infrastructure-directory)
7. [Documentation Directory](#documentation-directory)
8. [Tools Directory](#tools-directory)
9. [Configuration Directory](#configuration-directory)
10. [Naming Conventions](#naming-conventions)
11. [Where to Add New Code](#where-to-add-new-code)
12. [Module Boundaries](#module-boundaries)
13. [Migration Guide](#migration-guide)

---

## Overview

VibeCode uses a **modular multi-service architecture** with clear separation of concerns. This structure reduces complexity from 48+ top-level directories to **7 functional groups**, making the codebase easier to navigate, maintain, and scale.

### Design Principles

The folder structure follows these core principles:

1. **Service Isolation** - Services are independently deployable with clear boundaries
2. **Platform Separation** - Platform-specific code isolated from core business logic
3. **DRY (Don't Repeat Yourself)** - Shared code in reusable libraries
4. **Unidirectional Dependencies** - No circular dependencies
5. **Mirror Structure** - Documentation structure matches code structure

### Key Benefits

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Top-level directories | 48 | 7 | **86% reduction** |
| Infrastructure directories | 6 | 1 | **83% reduction** |
| Time to find code | ~10 min | ~2 min | **80% faster** |
| Circular dependencies | 7+ | 0 | **Eliminated** |

**Related Documentation:**
- [Architecture Overview](./ARCHITECTURE.md)
- [Module Boundaries](./MODULE_BOUNDARIES.md)
- [Organization Principles](./design/organization-principles.md)
- [Proposed Structure](./design/proposed-structure.md)

---

## Top-Level Structure

```
vibecode/                         # Root directory
│
├── services/                     # 🎯 Backend Services (independently deployable)
├── platforms/                    # 🖥️ Platform-Specific Implementations
├── shared/                       # 📦 Shared Libraries & Code
├── infrastructure/               # ⚙️ Infrastructure as Code & Deployment
├── docs/                         # 📚 Documentation
├── tools/                        # 🔧 Developer Tools & Utilities
├── config/                       # ⚙️ Configuration
│
├── .github/                      # GitHub Actions and workflows
├── .vscode/                      # VS Code workspace settings
├── .husky/                       # Git hooks
├── .auto-claude/                 # Auto-Claude automation
├── .claude/                      # Claude configuration
│
├── package.json                  # Root package.json (monorepo)
├── tsconfig.json                 # Root TypeScript config
├── turbo.json                    # Turborepo configuration
├── .gitignore                    # Git ignore rules
├── .env.example                  # Environment variables template
├── README.md                     # Project README
└── CONTRIBUTING.md               # Contribution guidelines
```

### Directory Purpose

| Directory | Purpose | Examples |
|-----------|---------|----------|
| **services/** | Backend microservices | API Gateway, AI Gateway, Auth Service |
| **platforms/** | Platform-specific UIs | Web (Next.js), Desktop (Tauri), Mobile (iOS/Android) |
| **shared/** | Reusable libraries | Types, Utils, Components, Contracts |
| **infrastructure/** | IaC and deployment | Terraform, Docker, Kubernetes, Monitoring |
| **docs/** | Documentation | Architecture, ADRs, Guides, Service docs |
| **tools/** | Developer tooling | CLI tools, Scripts, Generators, Plugins |
| **config/** | Centralized config | Base config, Environment-specific, Feature flags |

---

## Services Directory

**Purpose:** Backend services with clear module boundaries and independent deployability.

### Structure

```
services/
├── api-gateway/                 # HTTP/WebSocket API routing
│   ├── src/
│   │   ├── routes/             # API route definitions
│   │   ├── middleware/         # Express/Fastify middleware
│   │   ├── handlers/           # Request handlers
│   │   ├── __tests__/          # Unit tests
│   │   └── index.ts            # Entry point
│   ├── tests/
│   │   ├── integration/        # Integration tests
│   │   └── e2e/                # End-to-end tests
│   ├── package.json            # Service dependencies
│   ├── tsconfig.json           # Service TypeScript config
│   ├── Dockerfile              # Container image
│   ├── .env.example            # Environment template
│   ├── openapi.yml             # OpenAPI specification
│   └── README.md               # Service documentation
│
├── ai-gateway/                  # AI model orchestration
│   ├── src/
│   │   ├── providers/          # AI provider integrations
│   │   │   ├── openai/
│   │   │   ├── anthropic/
│   │   │   └── gemini/
│   │   ├── router/             # Model routing logic
│   │   ├── cache/              # Response caching
│   │   └── queue/              # Rate limiting queue
│   ├── tests/
│   └── README.md
│
├── auth-service/                # Authentication & authorization
│   ├── src/
│   │   ├── strategies/         # Auth strategies (JWT, OAuth)
│   │   ├── middleware/         # Auth middleware
│   │   └── models/             # User/session models
│   ├── prisma/                 # Database schema (if isolated DB)
│   └── README.md
│
├── chat-service/                # Chat functionality
│   ├── src/
│   │   ├── websocket/          # WebSocket handlers
│   │   ├── messages/           # Message processing
│   │   └── threads/            # Conversation threading
│   └── README.md
│
├── webhook-service/             # Webhook event processing
│   ├── src/
│   │   ├── handlers/           # Webhook handlers
│   │   ├── validators/         # Signature validation
│   │   └── queue/              # Event queue
│   └── README.md
│
├── workflow-orchestrator/       # Workflow orchestration (Airflow)
│   ├── dags/                   # Airflow DAG definitions
│   ├── plugins/                # Custom Airflow plugins
│   └── config/                 # Airflow configuration
│
├── background-worker/           # Background job processing
│   ├── src/
│   │   ├── jobs/               # Job definitions
│   │   ├── queue/              # Queue handlers (Bull, Bee)
│   │   └── schedulers/         # Cron schedulers
│   └── README.md
│
└── git-service/                 # Gitea integration
    ├── src/
    │   ├── api/                # Gitea API client
    │   └── webhooks/           # Git webhook handlers
    └── README.md
```

### Service Communication

Services communicate via:
1. **HTTP/REST APIs** - Synchronous request-response
2. **Message Queues** - Asynchronous event-driven (Kafka, RabbitMQ)
3. **Service Mesh** - Advanced networking (future: Istio)

#### Complete Module Dependency Map

This diagram shows all module dependencies across the entire VibeCode architecture with clear service boundaries:

```mermaid
graph TB
    subgraph "Platform Layer"
        WebPlatform[Web Platform<br/>Next.js 15]
        DesktopPlatform[Desktop Platform<br/>Tauri + Rust]
        MobilePlatform[Mobile Platform<br/>iOS/Android]
        CLIPlatform[CLI Platform<br/>Node.js]
    end

    subgraph "API Gateway Layer"
        Gateway[API Gateway<br/>Routes & Middleware]
    end

    subgraph "Service Layer"
        AIGateway[AI Gateway<br/>Model Orchestration]
        AuthService[Auth Service<br/>JWT & OAuth]
        ChatService[Chat Service<br/>WebSocket]
        WebhookService[Webhook Service<br/>Event Processing]
        WorkflowService[Workflow Orchestrator<br/>Airflow DAGs]
        BackgroundWorker[Background Worker<br/>Bull Queue]
        GitService[Git Service<br/>Gitea Integration]
        MCPServer[MCP Server<br/>Claude Integration]
    end

    subgraph "Shared Library Layer"
        Types[Shared Types<br/>@vibecode/types]
        Utils[Shared Utils<br/>@vibecode/utils]
        Contracts[API Contracts<br/>@vibecode/contracts]
        Components[Shared Components<br/>@vibecode/components]
        Middleware[Shared Middleware<br/>@vibecode/middleware]
    end

    subgraph "Infrastructure Layer"
        PostgreSQL[(PostgreSQL 16<br/>+ pgvector)]
        Redis[(Redis/Valkey<br/>Cache)]
        Kafka[(Kafka/RabbitMQ<br/>Message Queue)]
        VectorDB[(Vector DB<br/>Embeddings)]
    end

    %% Platform to Gateway
    WebPlatform --> Gateway
    DesktopPlatform --> Gateway
    MobilePlatform --> Gateway
    CLIPlatform --> Gateway

    %% Gateway to Services
    Gateway --> AIGateway
    Gateway --> AuthService
    Gateway --> ChatService
    Gateway --> WebhookService
    Gateway --> GitService
    Gateway --> MCPServer

    %% Service to Service (via API only, shown as dashed)
    AIGateway -.->|HTTP API| AuthService
    ChatService -.->|HTTP API| AIGateway
    WebhookService -.->|Message Queue| WorkflowService
    BackgroundWorker -.->|Message Queue| WebhookService

    %% Services to Shared Libraries
    AIGateway --> Types
    AIGateway --> Utils
    AIGateway --> Contracts
    AuthService --> Types
    AuthService --> Utils
    ChatService --> Types
    ChatService --> Utils
    ChatService --> Contracts
    WebhookService --> Types
    WebhookService --> Middleware
    WorkflowService --> Types
    BackgroundWorker --> Types
    BackgroundWorker --> Utils
    GitService --> Types
    GitService --> Contracts
    MCPServer --> Types
    MCPServer --> Utils

    %% Platforms to Shared Libraries
    WebPlatform --> Components
    WebPlatform --> Types
    DesktopPlatform --> Components
    DesktopPlatform --> Types
    MobilePlatform --> Types
    CLIPlatform --> Types
    CLIPlatform --> Utils

    %% Services to Infrastructure
    AIGateway --> PostgreSQL
    AIGateway --> Redis
    AIGateway --> VectorDB
    AuthService --> PostgreSQL
    AuthService --> Redis
    ChatService --> PostgreSQL
    ChatService --> Redis
    ChatService --> Kafka
    WebhookService --> Kafka
    WorkflowService --> PostgreSQL
    BackgroundWorker --> Kafka
    BackgroundWorker --> Redis
    GitService --> PostgreSQL
    MCPServer --> PostgreSQL
    MCPServer --> VectorDB

    %% Styling by Layer
    classDef platformStyle fill:#339af0,stroke:#1c7ed6,color:#fff,stroke-width:2px
    classDef gatewayStyle fill:#f03e3e,stroke:#c92a2a,color:#fff,stroke-width:2px
    classDef serviceStyle fill:#ff922b,stroke:#fd7e14,color:#fff,stroke-width:2px
    classDef sharedStyle fill:#37b24d,stroke:#2f9e44,color:#fff,stroke-width:2px
    classDef infraStyle fill:#7950f2,stroke:#6741d9,color:#fff,stroke-width:2px

    class WebPlatform,DesktopPlatform,MobilePlatform,CLIPlatform platformStyle
    class Gateway gatewayStyle
    class AIGateway,AuthService,ChatService,WebhookService,WorkflowService,BackgroundWorker,GitService,MCPServer serviceStyle
    class Types,Utils,Contracts,Components,Middleware sharedStyle
    class PostgreSQL,Redis,Kafka,VectorDB infraStyle
```

**Legend:**
- 🔵 **Blue** = Platform Layer (client applications)
- 🔴 **Red** = API Gateway Layer (routing and middleware)
- 🟠 **Orange** = Service Layer (backend microservices)
- 🟢 **Green** = Shared Library Layer (reusable code)
- 🟣 **Purple** = Infrastructure Layer (databases, caches, queues)
- **Solid lines** = Direct imports allowed
- **Dashed lines** = API calls only (no direct imports)

#### Service-to-Service Communication Patterns

This diagram focuses on how services communicate with each other:

```mermaid
graph LR
    subgraph "Synchronous Communication (HTTP/REST)"
        AIGateway[AI Gateway]
        AuthService[Auth Service]
        ChatService[Chat Service]
        GitService[Git Service]
        MCPServer[MCP Server]
    end

    subgraph "Asynchronous Communication (Message Queue)"
        WebhookService[Webhook Service]
        WorkflowService[Workflow Orchestrator]
        BackgroundWorker[Background Worker]
    end

    subgraph "Message Queue"
        Kafka[(Kafka/RabbitMQ)]
    end

    %% Synchronous patterns
    ChatService -->|POST /api/complete| AIGateway
    AIGateway -->|GET /api/verify| AuthService
    GitService -->|POST /api/validate-token| AuthService
    MCPServer -->|POST /api/chat| ChatService

    %% Asynchronous patterns
    WebhookService -->|Event: webhook.received| Kafka
    Kafka -->|Consume: webhook.received| WorkflowService
    WorkflowService -->|Event: task.completed| Kafka
    Kafka -->|Consume: task.completed| BackgroundWorker
    BackgroundWorker -->|Event: job.finished| Kafka
    Kafka -->|Consume: job.finished| WebhookService

    style AIGateway fill:#ff922b,stroke:#fd7e14,color:#fff
    style AuthService fill:#ff922b,stroke:#fd7e14,color:#fff
    style ChatService fill:#ff922b,stroke:#fd7e14,color:#fff
    style GitService fill:#ff922b,stroke:#fd7e14,color:#fff
    style MCPServer fill:#ff922b,stroke:#fd7e14,color:#fff
    style WebhookService fill:#ff922b,stroke:#fd7e14,color:#fff
    style WorkflowService fill:#ff922b,stroke:#fd7e14,color:#fff
    style BackgroundWorker fill:#ff922b,stroke:#fd7e14,color:#fff
    style Kafka fill:#7950f2,stroke:#6741d9,color:#fff
```

#### Shared Library Dependency Hierarchy

This diagram shows the dependency relationships between shared libraries:

```mermaid
graph TB
    subgraph "Layer 4: Component Library"
        Components[@vibecode/components]
    end

    subgraph "Layer 3: Contract Library"
        Contracts[@vibecode/contracts]
        Middleware[@vibecode/middleware]
    end

    subgraph "Layer 2: Utility Library"
        Utils[@vibecode/utils]
    end

    subgraph "Layer 1: Type Library"
        Types[@vibecode/types]
    end

    %% Dependency hierarchy
    Components --> Contracts
    Components --> Utils
    Components --> Types
    Contracts --> Types
    Middleware --> Types
    Middleware --> Utils
    Utils --> Types

    %% External dependencies
    Services[Services] --> Components
    Services --> Contracts
    Services --> Middleware
    Services --> Utils
    Services --> Types

    Platforms[Platforms] --> Components
    Platforms --> Types

    style Components fill:#37b24d,stroke:#2f9e44,color:#fff
    style Contracts fill:#37b24d,stroke:#2f9e44,color:#fff
    style Middleware fill:#37b24d,stroke:#2f9e44,color:#fff
    style Utils fill:#37b24d,stroke:#2f9e44,color:#fff
    style Types fill:#37b24d,stroke:#2f9e44,color:#fff
    style Services fill:#ff922b,stroke:#fd7e14,color:#fff
    style Platforms fill:#339af0,stroke:#1c7ed6,color:#fff
```

**Key Rules:**
- Lower layers (Types) cannot depend on higher layers (Components)
- Services can use any shared library
- Platforms should primarily use Components and Types
- All shared libraries depend on Types as the foundation

### Service Requirements

Each service MUST:

- ✅ Have independent `package.json` and dependencies
- ✅ Include `README.md` with setup and API documentation
- ✅ Define API contract in `openapi.yml` or equivalent
- ✅ Include `Dockerfile` for containerization
- ✅ Have `.env.example` for configuration
- ✅ Include unit, integration, and e2e tests
- ✅ Be independently deployable

**Do's:**
```typescript
// ✅ Service calling another service via API
const response = await fetch('http://ai-gateway/api/analyze', {
  method: 'POST',
  body: JSON.stringify(data)
})
```

**Don'ts:**
```typescript
// ❌ Service importing from another service
import { analyzeText } from '../../../ai-gateway/src/analyzer'  // WRONG!
```

---

## Platforms Directory

**Purpose:** Platform-specific implementations providing user interfaces and platform integrations.

### Structure

```
platforms/
├── web/                         # Next.js Web Application
│   ├── src/
│   │   ├── app/                # Next.js App Router
│   │   │   ├── (auth)/         # Auth route group
│   │   │   ├── (dashboard)/    # Dashboard route group
│   │   │   ├── api/            # API routes (BFF pattern)
│   │   │   └── layout.tsx
│   │   ├── components/         # Web-specific components
│   │   │   ├── features/       # Feature components
│   │   │   ├── layout/         # Layout components
│   │   │   └── ui/             # UI primitives
│   │   ├── hooks/              # React hooks
│   │   ├── lib/                # Web utilities
│   │   ├── adapters/           # Platform adapters
│   │   └── styles/             # Styles and themes
│   ├── public/                 # Static assets
│   ├── tests/
│   │   ├── unit/
│   │   ├── integration/
│   │   └── e2e/                # Playwright tests
│   ├── package.json
│   ├── next.config.js
│   ├── tailwind.config.js
│   └── README.md
│
├── desktop/
│   ├── tauri/                  # Tauri Desktop Wrapper (Primary)
│   │   ├── src-tauri/          # Rust backend
│   │   │   ├── src/
│   │   │   │   ├── main.rs
│   │   │   │   ├── commands/   # Tauri commands
│   │   │   │   └── menu.rs     # App menu
│   │   │   ├── icons/          # App icons
│   │   │   ├── Cargo.toml
│   │   │   └── tauri.conf.json
│   │   ├── src/                # Frontend (uses web build)
│   │   └── README.md
│   │
│   └── electron/               # Electron Wrapper (Alternative)
│       ├── src/
│       │   ├── main/           # Electron main process
│       │   └── preload/        # Preload scripts
│       └── README.md
│
├── mobile/
│   ├── ios/                    # Native iOS App (Swift)
│   │   ├── VibeCode/
│   │   │   ├── App/            # App delegates
│   │   │   ├── Views/          # SwiftUI views
│   │   │   ├── ViewModels/     # View models
│   │   │   ├── Services/       # API clients
│   │   │   └── Models/         # Data models
│   │   ├── VibeCode.xcodeproj
│   │   └── README.md
│   │
│   └── android/                # Native Android App (Kotlin)
│       ├── app/
│       │   ├── src/
│       │   │   ├── main/
│       │   │   │   ├── java/
│       │   │   │   ├── res/
│       │   │   │   └── AndroidManifest.xml
│       │   └── build.gradle
│       └── README.md
│
├── macos/                       # macOS Menubar App (Swift)
│   ├── VibeCodeMenubar/
│   │   ├── App/
│   │   ├── MenuBar/            # Menubar UI
│   │   ├── Services/           # Background services
│   │   └── Models/
│   ├── VibeCodeMenubar.xcodeproj
│   └── README.md
│
└── cli/                         # Command-Line Interface
    ├── src/
    │   ├── commands/           # CLI commands
    │   │   ├── init.ts
    │   │   ├── deploy.ts
    │   │   └── dev.ts
    │   ├── utils/              # CLI utilities
    │   ├── adapters/           # CLI-specific adapters
    │   └── index.ts
    ├── bin/
    │   └── vibecode            # Executable entry point
    ├── package.json
    └── README.md
```

### Platform Adapter Pattern

All platforms implement standard adapters for cross-platform consistency:

```typescript
// shared/contracts/src/adapters/storage.ts
export interface StorageAdapter {
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<void>
  delete(key: string): Promise<void>
  clear(): Promise<void>
}

// platforms/web/src/adapters/storage-adapter.ts
export class WebStorageAdapter implements StorageAdapter {
  async get(key: string): Promise<string | null> {
    return localStorage.getItem(key)
  }
  // ... implementation
}

// platforms/desktop/tauri/src/adapters/storage-adapter.ts
export class TauriStorageAdapter implements StorageAdapter {
  private store = new Store('.settings.dat')

  async get(key: string): Promise<string | null> {
    return await this.store.get(key)
  }
  // ... implementation
}
```

### Platform Independence

**Core Principle:** Services never depend on platform code.

```
Platform → API Gateway → Services  ✅ CORRECT
Services → Platforms               ❌ FORBIDDEN
```

---

## Shared Directory

**Purpose:** Reusable code shared across services and platforms.

### Structure

```
shared/
├── types/                       # TypeScript Types & Interfaces
│   ├── src/
│   │   ├── api/                # API contract types
│   │   │   ├── requests.ts
│   │   │   ├── responses.ts
│   │   │   └── webhooks.ts
│   │   ├── models/             # Data models
│   │   │   ├── user.ts
│   │   │   ├── chat.ts
│   │   │   └── ai.ts
│   │   ├── common/             # Common types
│   │   │   ├── result.ts       # Result<T, E> type
│   │   │   ├── pagination.ts
│   │   │   └── error.ts
│   │   └── index.ts
│   ├── package.json            # @vibecode/types
│   ├── tsconfig.json
│   └── README.md
│
├── utils/                       # Utility Functions
│   ├── src/
│   │   ├── validation/         # Input validation
│   │   │   ├── email.ts
│   │   │   ├── url.ts
│   │   │   └── schema.ts
│   │   ├── formatting/         # Data formatting
│   │   │   ├── date.ts
│   │   │   ├── currency.ts
│   │   │   └── text.ts
│   │   ├── crypto/             # Cryptographic utilities
│   │   │   ├── hash.ts
│   │   │   ├── encrypt.ts
│   │   │   └── jwt.ts
│   │   ├── string/             # String utilities
│   │   └── array/              # Array utilities
│   ├── package.json            # @vibecode/utils
│   └── README.md
│
├── components/                  # Shared UI Components
│   ├── src/
│   │   ├── atoms/              # Basic components
│   │   │   ├── Button/
│   │   │   ├── Input/
│   │   │   └── Icon/
│   │   ├── molecules/          # Composite components
│   │   │   ├── Form/
│   │   │   ├── Card/
│   │   │   └── Modal/
│   │   ├── organisms/          # Complex components
│   │   │   ├── ChatPanel/
│   │   │   ├── CodeEditor/
│   │   │   └── FileTree/
│   │   └── index.ts
│   ├── package.json            # @vibecode/components
│   └── README.md
│
├── contracts/                   # API Contracts & Schemas
│   ├── openapi/                # OpenAPI specifications
│   │   ├── api-gateway.yaml
│   │   ├── ai-gateway.yaml
│   │   └── auth-service.yaml
│   ├── protobuf/               # Protocol buffer definitions
│   │   └── messages.proto
│   ├── graphql/                # GraphQL schemas
│   │   └── schema.graphql
│   └── README.md
│
├── constants/                   # Application Constants
│   ├── src/
│   │   ├── api.ts              # API constants
│   │   ├── errors.ts           # Error codes
│   │   ├── features.ts         # Feature flags
│   │   └── config.ts           # Config constants
│   ├── package.json            # @vibecode/constants
│   └── README.md
│
└── testing/                     # Shared Test Utilities
    ├── src/
    │   ├── fixtures/           # Test fixtures
    │   ├── mocks/              # Mock implementations
    │   ├── helpers/            # Test helpers
    │   └── setup.ts            # Test setup utilities
    ├── package.json            # @vibecode/testing
    └── README.md
```

### Dependency Hierarchy

Shared libraries have strict dependency levels:

```
Level 1: Foundation (zero dependencies)
  └─ shared/types
  └─ shared/constants

Level 2: Utilities (depends on Level 1)
  └─ shared/utils

Level 3: Contracts (depends on Level 1)
  └─ shared/contracts

Level 4: Components (depends on Level 1 & 2)
  └─ shared/components

Consumers (depend on shared)
  └─ Services
  └─ Platforms
```

**Allowed:**
```typescript
// ✅ Utils depend on Types
import { EmailValidationResult } from '@vibecode/types'

// ✅ Components depend on Types and Utils
import { ButtonProps } from '@vibecode/types'
import { classNames } from '@vibecode/utils'
```

**Forbidden:**
```typescript
// ❌ Types depend on Utils (wrong level)
import { validateEmail } from '@vibecode/utils'  // WRONG!

// ❌ Shared depends on Services
import { AIGateway } from '@vibecode/ai-gateway'  // WRONG!
```

---

## Infrastructure Directory

**Purpose:** Infrastructure as Code, deployment configurations, and observability setup.

### Structure

```
infrastructure/
├── terraform/                   # Terraform IaC
│   ├── modules/                # Reusable Terraform modules
│   │   ├── vpc/
│   │   ├── database/
│   │   ├── kubernetes/
│   │   └── monitoring/
│   ├── environments/           # Environment-specific configs
│   │   ├── development/
│   │   │   ├── main.tf
│   │   │   ├── variables.tf
│   │   │   └── terraform.tfvars
│   │   ├── staging/
│   │   └── production/
│   ├── backend.tf              # Terraform backend config
│   └── README.md
│
├── docker/                      # Docker & Container Configs
│   ├── compose/                # Docker Compose files
│   │   ├── development.yml     # Local development
│   │   ├── testing.yml         # Testing environment
│   │   └── production.yml      # Production-like local
│   ├── images/                 # Custom Docker images
│   │   ├── base/               # Base images
│   │   └── tools/              # Utility images
│   └── README.md
│
├── kubernetes/                  # Kubernetes Manifests
│   ├── base/                   # Base manifests (Kustomize)
│   │   ├── api-gateway/
│   │   ├── ai-gateway/
│   │   └── auth-service/
│   ├── overlays/               # Environment overlays
│   │   ├── development/
│   │   ├── staging/
│   │   └── production/
│   ├── helm/                   # Helm charts
│   │   └── vibecode/
│   │       ├── Chart.yaml
│   │       ├── values.yaml
│   │       └── templates/
│   └── README.md
│
├── azure/                       # Azure-Specific IaC
│   ├── arm-templates/          # ARM templates
│   ├── bicep/                  # Bicep files
│   └── README.md
│
├── monitoring/                  # Observability Configurations
│   ├── prometheus/             # Prometheus configs
│   │   ├── prometheus.yml
│   │   ├── alerts/             # Alert rules
│   │   └── rules/              # Recording rules
│   ├── grafana/                # Grafana dashboards
│   │   ├── dashboards/
│   │   │   ├── api-gateway.json
│   │   │   ├── ai-gateway.json
│   │   │   └── system-overview.json
│   │   └── provisioning/
│   ├── datadog/                # Datadog integrations
│   │   ├── dashboards/
│   │   ├── monitors/
│   │   └── synthetics/
│   └── README.md
│
├── ci-cd/                       # CI/CD Pipeline Configs
│   ├── github-actions/         # GitHub Actions workflows
│   │   ├── build.yml
│   │   ├── test.yml
│   │   ├── deploy.yml
│   │   └── release.yml
│   ├── azure-pipelines/        # Azure DevOps pipelines
│   └── README.md
│
└── scripts/                     # Infrastructure Scripts
    ├── setup/                  # Setup scripts
    │   ├── init-dev.sh
    │   └── install-deps.sh
    ├── deployment/             # Deployment scripts
    │   ├── deploy-service.sh
    │   └── rollback.sh
    ├── maintenance/            # Maintenance scripts
    │   ├── backup.sh
    │   └── restore.sh
    └── README.md
```

### Infrastructure Principles

1. **Infrastructure as Code** - All infrastructure defined in version-controlled code
2. **Environment Parity** - Dev/staging/prod as similar as possible
3. **Immutable Infrastructure** - No manual server changes
4. **Observability First** - Monitoring built-in from start
5. **Disaster Recovery** - Regular backups and restore procedures

---

## Documentation Directory

**Purpose:** Comprehensive documentation mirroring code structure.

### Structure

```
docs/
├── architecture/                # Architecture Documentation
│   ├── ARCHITECTURE.md         # Main architecture overview
│   ├── ADR/                    # Architecture Decision Records
│   │   ├── 001-folder-structure-modularization.md
│   │   ├── 002-service-boundaries.md
│   │   └── template.md
│   ├── diagrams/               # System diagrams
│   │   ├── system-overview.mmd
│   │   ├── service-dependencies.mmd
│   │   └── deployment.mmd
│   └── README.md
│
├── services/                    # Service-Specific Documentation
│   ├── api-gateway/
│   │   ├── README.md           # Service overview
│   │   ├── API.md              # API documentation
│   │   └── RUNBOOK.md          # Operations runbook
│   ├── ai-gateway/
│   ├── auth-service/
│   └── README.md
│
├── platforms/                   # Platform-Specific Documentation
│   ├── web/
│   │   ├── README.md
│   │   ├── SETUP.md
│   │   └── DEPLOYMENT.md
│   ├── desktop/
│   ├── mobile/
│   └── cli/
│
├── guides/                      # How-To Guides
│   ├── getting-started.md      # New developer onboarding
│   ├── adding-new-service.md   # Service creation guide
│   ├── deployment.md           # Deployment procedures
│   ├── testing.md              # Testing guide
│   └── troubleshooting.md      # Common issues
│
├── api/                         # API Documentation
│   ├── rest/                   # REST API docs
│   ├── websocket/              # WebSocket API docs
│   └── graphql/                # GraphQL API docs
│
├── design/                      # Design Documents
│   ├── organization-principles.md
│   ├── proposed-structure.md
│   └── module-boundaries.md
│
├── analysis/                    # Analysis & Audits
│   ├── current-structure-audit.md
│   ├── pain-points.md
│   └── dependency-map.md
│
└── archive/                     # Historical Documentation
    └── consolidated-wiki/
```

### Documentation Principles

1. **Docs as Code** - Documentation versioned with code
2. **Mirror Structure** - Docs structure matches code structure
3. **Living Documentation** - Updated with code changes
4. **Onboarding Focus** - Clear path for new developers

---

## Tools Directory

**Purpose:** Developer tooling, scripts, and utilities.

### Structure

```
tools/
├── cli/                         # Internal CLI Tools
│   ├── src/
│   │   ├── commands/
│   │   │   ├── scaffold-service.ts
│   │   │   ├── generate-docs.ts
│   │   │   └── check-deps.ts
│   │   └── index.ts
│   └── package.json
│
├── scripts/                     # Build & Utility Scripts
│   ├── build/                  # Build scripts
│   │   ├── build-all.sh
│   │   └── build-service.sh
│   ├── dev/                    # Development scripts
│   │   ├── start-dev.sh
│   │   └── reset-db.sh
│   ├── test/                   # Testing scripts
│   │   ├── run-tests.sh
│   │   └── coverage.sh
│   └── utils/                  # Utility scripts
│
├── generators/                  # Code Generators
│   ├── service/                # Service generator
│   ├── component/              # Component generator
│   └── migration/              # Migration generator
│
├── plugins/                     # Development Plugins
│   ├── eslint-custom/          # Custom ESLint rules
│   ├── webpack-custom/         # Custom Webpack plugins
│   └── vite-custom/            # Custom Vite plugins
│
└── extensions/                  # Editor Extensions
    └── vscode/                 # VS Code extensions
        └── vibecode-snippets/
```

---

## Configuration Directory

**Purpose:** Centralized, type-safe configuration.

### Structure

```
config/
├── base/                        # Base Configuration
│   ├── app.ts                  # Application settings
│   ├── features.ts             # Feature flags
│   ├── constants.ts            # Constants
│   └── logging.ts              # Logging config
│
├── environments/                # Environment-Specific Configs
│   ├── development/
│   │   ├── services.ts
│   │   ├── database.ts
│   │   └── api.ts
│   ├── staging/
│   ├── production/
│   └── test/
│
├── services/                    # Service-Specific Configs
│   ├── api-gateway.ts
│   ├── ai-gateway.ts
│   └── auth-service.ts
│
└── platforms/                   # Platform-Specific Configs
    ├── web.ts
    ├── desktop.ts
    └── mobile.ts
```

### Configuration Principles

1. **Type Safety** - All configs TypeScript-validated (use Zod or similar)
2. **Environment Variables** - Secrets from env vars, never committed
3. **Feature Flags** - Gradual feature rollout without code changes
4. **Fail Fast** - Invalid config fails at startup, not runtime

---

## Naming Conventions

### Directory Naming

| Type | Convention | Example |
|------|-----------|---------|
| **Services** | kebab-case | `ai-gateway/`, `auth-service/` |
| **Platforms** | kebab-case | `web/`, `desktop/`, `macos/` |
| **Shared Libraries** | kebab-case | `types/`, `utils/`, `contracts/` |
| **Documentation** | lowercase | `docs/`, `guides/`, `api/` |
| **Hidden Directories** | dot-prefix | `.github/`, `.vscode/`, `.husky/` |

### File Naming

| Type | Convention | Example |
|------|-----------|---------|
| **TypeScript/JavaScript** | kebab-case | `ai-gateway.ts`, `user-service.ts` |
| **React Components** | PascalCase | `ChatPanel.tsx`, `LoginForm.tsx` |
| **Test Files** | match source + suffix | `gateway.test.ts`, `router.spec.ts` |
| **Configuration** | dot-prefix or extension | `.env`, `tsconfig.json` |
| **Major Docs** | UPPERCASE | `README.md`, `API.md`, `RUNBOOK.md` |

### Code Naming

| Type | Convention | Example |
|------|-----------|---------|
| **Classes** | PascalCase | `AIGateway`, `UserService` |
| **Interfaces** | PascalCase | `AIGateway`, `UserRepository` |
| **Functions** | camelCase | `validateEmail()`, `sendMessage()` |
| **Variables** | camelCase | `userId`, `apiKey` |
| **Constants** | UPPER_SNAKE_CASE | `MAX_RETRIES`, `API_BASE_URL` |
| **Enums** | PascalCase (enum), UPPER_SNAKE_CASE (values) | `enum LogLevel { DEBUG, INFO }` |

### Naming Rules

1. **Singular vs Plural**
   - Services: Singular (`auth-service`, not `auth-services`)
   - Collections: Plural (`services/`, `platforms/`, `utils/`)

2. **Abbreviations**
   - Avoid unless widely recognized (`api`, `db`, `ui`)
   - Prefer clarity: `authentication-service` over `auth-svc`

3. **Prefixes/Suffixes**
   - Services: `-service` suffix (e.g., `auth-service`)
   - Tests: `.test.ts` or `.spec.ts` suffix
   - Types: `.types.ts` or `.d.ts` suffix

---

## Where to Add New Code

### Decision Tree

```mermaid
graph TD
    A[What are you adding?]

    A -->|New API endpoint| B[Is it platform-specific?]
    A -->|New UI component| C[Is it shared across platforms?]
    A -->|New utility function| D[Is it used by multiple services?]
    A -->|New service| E[Create new service]
    A -->|Infrastructure config| F[infrastructure/]
    A -->|Documentation| G[docs/]

    B -->|Yes| H[platforms/{platform}/src/app/api/]
    B -->|No| I[services/api-gateway/src/routes/]

    C -->|Yes| J[shared/components/]
    C -->|No| K[platforms/{platform}/src/components/]

    D -->|Yes| L[shared/utils/]
    D -->|No| M[services/{service}/src/utils/]

    E --> N[services/{service-name}/]

    style H fill:#51cf66
    style I fill:#51cf66
    style J fill:#51cf66
    style K fill:#51cf66
    style L fill:#51cf66
    style M fill:#51cf66
    style N fill:#51cf66
    style F fill:#51cf66
    style G fill:#51cf66
```

### Common Scenarios

#### Adding a New API Endpoint

**Platform-specific (BFF pattern):**
```
platforms/web/src/app/api/{endpoint}/route.ts
```

**Service API:**
```
services/api-gateway/src/routes/{endpoint}.ts
```

#### Adding a New UI Component

**Shared across platforms:**
```
shared/components/src/atoms/     # Basic component
shared/components/src/molecules/ # Composite component
shared/components/src/organisms/ # Complex component
```

**Platform-specific:**
```
platforms/web/src/components/
platforms/desktop/src/components/
```

#### Adding a New Service

```
services/{service-name}/
├── src/
│   ├── routes/
│   ├── handlers/
│   ├── __tests__/
│   └── index.ts
├── tests/
├── package.json
├── Dockerfile
├── openapi.yml
└── README.md
```

**See:** [Adding a New Service Guide](./guides/adding-new-service.md)

#### Adding Utility Functions

**Used by multiple services:**
```
shared/utils/src/{category}/{utility}.ts
```

**Service-specific:**
```
services/{service}/src/utils/{utility}.ts
```

#### Adding TypeScript Types

**API contracts (shared):**
```
shared/types/src/api/{type}.ts
```

**Service-specific models:**
```
services/{service}/src/models/{model}.ts
```

#### Adding Tests

**Unit tests (colocated):**
```
{code-directory}/__tests__/{filename}.test.ts
```

**Integration tests:**
```
services/{service}/tests/integration/{test}.integration.test.ts
```

**E2E tests:**
```
platforms/web/tests/e2e/{flow}.e2e.test.ts
```

#### Adding Infrastructure Code

**Terraform:**
```
infrastructure/terraform/modules/{resource}/
infrastructure/terraform/environments/{env}/
```

**Kubernetes:**
```
infrastructure/kubernetes/base/{service}/
infrastructure/kubernetes/overlays/{env}/
```

**Docker:**
```
infrastructure/docker/compose/{env}.yml
infrastructure/docker/images/{image}/
```

**Monitoring:**
```
infrastructure/monitoring/{tool}/{config}
```

#### Adding Documentation

**Architecture decisions:**
```
docs/architecture/ADR/{number}-{title}.md
```

**Service documentation:**
```
docs/services/{service}/README.md
docs/services/{service}/API.md
docs/services/{service}/RUNBOOK.md
```

**Guides:**
```
docs/guides/{guide-name}.md
```

### Service-Specific Feature Locations

This section provides detailed guidance on where to add new features for each service type.

#### API Gateway (`services/api-gateway/`)

| Feature Type | Location | Example |
|-------------|----------|---------|
| **New REST endpoint** | `src/routes/{resource}.ts` | `src/routes/users.ts` |
| **WebSocket handler** | `src/websocket/{handler}.ts` | `src/websocket/chat-handler.ts` |
| **Authentication middleware** | `src/middleware/auth.ts` | JWT verification, session validation |
| **Rate limiting** | `src/middleware/rate-limit.ts` | API throttling logic |
| **Request validation** | `src/middleware/validation.ts` | Schema validation middleware |
| **Response formatting** | `src/handlers/response-formatter.ts` | Standardized API responses |
| **Error handling** | `src/middleware/error-handler.ts` | Global error handling |
| **Logging middleware** | `src/middleware/logger.ts` | Request/response logging |
| **API tests** | `tests/integration/routes/{route}.test.ts` | Route integration tests |

**Example - Adding a new REST endpoint:**
```typescript
// services/api-gateway/src/routes/projects.ts
import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { validateRequest } from '../middleware/validation'

const router = Router()

router.get('/projects', authenticate, async (req, res) => {
  // Implementation
})

export default router
```

#### AI Gateway (`services/ai-gateway/`)

| Feature Type | Location | Example |
|-------------|----------|---------|
| **New AI provider** | `src/providers/{provider}/` | `src/providers/openai/`, `src/providers/anthropic/` |
| **Provider adapter** | `src/providers/{provider}/adapter.ts` | Provider-specific API integration |
| **Model routing logic** | `src/router/model-router.ts` | Route requests to appropriate model |
| **Response caching** | `src/cache/response-cache.ts` | Cache AI responses |
| **Rate limiting queue** | `src/queue/rate-limiter.ts` | Manage API rate limits |
| **Token counting** | `src/utils/token-counter.ts` | Calculate token usage |
| **Streaming handler** | `src/handlers/stream-handler.ts` | Handle streaming responses |
| **Fallback logic** | `src/router/fallback-handler.ts` | Provider failover |
| **Provider tests** | `tests/integration/providers/{provider}.test.ts` | Provider integration tests |

**Example - Adding a new AI provider:**
```typescript
// services/ai-gateway/src/providers/gemini/adapter.ts
import { AIProviderAdapter } from '../../types/provider'

export class GeminiAdapter implements AIProviderAdapter {
  async complete(prompt: string, options: CompletionOptions) {
    // Gemini-specific implementation
  }

  async stream(prompt: string, options: CompletionOptions) {
    // Streaming implementation
  }
}
```

#### Auth Service (`services/auth-service/`)

| Feature Type | Location | Example |
|-------------|----------|---------|
| **New auth strategy** | `src/strategies/{strategy}.ts` | `src/strategies/oauth-github.ts` |
| **JWT handling** | `src/strategies/jwt.ts` | Token generation/validation |
| **Session management** | `src/session/session-manager.ts` | User session handling |
| **User models** | `src/models/user.ts` | User data models |
| **Permission checks** | `src/middleware/permissions.ts` | Role-based access control |
| **Password hashing** | `src/utils/crypto.ts` | Bcrypt/Argon2 hashing |
| **Token refresh** | `src/handlers/refresh-token.ts` | Refresh token logic |
| **MFA handling** | `src/mfa/` | Multi-factor authentication |
| **Auth tests** | `tests/integration/strategies/{strategy}.test.ts` | Strategy integration tests |

**Example - Adding OAuth provider:**
```typescript
// services/auth-service/src/strategies/oauth-google.ts
import { OAuthStrategy } from '../types/strategy'

export class GoogleOAuthStrategy implements OAuthStrategy {
  async authenticate(code: string) {
    // Exchange code for tokens
  }

  async getUserProfile(accessToken: string) {
    // Fetch user profile from Google
  }
}
```

#### Chat Service (`services/chat-service/`)

| Feature Type | Location | Example |
|-------------|----------|---------|
| **WebSocket handlers** | `src/websocket/handlers/{handler}.ts` | `src/websocket/handlers/message-handler.ts` |
| **Message processing** | `src/messages/processor.ts` | Process and validate messages |
| **Thread management** | `src/threads/thread-manager.ts` | Conversation threading |
| **Message storage** | `src/storage/message-store.ts` | Persist messages |
| **Presence tracking** | `src/presence/presence-tracker.ts` | User online/offline status |
| **Typing indicators** | `src/handlers/typing-handler.ts` | Typing status events |
| **Message search** | `src/search/message-search.ts` | Search chat history |
| **File attachments** | `src/attachments/attachment-handler.ts` | Handle file uploads |
| **Chat tests** | `tests/integration/websocket/{handler}.test.ts` | WebSocket integration tests |

**Example - Adding message handler:**
```typescript
// services/chat-service/src/websocket/handlers/reaction-handler.ts
import { WebSocket } from 'ws'

export class ReactionHandler {
  async handleReaction(ws: WebSocket, data: ReactionData) {
    // Validate reaction
    // Store reaction
    // Broadcast to thread participants
  }
}
```

#### Webhook Service (`services/webhook-service/`)

| Feature Type | Location | Example |
|-------------|----------|---------|
| **New webhook handler** | `src/handlers/{source}-handler.ts` | `src/handlers/github-handler.ts` |
| **Signature validation** | `src/validators/{source}-validator.ts` | Verify webhook authenticity |
| **Event processing** | `src/processors/event-processor.ts` | Process webhook events |
| **Event queue** | `src/queue/event-queue.ts` | Queue events for processing |
| **Retry logic** | `src/queue/retry-handler.ts` | Handle failed webhook deliveries |
| **Event transformers** | `src/transformers/{source}-transformer.ts` | Transform events to internal format |
| **Webhook registration** | `src/registration/webhook-manager.ts` | Register/unregister webhooks |
| **Webhook tests** | `tests/integration/handlers/{source}.test.ts` | Handler integration tests |

**Example - Adding webhook handler:**
```typescript
// services/webhook-service/src/handlers/gitlab-handler.ts
import { WebhookHandler } from '../types/handler'

export class GitLabWebhookHandler implements WebhookHandler {
  async validate(signature: string, payload: string) {
    // Validate GitLab signature
  }

  async process(event: GitLabEvent) {
    // Process GitLab webhook event
  }
}
```

#### Background Worker (`services/background-worker/`)

| Feature Type | Location | Example |
|-------------|----------|---------|
| **New job type** | `src/jobs/{job-name}.ts` | `src/jobs/email-job.ts` |
| **Job processor** | `src/processors/{processor}.ts` | Process specific job types |
| **Queue configuration** | `src/queue/queue-config.ts` | Bull/Bee queue setup |
| **Job scheduler** | `src/schedulers/cron-jobs.ts` | Scheduled jobs (cron) |
| **Job retry logic** | `src/queue/retry-strategy.ts` | Job failure retry |
| **Job monitoring** | `src/monitoring/job-monitor.ts` | Track job status |
| **Cleanup jobs** | `src/jobs/cleanup/{cleanup-job}.ts` | Periodic cleanup tasks |
| **Job tests** | `tests/integration/jobs/{job}.test.ts` | Job integration tests |

**Example - Adding background job:**
```typescript
// services/background-worker/src/jobs/export-data-job.ts
import { Job } from 'bull'

export class ExportDataJob {
  async process(job: Job<ExportDataPayload>) {
    const { userId, format } = job.data

    // Generate export
    // Upload to storage
    // Notify user

    return { exportUrl: '...' }
  }
}
```

#### Git Service (`services/git-service/`)

| Feature Type | Location | Example |
|-------------|----------|---------|
| **Gitea API client** | `src/api/gitea-client.ts` | Gitea REST API wrapper |
| **Repository operations** | `src/api/repositories.ts` | Repo CRUD operations |
| **Webhook handlers** | `src/webhooks/handlers/{event}.ts` | Git event handlers |
| **Branch management** | `src/api/branches.ts` | Branch operations |
| **PR operations** | `src/api/pull-requests.ts` | Pull request operations |
| **Git authentication** | `src/auth/git-auth.ts` | Git credential management |
| **Git tests** | `tests/integration/api/{operation}.test.ts` | API integration tests |

**Example - Adding repository operation:**
```typescript
// services/git-service/src/api/tags.ts
import { GiteaClient } from './gitea-client'

export class TagOperations {
  constructor(private client: GiteaClient) {}

  async createTag(repo: string, tag: TagData) {
    return this.client.post(`/repos/${repo}/tags`, tag)
  }

  async getTags(repo: string) {
    return this.client.get(`/repos/${repo}/tags`)
  }
}
```

#### Workflow Orchestrator (`services/workflow-orchestrator/`)

| Feature Type | Location | Example |
|-------------|----------|---------|
| **New DAG** | `dags/{workflow-name}.py` | `dags/data-pipeline.py` |
| **Custom operators** | `plugins/operators/{operator}.py` | Custom Airflow operators |
| **Custom sensors** | `plugins/sensors/{sensor}.py` | Custom Airflow sensors |
| **Task callbacks** | `dags/callbacks/{callback}.py` | Success/failure callbacks |
| **DAG configuration** | `config/dags/{dag}.yaml` | DAG-specific config |
| **Workflow tests** | `tests/dags/test_{dag}.py` | DAG unit tests |

**Example - Adding Airflow DAG:**
```python
# services/workflow-orchestrator/dags/model-training.py
from airflow import DAG
from airflow.operators.python import PythonOperator
from datetime import datetime

dag = DAG(
    'model_training',
    start_date=datetime(2026, 1, 1),
    schedule_interval='@daily'
)

def train_model():
    # Training logic
    pass

train_task = PythonOperator(
    task_id='train',
    python_callable=train_model,
    dag=dag
)
```

### Platform-Specific Feature Locations

#### Web Platform (`platforms/web/`)

| Feature Type | Location | Example |
|-------------|----------|---------|
| **New page route** | `src/app/{route}/page.tsx` | `src/app/dashboard/page.tsx` |
| **API route (BFF)** | `src/app/api/{endpoint}/route.ts` | `src/app/api/users/route.ts` |
| **Shared component** | `src/components/features/{feature}/` | `src/components/features/chat/` |
| **Layout component** | `src/components/layout/{component}.tsx` | `src/components/layout/Sidebar.tsx` |
| **UI primitive** | `src/components/ui/{component}.tsx` | `src/components/ui/Button.tsx` |
| **React hook** | `src/hooks/use{hook}.ts` | `src/hooks/useAuth.ts` |
| **Client utility** | `src/lib/{utility}.ts` | `src/lib/api-client.ts` |
| **Platform adapter** | `src/adapters/{adapter}.ts` | `src/adapters/storage-adapter.ts` |
| **Styles** | `src/styles/{file}.css` | `src/styles/globals.css` |
| **E2E tests** | `tests/e2e/{flow}.spec.ts` | `tests/e2e/login-flow.spec.ts` |

**Example - Adding Next.js page:**
```typescript
// platforms/web/src/app/projects/page.tsx
import { ProjectList } from '@/components/features/projects/ProjectList'

export default async function ProjectsPage() {
  return (
    <div className="container">
      <h1>Projects</h1>
      <ProjectList />
    </div>
  )
}
```

#### Desktop Platform (`platforms/desktop/tauri/`)

| Feature Type | Location | Example |
|-------------|----------|---------|
| **Tauri command** | `src-tauri/src/commands/{command}.rs` | `src-tauri/src/commands/file.rs` |
| **App menu** | `src-tauri/src/menu.rs` | Application menu configuration |
| **System tray** | `src-tauri/src/tray.rs` | System tray integration |
| **Native integration** | `src-tauri/src/native/{integration}.rs` | OS-specific features |
| **Frontend (uses web)** | `src/` | Symlink to `platforms/web/src/` |

**Example - Adding Tauri command:**
```rust
// platforms/desktop/tauri/src-tauri/src/commands/file.rs
#[tauri::command]
pub async fn read_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(path)
        .map_err(|e| e.to_string())
}
```

#### Mobile Platform (`platforms/mobile/`)

| Feature Type | Location (iOS) | Location (Android) |
|-------------|----------------|-------------------|
| **New screen** | `ios/VibeCode/Views/{Screen}.swift` | `android/app/src/main/java/views/{Screen}.kt` |
| **View model** | `ios/VibeCode/ViewModels/{ViewModel}.swift` | `android/app/src/main/java/viewmodels/{ViewModel}.kt` |
| **API service** | `ios/VibeCode/Services/API/{Service}.swift` | `android/app/src/main/java/services/{Service}.kt` |
| **Data model** | `ios/VibeCode/Models/{Model}.swift` | `android/app/src/main/java/models/{Model}.kt` |

#### CLI Platform (`platforms/cli/`)

| Feature Type | Location | Example |
|-------------|----------|---------|
| **New command** | `src/commands/{command}.ts` | `src/commands/deploy.ts` |
| **CLI utility** | `src/utils/{utility}.ts` | `src/utils/prompt.ts` |
| **CLI adapter** | `src/adapters/{adapter}.ts` | `src/adapters/config-adapter.ts` |

**Example - Adding CLI command:**
```typescript
// platforms/cli/src/commands/status.ts
import { Command } from 'commander'

export const statusCommand = new Command('status')
  .description('Show service status')
  .action(async () => {
    // Check service health
    // Display status table
  })
```

### Quick Reference: Feature Type → Location

| Feature | Location |
|---------|----------|
| **REST API endpoint** | `services/api-gateway/src/routes/` |
| **WebSocket handler** | `services/chat-service/src/websocket/handlers/` |
| **AI provider integration** | `services/ai-gateway/src/providers/{provider}/` |
| **Auth strategy** | `services/auth-service/src/strategies/` |
| **Webhook handler** | `services/webhook-service/src/handlers/` |
| **Background job** | `services/background-worker/src/jobs/` |
| **Airflow DAG** | `services/workflow-orchestrator/dags/` |
| **Git operation** | `services/git-service/src/api/` |
| **Next.js page** | `platforms/web/src/app/{route}/page.tsx` |
| **Next.js API route** | `platforms/web/src/app/api/{endpoint}/route.ts` |
| **Shared React component** | `shared/components/src/` |
| **Platform-specific component** | `platforms/{platform}/src/components/` |
| **Tauri command** | `platforms/desktop/tauri/src-tauri/src/commands/` |
| **CLI command** | `platforms/cli/src/commands/` |
| **Shared TypeScript type** | `shared/types/src/` |
| **Shared utility** | `shared/utils/src/` |
| **Terraform module** | `infrastructure/terraform/modules/` |
| **Kubernetes manifest** | `infrastructure/kubernetes/base/{service}/` |
| **Docker Compose** | `infrastructure/docker/compose/` |
| **Monitoring dashboard** | `infrastructure/monitoring/{tool}/dashboards/` |
| **Architecture doc** | `docs/architecture/` |
| **Service doc** | `docs/services/{service}/` |
| **Guide** | `docs/guides/` |

---

## Module Boundaries

### Dependency Rules

```mermaid
graph TB
    L1[Layer 1: Platforms<br/>Web, Desktop, Mobile, CLI]
    L2[Layer 2: API Gateway<br/>HTTP/WebSocket API]
    L3[Layer 3: Services<br/>AI, Auth, Chat, Webhook]
    L4[Layer 4: Shared Libraries<br/>Types, Utils, Contracts]
    L5[Layer 5: Infrastructure<br/>Database, Cache, Queue]

    L1 --> L2
    L2 --> L3
    L3 --> L5
    L1 --> L4
    L2 --> L4
    L3 --> L4

    style L5 fill:#228be6
    style L4 fill:#51cf66
    style L3 fill:#fab005
    style L2 fill:#fa5252
    style L1 fill:#e64980
```

### Allowed Dependencies

| Layer | Can Depend On | Cannot Depend On |
|-------|---------------|------------------|
| **Platforms** | API Gateway, Shared Libraries | Services directly, other Platforms |
| **API Gateway** | Services, Shared Libraries | Platforms |
| **Services** | Shared Libraries, Infrastructure | Other Services (except via API), Platforms, Gateway |
| **Shared Libraries** | Infrastructure (minimal) | Services, Platforms, Gateway |
| **Infrastructure** | Nothing | Everything |

### Core Rules

1. **No Circular Dependencies** - Dependencies form a DAG (Directed Acyclic Graph)
2. **Service Isolation** - Services communicate via APIs, not direct imports
3. **Platform Independence** - Core services never depend on platform code
4. **Shared Library Constraints** - Shared libraries have minimal dependencies

**For complete details, see:** [Module Boundaries](./MODULE_BOUNDARIES.md)

---

## Migration Guide

### From Current Structure to Modular Structure

| Current Directory | Proposed Location | Rationale |
|------------------|-------------------|-----------|
| `src/` | `platforms/web/src/` | Web platform code |
| `server/` | `services/api-gateway/` | Backend API service |
| `packages/` | `shared/` | Shared libraries |
| `types/` | `shared/types/` | Shared types |
| `infrastructure/`, `infra/`, `deploy/` | `infrastructure/` | Consolidate IaC |
| `docker/` | `infrastructure/docker/` | Container configs |
| `azure/` | `infrastructure/azure/` | Azure IaC |
| `monitoring/` | `infrastructure/monitoring/` | Observability |
| `airflow/` | `services/workflow-orchestrator/` | Workflow service |
| `daemon/` | `services/background-worker/` | Background service |
| `gitea/` | `services/git-service/` | Git service |
| `swift/` | `platforms/macos/` | macOS menubar app |
| `scripts/` | `tools/scripts/` | Build scripts |
| `docs/` | `docs/` | Documentation (reorganized) |

### Migration Steps

1. **Phase 1: Foundation** - Create new directory structure, set up monorepo tooling
2. **Phase 2: Services** - Migrate backend services to `services/`
3. **Phase 3: Platforms** - Move platform code to `platforms/`
4. **Phase 4: Shared** - Extract shared code to `shared/`
5. **Phase 5: Infrastructure** - Consolidate IaC into `infrastructure/`
6. **Phase 6: Cleanup** - Remove old directories, update docs

**For detailed migration plan, see:** [Proposed Structure](./design/proposed-structure.md)

---

## Summary

The VibeCode folder structure provides:

✅ **Clear organization** - 7 top-level directories vs. 48
✅ **Service isolation** - Independent, deployable services
✅ **Platform separation** - Platform-specific code isolated
✅ **Shared libraries** - Reusable code without duplication
✅ **Module boundaries** - No circular dependencies
✅ **Scalability** - Easy to add new services/platforms
✅ **Developer experience** - Fast onboarding, clear guidelines

### Key Takeaways

1. **Services** are independently deployable units in `services/`
2. **Platforms** provide UIs in `platforms/` and never mix with core logic
3. **Shared** libraries eliminate code duplication in `shared/`
4. **Infrastructure** is centralized in `infrastructure/`
5. **Documentation** mirrors code structure in `docs/`
6. **Dependencies** flow in one direction only (no circles)

---

## Related Documentation

- **[Architecture Overview](./ARCHITECTURE.md)** - System architecture and technology stack
- **[Module Boundaries](./MODULE_BOUNDARIES.md)** - Detailed dependency rules and contracts
- **[Organization Principles](./design/organization-principles.md)** - Core design principles
- **[Proposed Structure](./design/proposed-structure.md)** - Detailed structure design
- **[Getting Started Guide](./guides/getting-started.md)** - New developer onboarding
- **[Adding a New Service](./guides/adding-new-service.md)** - Service creation guide

---

**Document Version:** 1.0.0
**Last Updated:** 2026-02-14
**Status:** Active
**Owner:** Architecture Team
**Review Cycle:** Quarterly or as needed
