# Architecture Diagrams

Technical architecture diagrams for VibeCode WebGUI documentation.

## System Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      VibeCode Desktop                            │
│                   (Tauri 2.9.1 Shell)                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Next.js    │  │    Monaco    │  │  Terminal    │          │
│  │  Frontend    │  │    Editor    │  │  (xterm.js)  │          │
│  │  (React 19)  │  │   (0.53.0)   │  │              │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                  │                  │                  │
│         └──────────────────┴──────────────────┘                  │
│                            ▼                                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              API Routes Layer                            │   │
│  │  /api/ai/chat  /api/code-completion  /api/terminal      │   │
│  │  /api/vms      /api/git              /api/monitoring     │   │
│  └──────────────────────┬──────────────────────────────────┘   │
│                         │                                       │
│  ┌──────────────────────┴──────────────────────────────────┐   │
│  │          Rust Backend (Tauri Core)                       │   │
│  │  - VM Management       - Docker Integration              │   │
│  │  - File Operations     - System APIs                     │   │
│  │  - IPC Commands        - Native Features                 │   │
│  └──────────────────────┬──────────────────────────────────┘   │
│                         │                                       │
└─────────────────────────┼───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│              External Services & VMs                             │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │  vfkit   │  │  Lima    │  │  Docker  │  │  QEMU    │       │
│  │   VMs    │  │   VMs    │  │ Containers│ │   VMs    │       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │ OpenAI   │  │Anthropic │  │ Datadog  │  │  GitHub  │       │
│  │   API    │  │   API    │  │   RUM    │  │   API    │       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
└─────────────────────────────────────────────────────────────────┘
```

## Component Architecture

### Frontend Stack

```
┌────────────────────────────────────────────────┐
│            React 19 Components                  │
├────────────────────────────────────────────────┤
│                                                │
│  ┌─────────────┐  ┌─────────────┐            │
│  │   Editor    │  │  Terminal   │            │
│  │ (Monaco)    │  │  (xterm.js) │            │
│  └─────────────┘  └─────────────┘            │
│                                                │
│  ┌─────────────┐  ┌─────────────┐            │
│  │ VM Manager  │  │   Settings  │            │
│  └─────────────┘  └─────────────┘            │
│                                                │
├────────────────────────────────────────────────┤
│         State Management (Zustand)             │
├────────────────────────────────────────────────┤
│         Styling (Tailwind CSS 4)               │
└────────────────────────────────────────────────┘
```

### Backend Stack

```
┌────────────────────────────────────────────────┐
│          Next.js API Routes                     │
├────────────────────────────────────────────────┤
│                                                │
│  /api/ai/         ┌──────────────┐            │
│  ├─ chat          │  OpenAI SDK  │            │
│  └─ completion    │ Anthropic SDK│            │
│                   └──────────────┘            │
│                                                │
│  /api/terminal/   ┌──────────────┐            │
│  ├─ create        │   node-pty   │            │
│  ├─ input         │  WebSocket   │            │
│  └─ resize        └──────────────┘            │
│                                                │
│  /api/vms/        ┌──────────────┐            │
│  ├─ list          │  Child Proc  │            │
│  ├─ start         │   vfkit CLI  │            │
│  ├─ stop          │   Lima CLI   │            │
│  └─ delete        └──────────────┘            │
│                                                │
└────────────────────────────────────────────────┘
```

## Data Flow Diagrams

### AI Chat Flow

```
User Input
    │
    ▼
┌─────────────────────┐
│  Monaco Editor      │
│  (Code Context)     │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  /api/ai/chat       │
│  (Request Handler)  │
└──────────┬──────────┘
           │
           ├──────────────────┐
           │                  │
           ▼                  ▼
┌──────────────────┐ ┌──────────────────┐
│   OpenAI API     │ │  Anthropic API   │
│  (GPT-4, etc.)   │ │  (Claude, etc.)  │
└──────────┬───────┘ └────────┬─────────┘
           │                  │
           └──────────┬───────┘
                      │
                      ▼
           ┌──────────────────┐
           │  Streaming       │
           │  Response        │
           └──────────┬───────┘
                      │
                      ▼
           ┌──────────────────┐
           │  Update UI       │
           │  (React State)   │
           └──────────────────┘
