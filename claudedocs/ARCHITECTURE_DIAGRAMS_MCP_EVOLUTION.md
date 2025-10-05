# Architecture Diagrams: VibeCode MCP Evolution

**Date:** 2025-10-01
**Version:** 1.0
**Status:** Strategic Planning

---

## Current Architecture (As-Is)

```mermaid
graph TB
    subgraph "Clients"
        Browser[Web Browser<br/>Monaco Editor]
        Claude[Claude Code CLI<br/>External MCP Client]
        Windsurf[Windsurf IDE<br/>External MCP Client]
    end

    subgraph "VibeCode Application"
        NextJS[Next.js 15<br/>React 19<br/>SSR/ISR]
        API[API Routes<br/>RESTful + WebSocket]
        MCP[MCP Server<br/>6 Tools<br/>stdio transport]
    end

    subgraph "Services"
        AI[AI Service<br/>OpenAI/Anthropic<br/>Direct API calls]
        Vector[Vector Search<br/>pgvector HNSW<br/>OpenAI embeddings]
        Terminal[Terminal Service<br/>xterm.js + node-pty]
    end

    subgraph "Data"
        Postgres[(PostgreSQL 16<br/>+ pgvector)]
        Redis[(Redis/Valkey<br/>Session + Cache)]
        Blob[(Azure Blob<br/>File Storage)]
    end

    Browser --> NextJS
    NextJS --> API
    API --> AI
    API --> Vector
    API --> Terminal

    Claude -.stdio.-> MCP
    Windsurf -.stdio.-> MCP
    MCP --> API

    AI --> Postgres
    Vector --> Postgres
    NextJS --> Redis
    Terminal --> Blob

    style MCP fill:#f9f,stroke:#333,stroke-width:4px
    style AI fill:#ff9,stroke:#333,stroke-width:2px
    style Vector fill:#9f9,stroke:#333,stroke-width:2px
```

### Current State Analysis

**Strengths:**
- ✅ MCP server exists (ahead of competitors)
- ✅ Monaco editor integrated (VS Code-quality)
- ✅ Vector search with HNSW (fast semantic search)
- ✅ Terminal support (xterm.js)
- ✅ Multi-provider AI (OpenAI + Anthropic)

