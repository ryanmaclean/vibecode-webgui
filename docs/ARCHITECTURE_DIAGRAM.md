# VibeCode System Architecture
**Complete System Architecture with Mermaid Diagrams**

**Version:** 2.0
**Date:** February 28, 2026
**Status:** Production-Ready with Agent Orchestration

---

## Table of Contents

1. [High-Level Architecture](#high-level-architecture)
2. [Component Architecture](#component-architecture)
3. [Agent Orchestration System](#agent-orchestration-system)
4. [Authentication Flow](#authentication-flow)
5. [Data Flow](#data-flow)
6. [Deployment Models](#deployment-models)
7. [Technology Stack](#technology-stack)
8. [Integration Points](#integration-points)

---

## High-Level Architecture

### System Overview

```mermaid
graph TB
    subgraph "Desktop App Layer"
        A[VibeCode.app<br/>Swift 5 + Tauri]
        B[WKWebView<br/>webkit Renderer]
        C[Swift Auth Module<br/>Touch ID + JWT]
    end

    subgraph "Backend Services Layer"
        D[Caddy Reverse Proxy<br/>TLS + OAuth + JWT]
        E[OpenVSCode Server<br/>Rust CLI + Node.js]
        F[VM Manager<br/>Virtualization Framework]
    end

    subgraph "Infrastructure Layer"
        G[vfkit<br/>VM Provider]
        H[QEMU<br/>Alternative VM]
        I[Lima<br/>Experimental]
    end

    subgraph "Data Layer"
        J[macOS Keychain<br/>Secure Token Storage]
        K[PostgreSQL<br/>Session Metadata]
        L[File System<br/>Workspace Storage]
    end

    A --> B
    A --> C
    C --> D
    D --> E
    E --> F
    F --> G
    F --> H
    F --> I
    C --> J
    D --> K
    E --> L

    style A fill:#4A90E2
    style E fill:#E94E77
    style C fill:#50C878
    style F fill:#FFB347
```

---

## Component Architecture

### Full System Stack

```mermaid
graph TD
    subgraph "Client Layer"
        UI[React Dashboard<br/>Workspace Management]
        AUTH[Swift Auth Module<br/>Biometric + OAuth]
        WEBKIT[WKWebView<br/>IDE Renderer]
    end

    subgraph "Application Layer"
        TAURI[Tauri Runtime<br/>Rust + Swift Bridge]
        FFI[Swift-Rust FFI<br/>Native Integration]
    end

    subgraph "Security Layer"
        CADDY[Caddy Proxy<br/>Port 8443 HTTPS]
        JWT[JWT Validator<br/>Token Verification]
        OAUTH[OAuth Coordinator<br/>GitHub/Google/Apple]
    end

    subgraph "IDE Layer"
        VSCODE[OpenVSCode Server<br/>Port 8080 HTTP]
        RUSTCLI[Rust CLI<br/>Native Binary]
        NODEJS[Node.js Runtime<br/>Monaco Editor]
    end

    subgraph "Virtualization Layer"
        VMAPI[VM Manager API<br/>Swift/Rust]
        VFKIT[vfkit<br/>Virtualization.framework]
        NETWORK[Network Bridge<br/>Host ↔ VM]
    end

    subgraph "Storage Layer"
        KEYCHAIN[macOS Keychain<br/>Tokens + Secrets]
        WORKSPACES[Workspaces<br/>~/.vibecode/]
        EXTENSIONS[Extensions<br/>Open-VSX]
    end

    UI --> TAURI
    AUTH --> TAURI
    WEBKIT --> TAURI
    TAURI --> FFI
    FFI --> CADDY
    AUTH --> JWT
    AUTH --> OAUTH
    JWT --> CADDY
    OAUTH --> CADDY
    CADDY --> VSCODE
    VSCODE --> RUSTCLI
    VSCODE --> NODEJS
    VSCODE --> VMAPI
    VMAPI --> VFKIT
    VFKIT --> NETWORK
    AUTH --> KEYCHAIN
    VSCODE --> WORKSPACES
    VSCODE --> EXTENSIONS

    style UI fill:#61DAFB
    style VSCODE fill:#E94E77
    style CADDY fill:#1F88C7
    style VFKIT fill:#FFB347
    style KEYCHAIN fill:#50C878
```

---

## Agent Orchestration System

### Multi-Agent Framework Overview

```mermaid
graph TB
    subgraph "Agent Orchestration Layer"
        COORD[.agents/ Coordinator<br/>Multi-Agent Planning]
        AUTOCL[.auto-claude/<br/>Task Automation]
        KAFKA[Kafka Event Bus<br/>Agent Communication]
    end

    subgraph "Agent Framework"
        BASE[Base Agent Class<br/>TypeScript Core]
        MEMORY[Agent Memory<br/>PostgreSQL + pgvector]
        TOOLS[Tool Registry<br/>Unified Tools]
    end

    subgraph "Execution Environment"
        WORKERS[Worker Pool<br/>Parallel Execution]
        WORKTREE[Git Worktrees<br/>Isolated Branches]
        SANDBOX[Sandbox Runtime<br/>Security Isolation]
    end

    subgraph "Communication Layer"
        EVENTS[Event System<br/>Kafka Topics]
        MESSAGES[Message Queue<br/>Inter-Agent]
        API[Agent API<br/>REST + WebSocket]
    end

    subgraph "Storage Layer"
        PG[(PostgreSQL<br/>Memory + State)]
        REDIS[(Redis/Valkey<br/>Cache)]
        FS[File System<br/>Artifacts]
    end

    COORD --> BASE
    AUTOCL --> WORKERS
    KAFKA --> EVENTS
    BASE --> MEMORY
    BASE --> TOOLS
    WORKERS --> WORKTREE
    WORKERS --> SANDBOX
    EVENTS --> MESSAGES
    MESSAGES --> API
    MEMORY --> PG
    TOOLS --> REDIS
    WORKTREE --> FS

    style COORD fill:#E94E77
    style AUTOCL fill:#50C878
    style KAFKA fill:#FFB347
    style BASE fill:#4A90E2
```

### Agent Coordination Workflow

```mermaid
sequenceDiagram
    participant PM as Project Manager
    participant COORD as Coordination Agent
    participant A1 as Agent 1
    participant A2 as Agent 2
    participant A3 as Agent 3
    participant GIT as Git Repository
    participant KAFKA as Kafka Bus

    PM->>COORD: Define project goals
    COORD->>COORD: Decompose into tasks
    COORD->>COORD: Analyze dependencies
    COORD->>COORD: Create .agents/COORDINATION.md

    COORD->>KAFKA: Publish task assignments
    KAFKA->>A1: Task 1 (no dependencies)
    KAFKA->>A2: Task 2 (no dependencies)

    par Phase 1: Parallel Execution
        A1->>A1: Execute in isolated worktree
        A1->>GIT: Commit to branch
        A1->>KAFKA: Publish completion
        and
        A2->>A2: Execute in isolated worktree
        A2->>GIT: Commit to branch
        A2->>KAFKA: Publish completion
    end

    KAFKA->>COORD: Tasks 1 & 2 complete
    COORD->>A3: Task 3 (depends on 1 & 2)
    A3->>A3: Execute task
    A3->>GIT: Commit results
    A3->>KAFKA: Publish completion

    KAFKA->>COORD: All tasks complete
    COORD->>PM: Project complete
```

### Auto-Claude Task Execution

```mermaid
graph TB
    subgraph "Task Specification"
        SPEC[spec.md<br/>Task description]
        PLAN[implementation_plan.json<br/>Phases & subtasks]
        CONTEXT[context.json<br/>Code analysis]
    end

    subgraph "Execution Engine"
        WORKER[Claude Code Worker<br/>AI Agent]
        SUBTASK[Subtask Executor<br/>Isolated execution]
        VERIFY[Verification Engine<br/>Test runner]
    end

    subgraph "State Management"
        PROGRESS[build-progress.txt<br/>Real-time status]
        MEMORY[Memory System<br/>Discoveries & gotchas]
        LOGS[task_logs.json<br/>Execution logs]
    end

    subgraph "Git Integration"
        WORKTREE[Git Worktree<br/>Isolated branch]
        COMMIT[Atomic Commits<br/>Per subtask]
        PR[Pull Request<br/>GitHub integration]
    end

    SPEC --> PLAN
    PLAN --> WORKER
    CONTEXT --> WORKER
    WORKER --> SUBTASK
    SUBTASK --> VERIFY
    VERIFY --> PROGRESS
    WORKER --> MEMORY
    SUBTASK --> LOGS
    WORKER --> WORKTREE
    VERIFY --> COMMIT
    COMMIT --> PR

    style WORKER fill:#4A90E2
    style PLAN fill:#E94E77
    style MEMORY fill:#50C878
    style WORKTREE fill:#FFB347
```

### Agent Communication via Kafka

```mermaid
graph LR
    subgraph "Producers"
        TD[td CLI<br/>Go]
        RIG[rig Service<br/>Node.js]
        BRIDGE[Gitea Bridge<br/>Webhooks]
    end

    subgraph "Kafka Topics"
        CREATED[tundra-beads-created]
        WORK[tundra-beads-work]
        PROGRESS[tundra-beads-in-progress]
        COMPLETE[tundra-beads-completed]
        NUDGES[tundra-nudges]
    end

    subgraph "Consumers"
        AIRFLOW[Airflow DAG<br/>Workflow triggers]
        AGENTS[Agent Pool<br/>Task workers]
        DSM[Data Stream Manager<br/>Event processing]
    end

    TD --> CREATED
    TD --> WORK
    TD --> PROGRESS
    TD --> COMPLETE
    TD --> NUDGES
    RIG --> CREATED
    BRIDGE --> CREATED

    CREATED --> AIRFLOW
    CREATED --> AGENTS
    WORK --> AGENTS
    PROGRESS --> DSM
    COMPLETE --> AIRFLOW
    COMPLETE --> AGENTS

    style CREATED fill:#4A90E2
    style AIRFLOW fill:#E94E77
    style AGENTS fill:#50C878
```

**Key Agent Features:**

- **Multi-Agent Coordination** - `.agents/` directory for parallel task execution
- **Auto-Claude Orchestration** - `.auto-claude/` for automated task workflows
- **Event-Driven Communication** - Kafka topics for agent messaging
- **Memory Persistence** - PostgreSQL with pgvector for agent memory
- **Tool Framework** - Unified tool system with RBAC permissions
- **Isolation & Security** - Git worktrees, sandbox execution, audit logging

**Agent Specialization Types:**

| Agent Type | Domain | Example Tasks |
|------------|--------|---------------|
| quality-engineer | Testing & QA | Test migration, coverage analysis |
| security-engineer | Security | Security hardening, auth flows |
| technical-writer | Documentation | API docs, guides, tutorials |
| devops-architect | Infrastructure | Docker, Kubernetes, CI/CD |
| frontend-architect | UI/UX | React components, styling |
| performance-engineer | Optimization | Profiling, performance tuning |

For detailed agent orchestration architecture, see [Agent Orchestration Architecture](./architecture/AGENT_ORCHESTRATION.md).

---

## Authentication Flow

### Complete Authentication Architecture

```mermaid
sequenceDiagram
    participant User
    participant Swift as Swift Auth Module
    participant Keychain as macOS Keychain
    participant Caddy as Caddy Proxy
    participant VSCode as OpenVSCode Server

    User->>Swift: Launch VibeCode.app
    Swift->>Keychain: Check for stored token

    alt Token exists and valid
        Keychain-->>Swift: Return JWT
        Swift->>Caddy: Start proxy with JWT validation
        Caddy->>VSCode: Start OpenVSCode Server
        VSCode-->>User: Show IDE (authenticated)
    else No token or expired
        Swift->>User: Show login screen

        alt Local Password
            User->>Swift: Enter password + Touch ID
            Swift->>Swift: Generate JWT
            Swift->>Keychain: Store tokens (access + refresh)
        else OAuth (GitHub/Google/Apple)
            User->>Swift: Select OAuth provider
            Swift->>User: Open browser
            User->>OAuth Provider: Authenticate
            OAuth Provider-->>Swift: Authorization code
            Swift->>OAuth Provider: Exchange for token
            OAuth Provider-->>Swift: Access token
            Swift->>Swift: Generate internal JWT
            Swift->>Keychain: Store tokens
        end

        Swift->>Caddy: Start proxy with JWT validation
        Caddy->>VSCode: Start OpenVSCode Server
        VSCode-->>User: Show IDE (authenticated)
    end

    loop Every 15 minutes
        Swift->>Swift: Check token expiry
        alt Token expires in <15 min
            Swift->>Swift: Refresh token silently
            Swift->>Keychain: Update stored token
        end
    end
```

### Deployment-Specific Auth Flows

```mermaid
graph TB
    subgraph "Desktop Mode (Single User)"
        D1[Swift Auth]
        D2[Local Password<br/>or Touch ID]
        D3[Generate JWT]
        D4[Store in Keychain]
        D5[Direct to Server<br/>No Caddy]
    end

    subgraph "Local VM Mode (Development)"
        L1[Swift Auth]
        L2[Touch ID<br/>+ Lightweight Caddy]
        L3[Generate JWT]
        L4[Caddy validates]
        L5[Proxy to VM:8080]
    end

    subgraph "Remote Fleet Mode (Production)"
        R1[Web Browser]
        R2[Caddy with OAuth]
        R3[GitHub/Google/Okta]
        R4[Generate JWT]
        R5[Fleet Manager]
        R6[Assign Node]
        R7[OpenVSCode on Node]
    end

    D1 --> D2 --> D3 --> D4 --> D5
    L1 --> L2 --> L3 --> L4 --> L5
    R1 --> R2 --> R3 --> R4 --> R5 --> R6 --> R7

    style D1 fill:#4A90E2
    style L1 fill:#FFB347
    style R1 fill:#E94E77
```

---

## Data Flow

### Request Flow (Desktop to IDE)

```mermaid
sequenceDiagram
    participant Dashboard as React Dashboard
    participant Tauri as Tauri Runtime
    participant Swift as Swift VM Manager
    participant Caddy as Caddy Proxy
    participant VSCode as OpenVSCode Server
    participant VM as Virtual Machine

    Dashboard->>Tauri: User clicks "Open Workspace"
    Tauri->>Swift: invoke('start_workspace', {id})

    Swift->>Swift: Check workspace status

    alt Workspace stopped
        Swift->>VM: Provision VM (vfkit)
        VM-->>Swift: VM IP: 192.168.64.2
        Swift->>VSCode: Start server in VM
        VSCode-->>Swift: Server ready at :8080
    end

    Swift->>Caddy: Start proxy (8443 → VM:8080)
    Caddy->>Caddy: Inject JWT in headers
    Caddy->>VSCode: Proxy request with auth
    VSCode-->>Caddy: IDE HTML + WebSocket
    Caddy-->>Swift: Response
    Swift-->>Tauri: Server URL: https://localhost:8443
    Tauri->>Dashboard: Open WKWebView with URL
    Dashboard->>Dashboard: Load IDE interface

    loop Every 5 seconds
        Dashboard->>Tauri: Check workspace status
        Tauri->>Swift: get_workspace_status(id)
        Swift->>VM: Query VM health
        VM-->>Swift: Status: running, CPU: 45%, RAM: 2.1GB
        Swift-->>Tauri: Return status
        Tauri-->>Dashboard: Update UI badge
    end
```

### Extension Installation Flow

```mermaid
sequenceDiagram
    participant User
    participant Dashboard as Extensions Drawer
    participant Tauri
    participant OpenVSX as Open-VSX Registry
    participant VSCode as OpenVSCode Server

    User->>Dashboard: Search "Python"
    Dashboard->>OpenVSX: GET /api/-/search?query=python
    OpenVSX-->>Dashboard: Results: [ms-python.python, ...]
    Dashboard->>User: Display extensions

    User->>Dashboard: Click "Install" on Python
    Dashboard->>Tauri: invoke('install_extension', {id: 'ms-python.python'})
    Tauri->>VSCode: Execute CLI: code --install-extension ms-python.python
    VSCode->>OpenVSX: Download .vsix file
    OpenVSX-->>VSCode: python-2024.10.0.vsix (50MB)
    VSCode->>VSCode: Extract and install extension
    VSCode-->>Tauri: Installation complete
    Tauri-->>Dashboard: Success
    Dashboard->>User: Show toast: "Python extension installed"
    Dashboard->>Dashboard: Refresh installed extensions list
```

---

## Deployment Models

### Model 1: Desktop App (Single User, Local)

```mermaid
graph TB
    subgraph "MacBook Pro (Host OS)"
        APP[VibeCode.app]
        WEBKIT[WKWebView]
        AUTH[Swift Auth<br/>Touch ID]
        SERVER[OpenVSCode Server<br/>localhost:8080]
        FS[File System<br/>~/Projects/]
    end

    APP --> WEBKIT
    APP --> AUTH
    WEBKIT --> SERVER
    SERVER --> FS
    AUTH --> |JWT| SERVER

    style APP fill:#4A90E2
    style SERVER fill:#E94E77
```

**Characteristics:**
- No VM required (direct localhost)
- Swift auth with Touch ID
- Fastest performance
- Single user only
- No network isolation

---

### Model 2: Local VM (Development, Isolated)

```mermaid
graph TB
    subgraph "MacBook Pro (Host OS)"
        APP[VibeCode.app]
        WEBKIT[WKWebView]
        AUTH[Swift Auth]
        CADDY[Caddy<br/>localhost:8443]
        VFKIT[vfkit VM Manager]
    end

    subgraph "VM (Linux ARM64)"
        SERVER[OpenVSCode Server<br/>192.168.64.2:8080]
        FS[File System<br/>/workspace/]
    end

    APP --> WEBKIT
    APP --> AUTH
    APP --> VFKIT
    WEBKIT --> CADDY
    CADDY --> |TLS| SERVER
    AUTH --> |JWT| CADDY
    VFKIT --> |Network Bridge| SERVER
    SERVER --> FS

    style APP fill:#4A90E2
    style SERVER fill:#E94E77
    style VFKIT fill:#FFB347
```

**Characteristics:**
- VM isolation (security)
- Caddy for TLS + JWT
- vfkit (Virtualization.framework)
- Port forwarding: 8443 → VM:8080
- Single user

---

### Model 3: Remote Fleet (Multi-User, Production)

```mermaid
graph TB
    subgraph "User Devices"
        BROWSER[Web Browser]
    end

    subgraph "Fleet Control Plane"
        LB[Load Balancer<br/>vibecode.company.com]
        CADDY[Caddy Fleet<br/>OAuth + JWT]
        FLEET[Fleet Manager<br/>Swift/Rust]
        DB[(PostgreSQL<br/>Sessions)]
    end

    subgraph "Mac Node 1"
        VM1[OpenVSCode<br/>Node 1]
        WS1[Workspace 1]
    end

    subgraph "Mac Node 2"
        VM2[OpenVSCode<br/>Node 2]
        WS2[Workspace 2]
    end

    subgraph "Mac Node N"
        VMN[OpenVSCode<br/>Node N]
        WSN[Workspace N]
    end

    BROWSER --> |HTTPS| LB
    LB --> CADDY
    CADDY --> |Validate JWT| FLEET
    FLEET --> DB
    FLEET --> |Assign User| VM1
    FLEET --> |Assign User| VM2
    FLEET --> |Assign User| VMN
    VM1 --> WS1
    VM2 --> WS2
    VMN --> WSN

    style BROWSER fill:#61DAFB
    style CADDY fill:#1F88C7
    style FLEET fill:#FFB347
    style VM1 fill:#E94E77
    style VM2 fill:#E94E77
    style VMN fill:#E94E77
```

**Characteristics:**
- Multi-user, multi-tenant
- OAuth/OIDC (GitHub, Google, Okta)
- Fleet-wide RBAC
- Service discovery (mDNS/Consul)
- Load balancing
- Horizontal scaling

---

## Technology Stack

### Frontend Stack

```mermaid
graph LR
    subgraph "UI Layer"
        REACT[React 19<br/>UI Framework]
        ZUSTAND[Zustand<br/>State Management]
        RADIX[Radix UI<br/>Components]
        TAILWIND[Tailwind CSS<br/>Styling]
        LUCIDE[Lucide React<br/>Icons]
    end

    subgraph "Desktop Layer"
        TAURI[Tauri 2.0<br/>Desktop Runtime]
        WEBKIT[WKWebView<br/>Renderer]
        SWIFT[Swift 5<br/>Native APIs]
    end

    REACT --> TAURI
    ZUSTAND --> TAURI
    RADIX --> REACT
    TAILWIND --> REACT
    LUCIDE --> REACT
    TAURI --> WEBKIT
    TAURI --> SWIFT

    style REACT fill:#61DAFB
    style TAURI fill:#FFC131
    style SWIFT fill:#F05138
```

### Backend Stack

```mermaid
graph LR
    subgraph "IDE Backend"
        RUSTCLI[Rust 1.90<br/>CLI Binary]
        NODEJS[Node.js 22<br/>Runtime]
        MONACO[Monaco Editor<br/>Web Editor]
        EXTENSIONS[Open-VSX<br/>Extensions]
    end

    subgraph "Security Layer"
        CADDY[Caddy 2.x<br/>Reverse Proxy]
        JWT[JWT Library<br/>Token Validation]
        OAUTH[OAuth 2.0<br/>Providers]
    end

    subgraph "Infrastructure"
        VFKIT[vfkit<br/>VM Provider]
        QEMU[QEMU<br/>Alternative]
        LIMA[Lima<br/>Experimental]
    end

    RUSTCLI --> NODEJS
    NODEJS --> MONACO
    NODEJS --> EXTENSIONS
    CADDY --> JWT
    CADDY --> OAUTH
    CADDY --> RUSTCLI
    VFKIT --> RUSTCLI

    style RUSTCLI fill:#CE422B
    style NODEJS fill:#339933
    style CADDY fill:#1F88C7
    style VFKIT fill:#FFB347
```

### Data Stack

```mermaid
graph TB
    subgraph "Storage"
        KEYCHAIN[macOS Keychain<br/>Tokens + Secrets]
        FS[File System<br/>Workspaces]
        POSTGRES[(PostgreSQL 16<br/>Session + Agent Memory)]
        PGVECTOR[pgvector<br/>Embeddings]
    end

    subgraph "Messaging & Cache"
        KAFKA[Kafka<br/>Event Bus]
        REDIS[(Redis/Valkey<br/>Cache)]
    end

    subgraph "Monitoring"
        DATADOG[Datadog<br/>Metrics + Logs + APM]
        OTEL[OpenTelemetry<br/>Distributed Tracing]
    end

    subgraph "AI Services"
        OPENROUTER[OpenRouter<br/>321+ Models]
        ANTHROPIC[Anthropic<br/>Claude]
        OPENAI[OpenAI<br/>GPT-4]
    end

    KEYCHAIN --> |Secure Storage| POSTGRES
    FS --> |File Metadata| POSTGRES
    POSTGRES --> PGVECTOR
    POSTGRES --> |Metrics| DATADOG
    POSTGRES --> |Traces| OTEL
    KAFKA --> REDIS
    KAFKA --> DATADOG
    OPENROUTER --> ANTHROPIC
    OPENROUTER --> OPENAI

    style POSTGRES fill:#336791
    style KAFKA fill:#FFB347
    style DATADOG fill:#632CA6
    style PGVECTOR fill:#50C878
```

---

## Integration Points

### Swift → Rust FFI Bridge

```mermaid
graph LR
    subgraph "Swift Layer"
        SWIFTAPI[Swift API<br/>VibeCodeServer.swift]
        BRIDGING[Bridging Header<br/>C Interface]
    end

    subgraph "Rust Layer"
        RUSTLIB[Rust Library<br/>libvibecode_cli.dylib]
        RUSTCLI[Rust CLI<br/>Main Binary]
    end

    SWIFTAPI --> BRIDGING
    BRIDGING --> |extern "C"| RUSTLIB
    RUSTLIB --> RUSTCLI

    style SWIFTAPI fill:#F05138
    style RUSTLIB fill:#CE422B
```

**Interface Example:**
```swift
// Swift side
class VibeCodeServer {
    func start(config: ServerConfig) async throws {
        try await rust_start_server(
            port: config.port,
            host: config.host
        )
    }
}

// Rust side (exported via FFI)
#[no_mangle]
pub extern "C" fn rust_start_server(
    port: u16,
    host: *const c_char
) -> bool {
    // Launch OpenVSCode Server
}
```

---

### Tauri Commands API

```mermaid
graph LR
    subgraph "Frontend (React)"
        DASHBOARD[Dashboard Component]
    end

    subgraph "Tauri Runtime"
        INVOKE[invoke API]
        COMMANDS[Tauri Commands<br/>Rust]
    end

    subgraph "Backend Services"
        SWIFT[Swift VM Manager]
        VSCODE[OpenVSCode Server]
    end

    DASHBOARD --> |invoke('get_workspaces')| INVOKE
    INVOKE --> COMMANDS
    COMMANDS --> |Call Swift via FFI| SWIFT
    COMMANDS --> |HTTP Request| VSCODE

    style DASHBOARD fill:#61DAFB
    style COMMANDS fill:#FFC131
    style SWIFT fill:#F05138
```

**API Examples:**
```typescript
// Frontend
const workspaces = await invoke('get_workspaces');
await invoke('start_workspace', { workspaceId: 'ws-123' });
await invoke('install_extension', { extensionId: 'ms-python.python' });
```

```rust
// Backend
#[tauri::command]
async fn get_workspaces() -> Result<Vec<Workspace>, String> {
    // Query workspaces from file system
}

#[tauri::command]
async fn start_workspace(workspace_id: String) -> Result<(), String> {
    // Start VM, launch OpenVSCode Server
}
```

---

### VM Management API

```mermaid
sequenceDiagram
    participant Swift as Swift VM Manager
    participant vfkit as vfkit CLI
    participant VM as Virtual Machine
    participant VSCode as OpenVSCode Server

    Swift->>vfkit: Create VM config
    Note over vfkit: {cpu: 2, ram: 4096, disk: 20GB}

    Swift->>vfkit: Start VM
    vfkit->>VM: Boot Linux ARM64
    VM-->>vfkit: VM IP: 192.168.64.2
    vfkit-->>Swift: VM started successfully

    Swift->>VM: SSH to VM
    Swift->>VM: scp openvscode-server binary
    Swift->>VM: ./code serve-web --host 0.0.0.0 --port 8080
    VM->>VSCode: Start server process
    VSCode-->>Swift: Server ready

    Swift->>Swift: Map port 8443 → 192.168.64.2:8080
    Swift->>Swift: Return URL: https://localhost:8443
```

---

## Network Architecture

### Port Mapping

```mermaid
graph TB
    subgraph "User Access"
        BROWSER[Browser/App<br/>https://localhost:8443]
    end

    subgraph "Host OS"
        CADDY[Caddy Proxy<br/>:8443 HTTPS]
        TUNNEL[SSH Tunnel<br/>Port Forward]
    end

    subgraph "VM (if used)"
        VSCODE[OpenVSCode Server<br/>:8080 HTTP]
    end

    BROWSER --> |TLS 1.3| CADDY
    CADDY --> |JWT Validation| TUNNEL
    TUNNEL --> |Port Forward| VSCODE
    VSCODE --> |Bound to 0.0.0.0| VSCODE

    style BROWSER fill:#61DAFB
    style CADDY fill:#1F88C7
    style VSCODE fill:#E94E77
```

**Port Allocation:**
- `8443` - Caddy HTTPS (external)
- `8080` - OpenVSCode Server HTTP (internal)
- `2019` - Caddy admin API (localhost only)
- `3000` - React dev server (development only)

---

## State Management

### Zustand Store Architecture

```mermaid
graph TB
    subgraph "UI Components"
        DASHBOARD[Dashboard]
        CARDS[WorkspaceCard]
        DRAWER[ExtensionsDrawer]
    end

    subgraph "Zustand Stores"
        WORKSPACE[WorkspaceStore<br/>workspaces, loading, error]
        EXTENSION[ExtensionStore<br/>installed, recommended]
        SETTINGS[SettingsStore<br/>preferences]
        UI[UIStore<br/>theme, modals]
    end

    subgraph "Backend APIs"
        TAURI[Tauri Commands]
        OPENVSX[Open-VSX API]
    end

    DASHBOARD --> WORKSPACE
    CARDS --> WORKSPACE
    DRAWER --> EXTENSION
    WORKSPACE --> TAURI
    EXTENSION --> OPENVSX
    EXTENSION --> TAURI
    SETTINGS --> TAURI

    style DASHBOARD fill:#61DAFB
    style WORKSPACE fill:#443E38
    style TAURI fill:#FFC131
```

---

## Summary

VibeCode's architecture is designed around:

1. **Multi-Agent Orchestration** - `.agents/` and `.auto-claude/` frameworks for parallel task execution
2. **Native macOS Integration** - Swift 5 + Virtualization.framework
3. **Hybrid Authentication** - Swift auth + Caddy proxy + JWT
4. **VM Flexibility** - Support for vfkit, QEMU, Lima
5. **Event-Driven Architecture** - Kafka message bus for agent communication
6. **AI-Powered Memory** - PostgreSQL + pgvector for agent memory and embeddings
7. **Lightweight Frontend** - React + Zustand (<200KB bundle)
8. **OpenVSCode Server** - Rust CLI + Node.js runtime
9. **Modular Design** - Clear separation of concerns
10. **Security First** - TLS 1.3, JWT, biometric auth, sandbox execution
11. **Observability** - Datadog APM + OpenTelemetry distributed tracing
12. **Scalable** - Desktop → VM → Fleet → Multi-Agent deployment

---

**Next Steps:**
- [Agent Orchestration Architecture](./architecture/AGENT_ORCHESTRATION.md) - Multi-agent system details
- [Integration Architecture](./architecture/INTEGRATION_ARCHITECTURE.md) - Service integration patterns
- [Deployment Architecture](./architecture/DEPLOYMENT_ARCHITECTURE.md) - Kubernetes and Docker deployment
- [Enterprise Architecture](./architecture/ENTERPRISE_ARCHITECTURE.md) - Security and compliance
- [Implementation Roadmap](./IMPLEMENTATION_ROADMAP.md) - Development plan
- [Quick Start Guide](./QUICKSTART.md) - Get started in 5 minutes

---

**Document Version:** 2.0
**Last Updated:** February 28, 2026
**Maintained By:** Platform Architecture Team