```

### VM Lifecycle

```
Create VM
    │
    ▼
┌─────────────────────────────────┐
│  /api/vms/create                │
│  - Parse config                 │
│  - Validate resources           │
│  - Generate VM ID               │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│  Tauri Command                  │
│  - vm_create(config)            │
│  - Rust IPC handler             │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│  VM Provider (vfkit/Lima)       │
│  - Allocate resources           │
│  - Create disk image            │
│  - Configure networking         │
└────────────┬────────────────────┘
             │
             ▼
        VM Created
             │
             ▼
┌─────────────────────────────────┐
│  Start VM                       │
│  - vfkit run / limactl start    │
│  - Monitor boot process         │
│  - Wait for SSH/network ready   │
└────────────┬────────────────────┘
             │
             ▼
        VM Running
             │
             ▼
┌─────────────────────────────────┐
│  Stop VM                        │
│  - Graceful shutdown            │
│  - ACPI power button            │
│  - Wait for termination         │
└────────────┬────────────────────┘
             │
             ▼
        VM Stopped
             │
             ▼
┌─────────────────────────────────┐
│  Delete VM                      │
│  - Remove disk image            │
│  - Clean up config              │
│  - Free resources               │
└────────────┬────────────────────┘
             │
             ▼
        VM Deleted
```

### Terminal Connection Flow

```
User Opens Terminal
        │
        ▼
┌──────────────────────┐
│  /api/terminal/      │
│  create              │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│  node-pty            │
│  spawn("/bin/bash")  │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│  WebSocket           │
│  Connection          │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│  xterm.js            │
│  (UI Rendering)      │
└──────────────────────┘
```

## CI/CD Pipeline

### Build & Release Flow

```
GitHub Push (main)
    │
    ▼
┌─────────────────────────────────┐
│  GitHub Actions: CI Workflow    │
├─────────────────────────────────┤
│  Parallel Jobs:                 │
│  ┌─────┐ ┌─────┐ ┌──────┐      │
│  │Lint │ │Test │ │Audit │      │
│  └──┬──┘ └──┬──┘ └───┬──┘      │
│     └───────┴────────┘          │
│           ▼                     │
│     All Checks Pass             │
└────────────┬────────────────────┘
             │
             ▼ (on tag push: v*)
┌─────────────────────────────────┐
│ Build macOS Workflow            │
├─────────────────────────────────┤
│  1. Install Dependencies        │
│     npm ci --legacy-peer-deps   │
│                                 │
│  2. Build Next.js Frontend      │
│     npm run build:tauri         │
│                                 │
│  3. Build Tauri (ARM64)         │
│     npm run tauri:build         │
│                                 │
│  4. Create DMG Installer        │
│     tauri build --target aarch64│
│                                 │
│  5. Generate Checksums          │
│     shasum -a 256 *.dmg         │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│ Release Workflow                │
├─────────────────────────────────┤
│  1. Create GitHub Release       │
│     gh release create $TAG      │
│                                 │
│  2. Upload Binaries             │
│     - VibeCode.dmg              │
│     - VibeCode.app.tar.gz       │
│                                 │
│  3. Upload Documentation        │
│     - CHANGELOG.md              │
│     - RELEASE_NOTES.md          │
│                                 │
│  4. Publish Release             │
│     gh release publish $TAG     │
└─────────────────────────────────┘
```

### Test Strategy

```
┌─────────────────────────────────────────────┐
│              Test Pyramid                   │
├─────────────────────────────────────────────┤
│                                             │
│                   ┌────┐                    │
│                   │ E2E│                    │
│                   └────┘                    │
│              Playwright Tests               │
│         (UI workflows, critical paths)      │
│                                             │
│              ┌────────────┐                 │
│              │Integration │                 │
│              └────────────┘                 │
│          API Routes, WebSocket              │
│         Terminal, VM Management             │
│                                             │
│         ┌──────────────────────┐            │
│         │    Unit Tests        │            │
│         └──────────────────────┘            │
│      Jest, React Testing Library            │
│    Components, Utilities, Helpers           │
│                                             │
└─────────────────────────────────────────────┘
```

## Security Architecture

### Authentication Flow

```
User Login
    │
    ▼