**Gaps:**
- ❌ Only 6 MCP tools (limited functionality)
- ❌ No CLI interface (web-only)
- ❌ No repository mapping (token-inefficient)
- ❌ Direct API calls (no fallback on failures)
- ❌ LSP not AI-aware (Monaco has LSP but AI doesn't use it)

---

## Target Architecture - Phase 1 (Months 1-3): MCP Foundation

```mermaid
graph TB
    subgraph "Clients"
        Browser[Web Browser<br/>Monaco Editor]
        Claude[Claude Code CLI]
        Windsurf[Windsurf IDE]
    end

    subgraph "VibeCode Application"
        NextJS[Next.js 15<br/>React 19]
        API[Unified API<br/>HTTP + WebSocket]
        EnhancedMCP[Enhanced MCP Server<br/>20+ Tools<br/>stdio + HTTP transports]
    end

    subgraph "Services"
        MultiAI[Multi-Provider Router<br/>OpenAI → Anthropic<br/>→ Google → Local]
        Vector[Vector Search<br/>pgvector + HNSW]
        RepoMap[Repository Map<br/>tree-sitter AST<br/>Symbol extraction]
        Terminal[Terminal Service]
    end

    subgraph "MCP Tools - NEW"
        Filesystem[Filesystem Tools<br/>read/write/list/search]
        Git[Git Tools<br/>commit/diff/status]
        Docker[Docker Tools<br/>build/run/ps/logs]
        K8s[Kubernetes Tools<br/>apply/get/logs]
    end

    subgraph "Data"
        Postgres[(PostgreSQL 16<br/>+ pgvector<br/>+ RepoMap cache)]
        Redis[(Redis/Valkey)]
        Blob[(Azure Blob)]
    end

    Browser --> NextJS
    NextJS --> API
    API --> MultiAI
    API --> Vector
    API --> RepoMap
    API --> Terminal

    Claude -.stdio.-> EnhancedMCP
    Windsurf -.stdio.-> EnhancedMCP
    EnhancedMCP --> API

    EnhancedMCP --> Filesystem
    EnhancedMCP --> Git
    EnhancedMCP --> Docker
    EnhancedMCP --> K8s

    MultiAI --> Postgres
    Vector --> Postgres
    RepoMap --> Postgres
    NextJS --> Redis

    style EnhancedMCP fill:#f9f,stroke:#333,stroke-width:4px
    style MultiAI fill:#ff9,stroke:#333,stroke-width:4px
    style RepoMap fill:#9f9,stroke:#333,stroke-width:4px
    style Filesystem fill:#9ff,stroke:#333,stroke-width:2px
    style Git fill:#9ff,stroke:#333,stroke-width:2px
    style Docker fill:#9ff,stroke:#333,stroke-width:2px
    style K8s fill:#9ff,stroke:#333,stroke-width:2px
```

### Phase 1 Enhancements

**MCP Server (6 → 20+ Tools):**
- **Filesystem:** read_file, write_file, list_directory, search_files
- **Git:** git_status, git_commit, git_diff, git_branch, git_log
- **Docker:** docker_build, docker_run, docker_ps, docker_logs
- **Kubernetes:** kubectl_apply, kubectl_get, kubectl_logs, kubectl_describe
- **Database:** sql_query, schema_inspect, migration_status

**Repository Map:**
- Tree-sitter AST parsing for TypeScript/JavaScript
- Symbol extraction (classes, functions, exports, imports)
- PostgreSQL caching (invalidate on file changes)
- 10x token efficiency improvement

**Multi-Provider Router:**
- Primary: OpenAI GPT-4
- Fallback 1: Anthropic Claude-3.5-Sonnet
- Fallback 2: Google Gemini-2.0
- Fallback 3: Local Ollama models
- Automatic failover, cost tracking

---

## Target Architecture - Phase 2 (Months 4-6): CLI & LSP

```mermaid
graph TB
    subgraph "Clients"
        Browser[Web Browser<br/>Monaco Editor]
        CLI[VibeCode CLI<br/>Terminal UI<br/>Ink framework]
        Claude[Claude Code CLI]
        Windsurf[Windsurf IDE]
    end

    subgraph "VibeCode Application"
        NextJS[Next.js 15<br/>Web App]
        CLIAPP[CLI Application<br/>Node.js + Ink<br/>Rich TUI]
        API[Unified API<br/>HTTP + WebSocket]
        EnhancedMCP[Enhanced MCP Server<br/>20+ Tools]
    end

    subgraph "Services"
        MultiAI[Multi-Provider Router]
        Vector[Vector Search]
        RepoMap[Repository Map]
        LSPContext[LSP Context Provider<br/>Type info<br/>Diagnostics<br/>Definitions]
        GitNative[Git-Native Editor<br/>Auto-commit<br/>Diff view<br/>Rollback]
        Terminal[Terminal Service]
    end

    subgraph "Data"
        Postgres[(PostgreSQL 16<br/>+ pgvector<br/>+ RepoMap cache<br/>+ Session state)]
        Redis[(Redis/Valkey<br/>CLI sessions)]
        Blob[(Azure Blob)]
    end

    Browser --> NextJS
    CLI --> CLIAPP
    Claude -.stdio.-> EnhancedMCP
    Windsurf -.stdio.-> EnhancedMCP

    NextJS --> API
    CLIAPP --> API
    EnhancedMCP --> API

    API --> MultiAI
    API --> Vector
    API --> RepoMap
    API --> LSPContext
    API --> GitNative
    API --> Terminal

    MultiAI --> Postgres
    Vector --> Postgres
    RepoMap --> Postgres
    GitNative --> Postgres
    LSPContext -.Monaco LSP.-> Browser

    NextJS --> Redis
    CLIAPP --> Redis

    style CLI fill:#f99,stroke:#333,stroke-width:4px
    style CLIAPP fill:#f99,stroke:#333,stroke-width:4px
    style LSPContext fill:#9f9,stroke:#333,stroke-width:4px
    style GitNative fill:#9f9,stroke:#333,stroke-width:4px
```

### Phase 2 Enhancements

**VibeCode CLI:**
- **Commands:** `vibe init`, `vibe chat`, `vibe edit`, `vibe test`, `vibe deploy`
- **Terminal UI:** Ink (React for terminals) with rich formatting
- **Authentication:** API keys + OAuth device flow
- **Distribution:** npm package (`@vibecode/cli`)

**LSP-Aware AI Context:**
- Extracts type information from Monaco LSP
- Includes diagnostics (errors, warnings) in AI context
- Symbol resolution for refactoring
- 30% improvement in completion accuracy

**Git-Native Editing:**
- Optional mode: every AI edit is auto-committed
- Visual diff view in Monaco (before/after)
- Easy rollback via "Undo AI Edit" button
- Branch management (create feature branches)

---

## Target Architecture - Phase 3 (Months 7-12): Marketplace & Multi-Agent

```mermaid
graph TB
    subgraph "Clients"
        Browser[Web Browser]
        CLI[VibeCode CLI]
        Claude[Claude Code CLI]
        Windsurf[Windsurf IDE]
        Community[Community Developers<br/>Building MCP servers]
    end

    subgraph "VibeCode Platform"
        NextJS[Next.js 15<br/>Web App]
        CLIAPP[CLI Application]
        Marketplace[MCP Marketplace<br/>Registry + Discovery<br/>One-click install]
        API[Unified API]
        EnhancedMCP[Enhanced MCP Server<br/>20+ Core Tools]
    end

    subgraph "Multi-Agent System"
        Orchestrator[Agent Orchestrator<br/>Supervisor pattern]
        Planner[Planner Agent<br/>Task breakdown]
        Coder[Coder Agent<br/>Implementation]
        Tester[Tester Agent<br/>Test creation]
        Reviewer[Reviewer Agent<br/>Code review]
        Deployer[Deployer Agent<br/>Deployment]
    end

    subgraph "Services"
        MultiAI[Multi-Provider Router]
        Vector[Vector Search]
        RepoMap[Repository Map]
        LSPContext[LSP Context Provider]
        GitNative[Git-Native Editor]
        Terminal[Terminal Service]
    end

    subgraph "Enterprise Features"
        SSO[SSO Integration<br/>Okta, Azure AD]
        RBAC[Role-Based Access Control<br/>MCP tool permissions]
        AuditLog[Audit Logs<br/>All MCP operations]
        Analytics[Usage Analytics<br/>Dashboard]
    end

    subgraph "Data"
        Postgres[(PostgreSQL 16<br/>+ Marketplace data<br/>+ Agent state<br/>+ Audit logs)]
        Redis[(Redis/Valkey<br/>+ Agent memory)]
        Blob[(Azure Blob)]
    end

    Browser --> NextJS
    CLI --> CLIAPP
    Community --> Marketplace
    Claude -.stdio.-> EnhancedMCP
    Windsurf -.stdio.-> EnhancedMCP

    NextJS --> Marketplace
    Marketplace --> API
    API --> Orchestrator

    Orchestrator --> Planner
    Orchestrator --> Coder
    Orchestrator --> Tester
    Orchestrator --> Reviewer
    Orchestrator --> Deployer

    Planner --> MultiAI
    Coder --> MultiAI
    Tester --> MultiAI
    Reviewer --> MultiAI
    Deployer --> MultiAI

    API --> MultiAI
    API --> Vector
    API --> RepoMap
    API --> LSPContext
    API --> GitNative

    API --> SSO
    API --> RBAC
    API --> AuditLog
    API --> Analytics

    MultiAI --> Postgres
    Orchestrator --> Redis
    SSO --> Postgres
    AuditLog --> Postgres

    style Marketplace fill:#f99,stroke:#333,stroke-width:4px
    style Orchestrator fill:#9f9,stroke:#333,stroke-width:4px
    style SSO fill:#ff9,stroke:#333,stroke-width:4px
    style RBAC fill:#ff9,stroke:#333,stroke-width:4px
    style AuditLog fill:#ff9,stroke:#333,stroke-width:4px
```

### Phase 3 Enhancements

**MCP Marketplace:**
- Registry of community MCP servers
- Discovery UI with search, ratings, reviews
- One-click installation
- Developer program with SDK, documentation
- Revenue sharing: 80/20 split (developer/VibeCode)

**Multi-Agent System:**
- **Orchestrator:** Supervisor agent coordinating others
- **Planner:** Breaks down tasks into steps
- **Coder:** Implements code changes
- **Tester:** Writes and runs tests
- **Reviewer:** Code review and suggestions
- **Deployer:** Handles deployment

**Enterprise Features:**
- **SSO:** Okta, Azure AD, Google Workspace
- **RBAC:** Permissions per MCP tool (who can deploy, etc.)
- **Audit Logs:** All MCP tool usage tracked
- **Analytics:** Dashboard with usage metrics
- **On-Premise:** Self-hosted deployment option

---

## MCP Communication Flow

```mermaid
sequenceDiagram
    participant Client as Claude Code CLI
    participant MCP as VibeCode MCP Server
    participant API as VibeCode API
    participant Service as Service Layer
    participant DB as PostgreSQL

    Note over Client,MCP: Stdio JSON-RPC Transport

    Client->>MCP: List available tools
    MCP-->>Client: 20+ tools (filesystem, git, etc.)

    Client->>MCP: Call tool: read_file<br/>{workspaceId, filePath}
    MCP->>API: Authenticate & validate
    API->>Service: Check permissions
    Service->>DB: Get workspace path
    DB-->>Service: Path: /workspaces/ws-123
    Service->>Service: Read file (security check)
    Service-->>API: File content
    API-->>MCP: Response
    MCP-->>Client: {content: "file contents"}

    Note over Client,DB: Repository Map Request

    Client->>MCP: Get resource: vibecode://repository-map/ws-123
    MCP->>API: Request repo map
    API->>DB: Check cache

    alt Cache hit
        DB-->>API: Cached repo map
    else Cache miss
        API->>Service: Generate repo map
        Service->>Service: tree-sitter AST parse
        Service-->>API: Generated map
        API->>DB: Store in cache
    end

    API-->>MCP: Repository map JSON
    MCP-->>Client: {repositoryMap: {...}}

    Note over Client,DB: Multi-Provider AI Request

    Client->>MCP: Call tool: generate-code<br/>{prompt, language}
    MCP->>API: Forward request
    API->>Service: Route to AI provider

    Service->>Service: Try OpenAI GPT-4

    alt OpenAI success
        Service-->>API: AI response
    else OpenAI failure
        Service->>Service: Fallback to Anthropic
        Service-->>API: AI response
    end

    API->>DB: Log usage & cost
    API-->>MCP: Generated code
    MCP-->>Client: {code: "..."}
```

---

## Repository Map Architecture

```mermaid
graph TB
    subgraph "Input"
        Workspace[Workspace Files<br/>TypeScript/JavaScript]
    end

    subgraph "Repository Map Generator"
        TreeSitter[Tree-Sitter Parser<br/>AST generation]
        SymbolExtractor[Symbol Extractor<br/>Classes, functions, exports]
        DependencyGraph[Dependency Analyzer<br/>Import/export relationships]
        MapBuilder[Map Builder<br/>JSON structure]
    end

    subgraph "Caching Layer"
        Cache[PostgreSQL Cache<br/>workspace_id + hash]
        Invalidation[Invalidation Logic<br/>File change detection]
    end

    subgraph "Consumption"
        AI[AI Context<br/>10x token reduction]
        MCP[MCP Resource<br/>vibecode://repository-map]
        WebUI[Web UI Visualization<br/>Interactive tree view]
    end

    Workspace --> TreeSitter
    TreeSitter --> SymbolExtractor
    SymbolExtractor --> DependencyGraph
    DependencyGraph --> MapBuilder

    MapBuilder --> Cache
    Cache --> Invalidation
    Invalidation -.File changes.-> TreeSitter

    Cache --> AI
    Cache --> MCP
    Cache --> WebUI

    style TreeSitter fill:#9f9,stroke:#333,stroke-width:2px
    style Cache fill:#ff9,stroke:#333,stroke-width:2px
    style AI fill:#f99,stroke:#333,stroke-width:2px
```

### Repository Map Example

```json
{
  "workspaceId": "ws-123",
  "generated": "2025-10-01T10:00:00Z",
  "files": [
    {
      "path": "src/components/Editor.tsx",
      "language": "typescript",
      "symbols": [
        {
          "name": "EditorComponent",
          "type": "function",
          "kind": "React.FC",
          "exports": true,
          "dependencies": ["useEditor", "handleCompletion"]
        },
        {
          "name": "useEditor",
          "type": "function",
          "kind": "hook",
          "returns": "Monaco.IStandaloneCodeEditor"
        }
      ]
    },
    {
      "path": "src/lib/ai/completion.ts",
      "language": "typescript",
      "symbols": [
        {
          "name": "getCompletion",
          "type": "function",
          "kind": "async",
          "parameters": ["prompt", "options"],
          "returns": "Promise<string>"
        }
      ],
      "imports": ["openai", "@ai-sdk/openai"]
    }
  ],
  "statistics": {
    "totalFiles": 250,
    "totalSymbols": 1500,
    "languages": ["typescript", "javascript", "css"]
  }
}
```

---

## Multi-Provider Fallback Flow

```mermaid
graph TB
    Start[AI Request] --> Primary[Primary: OpenAI GPT-4]

    Primary -->|Success| Return[Return Response]
    Primary -->|Rate Limit<br/>429| Fallback1
    Primary -->|Server Error<br/>500-599| Fallback1
    Primary -->|Timeout| Fallback1

    Fallback1[Fallback 1: Anthropic<br/>Claude-3.5-Sonnet] -->|Success| Return
    Fallback1 -->|Error| Fallback2

    Fallback2[Fallback 2: Google<br/>Gemini-2.0] -->|Success| Return
    Fallback2 -->|Error| Fallback3

    Fallback3[Fallback 3: Local<br/>Ollama/CodeLlama] -->|Success| Return
    Fallback3 -->|Error| Failed[Return Error<br/>All providers failed]

    Return --> Log[Log Usage & Cost]
    Failed --> Log

    style Primary fill:#9f9,stroke:#333,stroke-width:2px
    style Fallback1 fill:#ff9,stroke:#333,stroke-width:2px
    style Fallback2 fill:#ff9,stroke:#333,stroke-width:2px
    style Fallback3 fill:#f99,stroke:#333,stroke-width:2px
    style Failed fill:#f00,stroke:#333,stroke-width:2px,color:#fff
```

### Multi-Provider Configuration

```typescript
interface ProviderConfig {
  provider: 'openai' | 'anthropic' | 'google' | 'local';
  model: string;
  maxRetries: number;
  timeout: number;
  fallback?: ProviderConfig;
}

const config: ProviderConfig = {
  provider: 'openai',
  model: 'gpt-4',
  maxRetries: 2,
  timeout: 30000,
  fallback: {
    provider: 'anthropic',
    model: 'claude-3-5-sonnet-20241022',
    maxRetries: 2,
    timeout: 30000,
    fallback: {
      provider: 'google',
      model: 'gemini-2.0-flash-exp',
      maxRetries: 2,
      timeout: 30000,
      fallback: {
        provider: 'local',
        model: 'ollama/codellama',
        maxRetries: 1,
        timeout: 60000
      }
    }
  }
};
```

---

## Multi-Agent Workflow

```mermaid
sequenceDiagram
    participant User
    participant Orchestrator as Agent Orchestrator
    participant Planner
    participant Coder
    participant Tester
    participant Reviewer
    participant Deployer
    participant MCP as MCP Tools

    User->>Orchestrator: Request: "Build login feature"

    Orchestrator->>Planner: Plan task
    Planner->>Planner: Break down into steps:<br/>1. UI component<br/>2. API endpoint<br/>3. Tests<br/>4. Deployment
    Planner-->>Orchestrator: Plan with steps

    Orchestrator->>Coder: Step 1: Create UI component
    Coder->>MCP: read_file (template)
    MCP-->>Coder: Template content
    Coder->>Coder: Generate login component
    Coder->>MCP: write_file (LoginForm.tsx)
    MCP-->>Coder: File written
    Coder-->>Orchestrator: UI component created

    Orchestrator->>Coder: Step 2: Create API endpoint
    Coder->>MCP: read_file (API template)
    MCP-->>Coder: Template content
    Coder->>Coder: Generate auth endpoint
    Coder->>MCP: write_file (auth.ts)
    MCP-->>Coder: File written
    Coder-->>Orchestrator: API endpoint created

    Orchestrator->>Tester: Step 3: Create tests
    Tester->>MCP: read_file (LoginForm.tsx)
    MCP-->>Tester: Component code
    Tester->>Tester: Generate test cases
    Tester->>MCP: write_file (LoginForm.test.tsx)
    MCP-->>Tester: Test written
    Tester->>MCP: run-tests (unit)
    MCP-->>Tester: Tests passed ✅
    Tester-->>Orchestrator: Tests created & passed

    Orchestrator->>Reviewer: Step 4: Review code
    Reviewer->>MCP: git_diff
    MCP-->>Reviewer: Changes diff
    Reviewer->>Reviewer: Analyze code quality<br/>Check best practices
    Reviewer-->>Orchestrator: Review: Approved ✅<br/>Suggestions: Add loading state

    Orchestrator->>Coder: Apply review suggestions
    Coder->>MCP: write_file (LoginForm.tsx)
    MCP-->>Coder: Updated
    Coder-->>Orchestrator: Suggestions applied

    Orchestrator->>Deployer: Step 5: Deploy
    Deployer->>MCP: git_commit ("feat: Add login")
    MCP-->>Deployer: Committed
    Deployer->>MCP: deploy-project (staging)
    MCP-->>Deployer: Deployed to staging ✅
    Deployer-->>Orchestrator: Deployment complete

    Orchestrator-->>User: ✅ Login feature complete!<br/>Deployed to staging
```

---

## Data Flow Diagrams

### Code Completion with LSP Context

```mermaid
sequenceDiagram
    participant User as Developer
    participant Monaco as Monaco Editor
    participant LSP as LSP Server
    participant AI as AI Service
    participant RepoMap as Repository Map
    participant Provider as AI Provider

    User->>Monaco: Types code (cursor at line 45)
    Monaco->>LSP: Request type info at cursor
    LSP-->>Monaco: Type: UserProfile, Errors: [...]

    Monaco->>RepoMap: Get repository context
    RepoMap-->>Monaco: Available functions, imports

    Monaco->>AI: Request completion with context:<br/>- Current code<br/>- Type info from LSP<br/>- Repository map<br/>- Diagnostics

    AI->>AI: Build enhanced prompt:<br/>"User has UserProfile type,<br/>current errors: [...],<br/>available functions: [...]"

    AI->>Provider: Generate completion
    Provider-->>AI: Suggestion

    AI->>Monaco: Completion with 30% better accuracy
    Monaco->>User: Display inline suggestion
    User->>Monaco: Accept suggestion
    Monaco->>LSP: Validate new code
    LSP-->>Monaco: No errors ✅
```

### Git-Native Editing

```mermaid
sequenceDiagram
    participant User
    participant Monaco as Monaco Editor
    participant AI as AI Service
    participant Git as Git Service
    participant Diff as Diff Viewer

    User->>Monaco: Request AI edit: "Add error handling"
    Monaco->>AI: Generate edit with context
    AI-->>Monaco: Modified code

    alt Git-Native Mode Enabled
        Monaco->>Git: Auto-commit before edit
        Git-->>Monaco: Commit SHA: abc123
        Monaco->>Monaco: Apply AI edit
        Monaco->>Git: Auto-commit after edit
        Git-->>Monaco: Commit SHA: def456
        Monaco->>Diff: Show diff (abc123 → def456)
        Diff-->>User: Visual before/after

        alt User approves
            User->>Monaco: Keep changes
            Monaco->>Git: Merge to main branch
        else User rejects
            User->>Monaco: Undo AI Edit
            Monaco->>Git: git reset --hard abc123
            Git-->>Monaco: Rolled back ✅
        end
    else Standard Mode
        Monaco->>Monaco: Apply edit directly
        Monaco-->>User: Show changes
    end
```

---

## Deployment Architecture

### Kubernetes Deployment (Production)

```mermaid
graph TB
    subgraph "Ingress Layer"
        Ingress[Nginx Ingress<br/>vibecode.dev]
        TLS[TLS Termination<br/>Let's Encrypt]
    end

    subgraph "Application Pods"
        WebPod1[Next.js Pod 1<br/>Web UI + API]
        WebPod2[Next.js Pod 2]
        WebPod3[Next.js Pod 3]
        CLIPod1[CLI Backend Pod 1<br/>API Gateway]
        CLIPod2[CLI Backend Pod 2]
        MCPPod1[MCP Server Pod 1<br/>Dedicated]
        MCPPod2[MCP Server Pod 2]
    end

    subgraph "Agent Pods"
        OrchestratorPod[Orchestrator Pod]
        CoderPod[Coder Agent Pod]
        TesterPod[Tester Agent Pod]
        ReviewerPod[Reviewer Agent Pod]
    end

    subgraph "Data Layer"
        PostgresPrimary[(PostgreSQL Primary<br/>16 + pgvector)]
        PostgresReplica1[(Read Replica 1)]
        PostgresReplica2[(Read Replica 2)]
        RedisMaster[(Redis Master<br/>Valkey 7)]
        RedisSlave[(Redis Slave)]
    end

    subgraph "Storage"
        PVC1[PVC: Postgres Data]
        PVC2[PVC: Redis Data]
        Blob[(Azure Blob<br/>File Storage)]
    end

    subgraph "Monitoring"
        DatadogAgent[Datadog Agent<br/>DaemonSet]
    end

    Ingress --> TLS
    TLS --> WebPod1
    TLS --> WebPod2
    TLS --> WebPod3
    TLS --> CLIPod1
    TLS --> CLIPod2

    WebPod1 --> MCPPod1
    WebPod2 --> MCPPod1
    WebPod3 --> MCPPod2
    CLIPod1 --> MCPPod2
    CLIPod2 --> MCPPod1

    WebPod1 --> OrchestratorPod
    OrchestratorPod --> CoderPod
    OrchestratorPod --> TesterPod
    OrchestratorPod --> ReviewerPod

    WebPod1 --> PostgresPrimary
    WebPod2 --> PostgresReplica1
    WebPod3 --> PostgresReplica2
    MCPPod1 --> PostgresPrimary
    MCPPod2 --> PostgresPrimary

    WebPod1 --> RedisMaster
    WebPod2 --> RedisMaster
    CLIPod1 --> RedisMaster
    RedisMaster --> RedisSlave

    PostgresPrimary --> PVC1
    RedisMaster --> PVC2
    WebPod1 --> Blob

    DatadogAgent -.-> WebPod1
    DatadogAgent -.-> WebPod2
    DatadogAgent -.-> WebPod3
    DatadogAgent -.-> PostgresPrimary

    style Ingress fill:#9f9,stroke:#333,stroke-width:2px
    style MCPPod1 fill:#f9f,stroke:#333,stroke-width:4px
    style MCPPod2 fill:#f9f,stroke:#333,stroke-width:4px
    style OrchestratorPod fill:#ff9,stroke:#333,stroke-width:3px
```

---

## Technology Stack Evolution

### Current Stack

```
Frontend:
  ├─ Next.js 15 (App Router)
  ├─ React 19
  ├─ Monaco Editor 0.53.0
  ├─ Tailwind CSS 4.0
  └─ xterm.js (Terminal)

Backend:
  ├─ Next.js API Routes
  ├─ Node.js 18-24
  ├─ TypeScript 5.8.3
  └─ MCP SDK 1.18.2

AI:
  ├─ OpenAI SDK
  ├─ Anthropic SDK
  ├─ Vercel AI SDK 5.0
  └─ LangChain 0.3.34

Data:
  ├─ PostgreSQL 16 + pgvector
  ├─ Redis/Valkey 5.8.1
  └─ Azure Blob Storage

DevOps:
  ├─ Docker
  ├─ Kubernetes
  ├─ Helm 3.19.0
  └─ Datadog (APM, DBM, RUM)
```

### Future Stack (Phase 3)

```
Frontend:
  ├─ Next.js 15 (App Router)
  ├─ React 19
  ├─ Monaco Editor 0.53.0 + LSP Client
  ├─ Tailwind CSS 4.0
  └─ xterm.js (Terminal)

CLI:
  ├─ Node.js 18-24
  ├─ TypeScript 5.8.3
  ├─ Ink 5.0 (React for terminals)
  ├─ Commander.js (CLI framework)
  └─ Ora (Progress indicators)

Backend:
  ├─ Next.js API Routes
  ├─ Enhanced MCP Server (20+ tools)
  ├─ Multi-Provider Router (LiteLLM-style)
  ├─ Repository Map Service (tree-sitter)
  └─ Multi-Agent Orchestrator

AI:
  ├─ OpenAI SDK (primary)
  ├─ Anthropic SDK (fallback 1)
  ├─ Google AI SDK (fallback 2)
  ├─ Ollama (local, fallback 3)
  ├─ Vercel AI SDK 5.0 (streaming)
  └─ LangChain 0.3.34 (agents)

Data:
  ├─ PostgreSQL 16 + pgvector + HNSW
  │   ├─ Marketplace data
  │   ├─ Repository map cache
  │   ├─ Agent state
  │   └─ Audit logs
  ├─ Redis/Valkey 5.8.1
  │   ├─ Session management
  │   ├─ CLI state
  │   └─ Agent memory
  └─ Azure Blob Storage

MCP Ecosystem:
  ├─ Core MCP Server (20+ tools)
  ├─ Community MCP Servers (50+)
  ├─ MCP Marketplace Registry
  └─ MCP SDK for developers

Enterprise:
  ├─ SSO (Okta, Azure AD)
  ├─ RBAC (tool permissions)
  ├─ Audit Logs
  ├─ Analytics Dashboard
  └─ On-Premise Support

DevOps:
  ├─ Docker (multi-stage builds)
  ├─ Kubernetes (GKE, EKS, AKS)
  ├─ Helm 3.19.0 (charts)
  ├─ Datadog (full stack monitoring)
  └─ GitHub Actions (CI/CD)
```

---

## Security Architecture

```mermaid
graph TB
    subgraph "External Clients"
        Browser[Web Browser]
        CLI[VibeCode CLI]
        MCPClient[External MCP Clients]
    end

    subgraph "Security Layer"
        WAF[Web Application Firewall]
        RateLimit[Rate Limiter<br/>100 req/min per IP]
        Auth[Authentication Layer<br/>JWT + OAuth]
        RBAC[Role-Based Access Control]
        APIKey[API Key Management]
    end

    subgraph "Application Layer"
        API[API Gateway]
        MCP[MCP Server]
    end

    subgraph "Data Security"
        Encryption[TLS 1.3<br/>At-rest encryption]
        SecretMgmt[Secret Management<br/>Azure Key Vault]
        AuditLog[Audit Logging<br/>All operations tracked]
    end

    Browser --> WAF
    CLI --> WAF
    MCPClient --> APIKey

    WAF --> RateLimit
    RateLimit --> Auth
    Auth --> RBAC
    APIKey --> RBAC

    RBAC --> API
    RBAC --> MCP

    API --> Encryption
    MCP --> Encryption
    API --> SecretMgmt
    API --> AuditLog

    style WAF fill:#f00,stroke:#333,stroke-width:2px,color:#fff
    style Auth fill:#f90,stroke:#333,stroke-width:2px
    style RBAC fill:#f90,stroke:#333,stroke-width:2px
    style Encryption fill:#9f9,stroke:#333,stroke-width:2px
```

---

## Conclusion

These architecture diagrams illustrate VibeCode's evolution from a web-first IDE to a comprehensive MCP-based AI platform with CLI, marketplace, and multi-agent capabilities.

**Key Architectural Principles:**
1. ✅ **Modularity** - Clean separation of concerns (MCP, AI, services)
2. ✅ **Scalability** - Horizontal scaling at every layer
3. ✅ **Security** - Defense-in-depth approach
4. ✅ **Extensibility** - MCP protocol enables ecosystem growth
5. ✅ **Reliability** - Multi-provider fallback, robust error handling

**Critical Success Factors:**
1. Execute Phase 1 flawlessly (MCP tools, repository map)
2. Launch CLI early (capture terminal developer market)
3. Build marketplace before competitors (first-mover advantage)
4. Maintain architectural flexibility (adapt as MCP evolves)

---

**Document Version:** 1.0
**Created:** 2025-10-01
**Author:** System Architect
**Related Documents:**
- Full Analysis: `/claudedocs/AI_TERMINAL_IDE_ECOSYSTEM_ANALYSIS.md`
- Executive Summary: `/claudedocs/EXECUTIVE_SUMMARY_AI_ECOSYSTEM.md`
- GitHub Issue: `/claudedocs/GITHUB_ISSUE_AI_TERMINAL_IDE_ECOSYSTEM.md`