┌─────────────────────┐
│  Next-Auth          │
│  (Session Mgmt)     │
└──────────┬──────────┘
           │
           ├──────────────────────┐
           │                      │
           ▼                      ▼
┌──────────────────┐   ┌──────────────────┐
│  Credentials     │   │  OAuth Providers │
│  (bcrypt)        │   │  (GitHub, etc.)  │
└──────────┬───────┘   └────────┬─────────┘
           │                    │
           └──────────┬─────────┘
                      │
                      ▼
           ┌──────────────────┐
           │  JWT Token       │
           │  (HTTP-only)     │
           └──────────┬───────┘
                      │
                      ▼
           ┌──────────────────┐
           │  Session Cookie  │
           │  (Secure)        │
           └──────────────────┘
```

### API Security Layers

```
┌─────────────────────────────────────┐
│         User Request                 │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│  1. Rate Limiting (Upstash)         │
│     - 100 req/min per IP            │
│     - 1000 req/hour per user        │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│  2. Authentication (Next-Auth)      │
│     - Validate session token        │
│     - Check user permissions        │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│  3. Input Validation (Zod)          │
│     - Sanitize user input           │
│     - Validate data schemas         │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│  4. CORS & CSP Headers              │
│     - Strict origin policy          │
│     - Content security policy       │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│  5. API Route Handler               │
│     - Business logic                │
│     - Database operations           │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│         Response (JSON)              │
└─────────────────────────────────────┘
```

## Monitoring & Observability

### Datadog Integration

```
┌─────────────────────────────────────────────┐
│            Application Code                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │ Frontend │  │ Backend  │  │  Tauri   │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  │
│       │             │              │         │
│       └─────────────┼──────────────┘         │
│                     │                        │
│       ┌─────────────┴─────────────┐          │
│       │    dd-trace (APM)         │          │
│       │    @datadog/browser-rum   │          │
│       └─────────────┬─────────────┘          │
└─────────────────────┼──────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────┐
│          Datadog Agent                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │ Metrics  │  │  Traces  │  │   Logs   │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  │
│       └─────────────┼──────────────┘         │
└─────────────────────┼──────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────┐
│          Datadog Cloud                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │   APM    │  │   RUM    │  │   DBM    │  │
│  └──────────┘  └──────────┘  └──────────┘  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │  Alerts  │  │Dashboard │  │ Synthetics│  │
│  └──────────┘  └──────────┘  └──────────┘  │
└─────────────────────────────────────────────┘
```

## Deployment Architectures

### Local Development

```
┌─────────────────────────────────┐
│      Developer Machine          │
│  ┌──────────────────────────┐  │
│  │  npm run tauri:dev       │  │
│  │  ├─ Next.js (port 3000)  │  │
│  │  └─ Tauri (native)       │  │
│  └──────────────────────────┘  │
│                                 │
│  ┌──────────────────────────┐  │
│  │  VM Providers            │  │
│  │  ├─ vfkit (macOS)        │  │
│  │  ├─ Lima (cross-platform)│  │
│  │  └─ Docker Desktop       │  │
│  └──────────────────────────┘  │
└─────────────────────────────────┘
```

### Production (Docker)

```
┌─────────────────────────────────────────┐
│          Docker Compose                  │
├─────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐    │
│  │   Next.js    │  │  PostgreSQL  │    │
│  │  (port 3000) │  │  (port 5432) │    │
│  └──────┬───────┘  └──────┬───────┘    │
│         │                  │             │
│  ┌──────┴───────┐  ┌──────┴───────┐    │
│  │    Redis     │  │   Valkey     │    │
│  │  (port 6379) │  │  (port 6380) │    │
│  └──────────────┘  └──────────────┘    │
│                                         │
│  ┌──────────────────────────────────┐  │
│  │       Datadog Agent              │  │
│  │       (port 8126)                │  │
│  └──────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

### Kubernetes (AKS)

```
┌────────────────────────────────────────────────┐
│         Azure Kubernetes Service               │
├────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────┐    │
│  │  Ingress (NGINX)                      │    │
│  │  - TLS Termination                    │    │
│  │  - Load Balancing                     │    │
│  └────────────────┬──────────────────────┘    │
│                   │                            │
│  ┌────────────────┴──────────────────────┐    │
│  │  VibeCode Deployment                  │    │
│  │  ├─ Next.js (3 replicas)              │    │
│  │  ├─ HPA (CPU > 70%)                   │    │
│  │  └─ Resource Limits                   │    │
│  └────────────────┬──────────────────────┘    │
│                   │                            │
│  ┌────────────────┴──────────────────────┐    │
│  │  Databases (StatefulSet)              │    │
│  │  ├─ PostgreSQL (primary + replica)    │    │
│  │  ├─ Redis (cluster mode)              │    │
│  │  └─ Persistent Volumes (Azure Disks)  │    │
│  └───────────────────────────────────────┘    │
│                                                │
│  ┌───────────────────────────────────────┐    │
│  │  Datadog Agent (DaemonSet)            │    │
│  │  - APM & Metrics Collection           │    │
│  │  - Log Aggregation                    │    │
│  └───────────────────────────────────────┘    │
└────────────────────────────────────────────────┘
```

## File Structure

### Project Organization

```
vibecode-webgui/
├── src/
│   ├── app/              # Next.js App Router
│   │   ├── api/          # API routes
│   │   ├── (auth)/       # Auth pages
│   │   └── (dashboard)/  # Main app
│   ├── components/       # React components
│   ├── lib/              # Shared utilities
│   └── tauri/            # Rust backend
│
├── src-tauri/            # Tauri configuration
│   ├── src/              # Rust source
│   ├── icons/            # App icons
│   └── tauri.conf.json   # Tauri config
│
├── docs/                 # Documentation
│   ├── images/           # Screenshots & diagrams
│   ├── guides/           # User guides
│   └── api/              # API documentation
│
├── tests/                # Test suites
│   ├── unit/             # Jest unit tests
│   ├── integration/      # API integration tests
│   └── e2e/              # Playwright E2E tests
│
└── scripts/              # Build & dev scripts
    ├── desktop/          # Desktop build scripts
    └── dev/              # Development utilities
```

## Technology Stack

### Core Technologies

```
┌─────────────────────────────────────────┐
│         Frontend Stack                   │
├─────────────────────────────────────────┤
│  React 19.1.1                           │
│  Next.js 16.0.1                         │
│  TypeScript 5.9.3                       │
│  Tailwind CSS 4.1.15                    │
│  Monaco Editor 0.53.0                   │
│  xterm.js 5.5.0                         │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│         Backend Stack                    │
├─────────────────────────────────────────┤
│  Tauri 2.9.1                            │
│  Rust 1.80+                             │
│  Node.js 18.18.0+                       │
│  PostgreSQL 16                          │
│  Redis 7.2 / Valkey 7.2                 │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│         AI & ML Stack                    │
├─────────────────────────────────────────┤
│  OpenAI SDK 4.104.0                     │
│  Anthropic SDK (Claude)                 │
│  Monacopilot 1.2.7                      │
│  LangChain 1.0.2                        │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│         DevOps Stack                     │
├─────────────────────────────────────────┤
│  GitHub Actions                          │
│  Docker & Docker Compose                │
│  Kubernetes (AKS)                       │
│  Datadog (APM, RUM, Logs)               │
└─────────────────────────────────────────┘
```

## Network Topology

### VM Networking (vfkit)

```
┌────────────────────────────────────────────┐
│         Host (macOS)                        │
│  ┌──────────────────────────────────────┐ │
│  │  VibeCode App                        │ │
│  └──────────────┬───────────────────────┘ │
│                 │                          │
│  ┌──────────────┴───────────────────────┐ │
│  │  VZ Framework Bridge (192.168.105.x) │ │
│  └──────────────┬───────────────────────┘ │
│                 │                          │
│  ┌──────────────┴───────────────────────┐ │
│  │  VM 1: Ubuntu Dev                    │ │
│  │  IP: 192.168.105.2                   │ │
│  │  Ports: 22 (SSH), 80 (HTTP)          │ │
│  └──────────────────────────────────────┘ │
│                                            │
│  ┌──────────────────────────────────────┐ │
│  │  VM 2: PostgreSQL                    │ │
│  │  IP: 192.168.105.3                   │ │
│  │  Ports: 5432 (PostgreSQL)            │ │
│  └──────────────────────────────────────┘ │
└────────────────────────────────────────────┘
```

## State Management

### Zustand Store Architecture

```
┌────────────────────────────────────────┐
│         Global State (Zustand)          │
├────────────────────────────────────────┤
│                                        │
│  ┌────────────────────────────────┐   │
│  │  editorStore                   │   │
│  │  - files[]                     │   │
│  │  - activeFile                  │   │
│  │  - theme                       │   │
│  └────────────────────────────────┘   │
│                                        │
│  ┌────────────────────────────────┐   │
│  │  terminalStore                 │   │
│  │  - sessions[]                  │   │
│  │  - activeSession               │   │
│  └────────────────────────────────┘   │
│                                        │
│  ┌────────────────────────────────┐   │
│  │  vmStore                       │   │
│  │  - vms[]                       │   │
│  │  - selectedVM                  │   │
│  │  - status                      │   │
│  └────────────────────────────────┘   │
│                                        │
│  ┌────────────────────────────────┐   │
│  │  chatStore                     │   │
│  │  - conversations[]             │   │
│  │  - activeConversation          │   │
│  │  - model                       │   │
│  └────────────────────────────────┘   │
└────────────────────────────────────────┘
```

## Performance Optimization

### Build Optimization Strategy

```
Next.js Build
    │
    ├─────────────────────────────┐
    │                             │
    ▼                             ▼
Code Splitting           Image Optimization
    │                             │
    ├─ Route-based               ├─ next/image
    ├─ Dynamic imports           ├─ WebP conversion
    └─ Lazy loading              └─ Responsive sizes
    │                             │
    ▼                             ▼
Minification              Caching Strategy
    │                             │
    ├─ Terser (JS)               ├─ Static assets
    ├─ LightningCSS (CSS)        ├─ API responses
    └─ Tree shaking              └─ Browser cache
    │                             │
    └─────────────┬───────────────┘
                  │
                  ▼
        Production Bundle
        - First Load JS: ~200KB
        - Route chunks: ~50KB avg
        - Static assets: CDN
```

## Diagram Export

All diagrams are available as:
- **ASCII**: In this markdown file (version control friendly)
- **PNG**: `docs/images/architecture/*.png` (for embedding in docs)
- **SVG**: `docs/images/architecture/*.svg` (vector, scalable)

To generate visual diagrams from ASCII:
1. Use https://asciiflow.com for editing
2. Export to PNG via screenshot
3. Or use diagram.net to recreate in visual format

## References

- [Next.js Architecture](https://nextjs.org/docs/architecture)
- [Tauri Architecture](https://tauri.app/v1/guides/architecture/)
- [Virtualization Framework](https://developer.apple.com/documentation/virtualization)
- [Monaco Editor](https://microsoft.github.io/monaco-editor/)

## Maintenance

Update these diagrams when:
- Major architecture changes occur
- New components are added
- Technology stack changes
- Deployment strategy evolves

Last updated: 2025-11-01
