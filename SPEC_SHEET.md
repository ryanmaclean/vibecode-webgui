# VibeCode Complete Product Specification

**Version:** 6.4.0
**Compiled From:** 48 GitHub Releases (v0.9-beta → v5.1.0-beta)
**Date:** 2026-02-07
**Status:** Development (Waves 3-11 complete)
**Total Pages:** 75 | **API Routes:** 119 | **Tests:** 7,262+ | **Agents Deployed:** 47+

---

## 1. Product Overview

VibeCode is an AI-powered development environment that combines a native desktop application with a lightweight Linux virtual machine running essential development services. Built for Apple Silicon, it leverages the Apple Virtualization Framework to provide a fast, resource-efficient development experience without requiring Docker Desktop.

**Key Value Propositions:**
- One-click development environment setup
- 5 essential services running in <25 seconds
- 321+ AI models for code assistance via OpenRouter
- Full observability with Datadog/OpenTelemetry
- No Docker Desktop required
- Cross-platform: macOS, Linux, Windows

---

## 2. Release History & Feature Evolution

### Phase 1: Foundation (v0.9-beta → v1.0.0)
| Release | Key Features |
|---------|-------------|
| v0.9-beta | Native Swift VM manager, Apple Virtualization Framework, 2/6 VMs booting |
| v1.0.0-initramfs | BusyBox initramfs, ARM64 kernel, basic boot |
| v1.0-kernel-* | Kernel variants: k3s, nodejs, glibc, postgres, valkey, vsock |
| v1.0.0 | Services VM: Valkey, PostgreSQL 16, OpenVSCode, Dropbear SSH |
| v1.0.0-apple-container | First cloud IDE on Apple native containerization, sub-second starts |
| v1.0.0-observability | Datadog APM, JSON logging, DogStatsD, OpenTelemetry OTLP |

### Phase 2: Desktop Application (v1.1.0 → v1.5.0)
| Release | Key Features |
|---------|-------------|
| v1.1.0 | vfkit VM integration, Datadog tracing of 20s boot, Tauri desktop |
| v1.2.0 | Dual engine: Electron + Tauri builds, WebKit & Chromium |
| v1.3.0-ard | Apple Remote Desktop mass deployment, unsigned PKG |
| v1.4a-electron | Electron-specific build |
| v1.3.1-lima-kiosk | Lima VM kiosk mode |
| v1.5.0 | 321+ AI models via OpenRouter, Monaco 0.53, Monacopilot, Apple VF |
| v1.6.0-multivm | Multi-VM instance support |

### Phase 3: Unified Services (v2.0 → v3.3.0)
| Release | Key Features |
|---------|-------------|
| v2.0.0-phase1 | Phase 2 sprints: ChatInterface, FileUpload, monitoring dashboard |
| v3.0.0-unified | All 4 services working: SSH, Valkey, PostgreSQL, OpenVSCode |
| v3.1.1 | Ralph Loop: 100% test coverage, 5-agent optimization, 25s boot |
| v3.2.0 | Ralph Loop v3.2.0: Chat persistence, AI streaming, E2E tests |
| v3.2.1 | Datadog VSCode Extension v2.0.0 integrated: 19+ commands |
| v3.3.0 | 5-service architecture (+Docker CE), green terminal, Docker v27.4.1 |

### Phase 4: Production (v4.0.0 → v4.2.0)
| Release | Key Features |
|---------|-------------|
| v4.0.0 | Menubar app, green console, Datadog, 17 busybox commands |
| v4.0.1 | OpenVSCode terminal fix (Issue #790) |
| v4.1.0 | Native menubar, 100% Apple VZ, Standard (Node.js) + Lite (Bun) editions |
| v4.2.0 | Enhanced menubar UI, localhost port forwarding, persistent PostgreSQL, 9p FS |

### Phase 5: Platform Hardening (v5.1.0-beta)
| Release | Key Features |
|---------|-------------|
| v5.1.0-beta | TypeScript strict, Zod v4, Python script conversion, cross-platform CI |
| v0.1.0-alpha.1 | Sequential thinking MCP, gt mayor CLI, Ubuntu/vfkit pivot |
| v0.1.0-workspace-rag | Workspace RAG Extension: MLX + pgvector + ddtrace |

### Special Releases
| Release | Key Features |
|---------|-------------|
| cloud-hypervisor-v1.0.0-alpha | MicroVM runtime, 20-50x faster boot, 30-50% power savings |
| fast-openvscode-vm-v0.1.0 | Packaged OpenVSCode microVM image for fast IDE boot |

---

## 3. Architecture

### 3.1 System Architecture

```
┌─────────────────────────────────────────────────────┐
│                  macOS Host                          │
│  ┌──────────────────────────────────────────────┐   │
│  │           Tauri Desktop App (Rust)            │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────────┐ │   │
│  │  │ Menubar  │ │ Settings │ │ Console View │ │   │
│  │  └──────────┘ └──────────┘ └──────────────┘ │   │
│  │  ┌──────────────────────────────────────────┐│   │
│  │  │        Next.js Web Frontend              ││   │
│  │  │  Monaco Editor │ AI Chat │ Monitoring    ││   │
│  │  └──────────────────────────────────────────┘│   │
│  └──────────────────────────────────────────────┘   │
│                       │                              │
│        Apple Virtualization Framework                │
│                       │                              │
│  ┌──────────────────────────────────────────────┐   │
│  │            Alpine Linux 3.22 VM              │   │
│  │  ┌────────┐ ┌────────┐ ┌──────────────────┐ │   │
│  │  │Dropbear│ │  PG16  │ │ OpenVSCode 1.105 │ │   │
│  │  │SSH:2222│ │  :5432 │ │      :3000       │ │   │
│  │  └────────┘ └────────┘ └──────────────────┘ │   │
│  │  ┌────────┐ ┌────────┐                       │   │
│  │  │Valkey  │ │Docker  │                       │   │
│  │  │  :6379 │ │  :2375 │                       │   │
│  │  └────────┘ └────────┘                       │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

### 3.2 Technology Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Desktop Shell | Tauri | 2.9.1 |
| Desktop Backend | Rust | Latest stable |
| Native UI (macOS) | Swift 5 | macOS 13+ |
| Web Frontend | Next.js | 15.x (App Router) |
| UI Components | shadcn/ui + Tailwind CSS | Latest |
| Code Editor | Monaco Editor | 0.55.1 |
| AI Completion | Monacopilot | 1.2.7 |
| Hypervisor | Apple Virtualization Framework | macOS 13+ |
| VM Manager | vfkit | Latest |
| Guest OS | Alpine Linux | 3.22 |
| Kernel | Linux | 6.x LTS |
| Init System | OpenRC | Alpine default |
| Database | PostgreSQL | 16 |
| Cache | Valkey | 7.2 |
| IDE | OpenVSCode Server | 1.105.1 |
| SSH | Dropbear | Latest |
| Container | Docker CE | 27.4.1 |
| Observability | Datadog + OpenTelemetry | Latest |
| Testing | Jest | 30.x |
| Language | TypeScript (strict) | 5.x |

---

## 4. Desktop Application

### 4.1 macOS Menubar Interface

**Features from v4.0.0 → v4.2.0:**
- Color-coded status indicators (green/yellow/red) using native NSImage
- VM IP address display with click-to-copy
- Service health summary: "Services: X/5 healthy"
- CPU% and Memory MB resource usage
- Interactive control buttons: Start VM, Stop VM, Restart
- Console viewer with green-on-black terminal aesthetic
- Dark/Light mode support via system colors

**Quick Actions:**
- Open SSH Terminal (Terminal.app with pre-filled command)
- Open Web IDE (browser to localhost:3000)
- Copy Connection Strings (PostgreSQL, Valkey, SSH)
- Recent Logs (last 10 lines, click-to-copy)
- Restart All Services

**Keyboard Shortcuts:**
| Shortcut | Action |
|----------|--------|
| Cmd+T | Open SSH Terminal |
| Cmd+O | Open Web IDE |
| Cmd+Shift+R | Restart All Services |
| Cmd+Shift+S | Start VM |
| Cmd+Shift+X | Stop VM |
| Cmd+L | Show Console |
| Cmd+M | Toggle Compact View |
| Cmd+C | Copy IP Address |

**Accessibility:**
- Full VoiceOver support with dynamic labels
- Keyboard navigation for all menu items

### 4.2 Settings Panel

**Tabs:**
| Tab | Settings |
|-----|----------|
| General | Theme (light/dark/system), launch at login, minimize to tray, notifications, language, auto-save |
| Services | Auto-start, ports configuration, timeouts, health monitoring, retry settings |
| AI | Default model, API keys, max tokens, temperature, top P, streaming, code suggestions |
| Advanced | Telemetry, debug mode, log level, data directory, experimental features, proxy |

**Features:**
- Tauri filesystem persistence (desktop) / localStorage (browser)
- Migration support for schema changes
- Import/Export JSON backup
- Real-time validation
- Per-category reset to defaults

### 4.3 Build Artifacts

| Platform | Architecture | Format | Status |
|----------|--------------|--------|--------|
| macOS | Apple Silicon (arm64) | .dmg | Production |
| macOS | Universal | .dmg | Production |
| macOS | Intel (x64) | .dmg | Supported |
| Linux | x86_64 | .AppImage, .deb, .rpm | Build pipeline ready |
| Linux | ARM64 | .deb | Cross-compilation ready |
| Windows | x86_64 | .msi, .exe | Planned |

**Build Commands:**
```bash
npm run build:macos         # macOS universal
npm run build:linux         # Linux all architectures
npm run build:linux:x64     # Linux x64 only
npm run build:linux:arm64   # Linux ARM64 only
npm run build:linux:signed  # With GPG signing
npm run build:windows       # Windows x64
npm run build:all           # All platforms
```

### 4.4 Auto-Update System

| Feature | Detail |
|---------|--------|
| Channels | stable, beta, nightly |
| Source | GitHub Releases API |
| Verification | SHA-256 checksums |
| Platforms | DMG (macOS), AppImage (Linux), EXE/MSI (Windows) |
| Background | Non-blocking download with progress |
| Skip | Users can skip specific versions |
| Mandatory | Critical update support |

---

## 5. Virtual Machine Infrastructure

### 5.1 Hypervisor Configuration

| Property | Value |
|----------|-------|
| Framework | Apple Virtualization Framework (VZ) |
| Manager | vfkit |
| Boot Methods | VZLinuxBootLoader (direct), VZEFIBootLoader (UEFI) |
| CPUs | 4 (configurable via VFKIT_CPUS) |
| Memory | 4096 MB (configurable via VFKIT_MEMORY) |
| Disk | 20GB sparse (configurable) |
| Network | NAT with DHCP |
| Storage | Virtio Block (high-performance I/O) |
| Shared FS | 9p filesystem (/Users/Shared/vibecode-data) |
| Console | Virtio Serial |
| RNG | Virtio RNG |
| Socket | Virtio Vsock |

### 5.2 Guest OS

| Property | Value |
|----------|-------|
| Distribution | Alpine Linux 3.22 |
| Kernel | Linux 6.x LTS (ARM64) |
| Init | OpenRC |
| Shell | ash (BusyBox) |
| Image Size | ~89 MB initramfs |
| Boot Time | ~25 seconds |
| Memory | ~200 MB footprint |

### 5.3 VM Management Features

**Multi-VM Support (v1.6.0+):**
- VM pool manager with up to 4 concurrent VMs
- Dynamic port allocation (range 10000-20000)
- VM profiles: Development, Testing, Minimal, Database
- Resource limits: max 8 CPU cores, 8GB RAM total
- Per-VM resource isolation

**VM Snapshots:**
- Create/restore/delete snapshots
- Compression: zstd (default), gzip, lz4
- SHA-256 integrity verification
- Export/import as tar.gz archives
- Auto-snapshot before risky operations
- Provider support: vfkit, Lima, QEMU

**VM Profiles:**
| Profile | CPUs | RAM | Services |
|---------|------|-----|----------|
| Development | 2 | 2GB | Node.js, Python, Git, ports 3000/5173/8080 |
| Testing | 2 | 1GB | Node.js, Chromium test runners |
| Minimal | 1 | 512MB | SSH only |
| Database | 2 | 2GB | PostgreSQL, Redis, ports 5432/6379 |

### 5.4 Linux Platform Support

| Feature | macOS | Linux |
|---------|-------|-------|
| Hypervisor | Apple VZ + vfkit | QEMU + KVM |
| Detection | Automatic | /etc/os-release parsing |
| Directories | ~/Library/Application Support | XDG spec |
| Notifications | Native | D-Bus (notify-send) |
| Desktop Env | N/A | GNOME, KDE, XFCE detected |
| Display | N/A | X11, Wayland detected |

---

## 6. Services Stack (5-Service Architecture)

### 6.1 Service Configuration

| Service | Version | VM Port | Host Port | Protocol |
|---------|---------|---------|-----------|----------|
| Dropbear SSH | Latest | 22 | 2222 | TCP |
| PostgreSQL | 16 | 5432 | 5432 | TCP |
| Valkey | 7.2 | 6379 | 6379 | TCP (Redis protocol) |
| OpenVSCode Server | 1.105.1 | 8080 | 3000 | HTTP |
| Docker CE | 27.4.1 | 2375 | 2375 | HTTP (Docker API) |

### 6.2 Service Health Monitoring

**Health Check Methods:**
| Service | Method | Endpoint/Command |
|---------|--------|------------------|
| SSH | TCP connection | Port 2222 banner detection |
| PostgreSQL | SQL query | `SELECT 1` via Prisma |
| Valkey | Redis command | `PING` via ioredis |
| OpenVSCode | HTTP GET | `/healthz` or TCP fallback |
| Docker | HTTP GET | `/_ping` Docker API |

**Monitoring Features:**
- 3-second timeout per check
- Parallel execution via Promise.all()
- 5-second TTL caching
- Datadog APM tracing with span tags
- Real-time WebSocket status push (30s heartbeat)
- Aggregated endpoint: `GET /api/health/services`

### 6.3 Service Restart

**API:** `POST /api/services/restart/[serviceName]`

| Service | SSH Command |
|---------|-------------|
| SSH | `rc-service dropbear restart` |
| PostgreSQL | `rc-service postgresql restart` |
| Valkey | `rc-service valkey restart` |
| OpenVSCode | `rc-service openvscode restart` |
| Docker | `rc-service docker restart` |

Features: Rate limited (10/min), authentication required, health verification post-restart.

### 6.4 Access Methods

```bash
# SSH
ssh -p 2222 root@localhost  # password: vibecode

# PostgreSQL
psql -h localhost -U postgres  # database: vibecode

# Valkey
redis-cli -h localhost -p 6379

# OpenVSCode
open http://localhost:3000

# Docker
docker -H tcp://localhost:2375 info
```

---

## 7. AI Integration

### 7.1 Model Support

**Primary Gateway:** OpenRouter (321+ models)

| Provider | Models | Direct API |
|----------|--------|------------|
| Anthropic | Claude 3.5 Sonnet, Claude 3 Opus, Claude 3 Haiku | Yes |
| OpenAI | GPT-4o, GPT-4o Mini, GPT-4 Turbo, GPT-3.5 Turbo | Yes |
| Google | Gemini Pro 1.5, Gemini Flash 1.5 | Via OpenRouter |
| Meta | Llama 3.1 405B/70B/8B | Via OpenRouter |
| Mistral | Mistral Large, Medium, Codestral | Via OpenRouter |
| DeepSeek | Coder V2, Chat | Via OpenRouter |
| Alibaba | Qwen 2.5 72B | Via OpenRouter |
| Local | Ollama (llama3.1, codellama, mistral) | Direct |
| Azure | Azure OpenAI (GPT-4, embeddings) | Direct |
| AWS | Bedrock (stub) | Planned |

### 7.2 AI Features

**Code Completion:**
- Monacopilot integration in Monaco editor (v1.2.7)
- Context-aware suggestions using project files
- Multi-language support

**AI Chat:**
- Streaming responses
- Chat session persistence
- Multiple chat providers
- File upload support
- Collaborative chat mode

**Model Comparison Tool:**
- Side-by-side comparison of up to 4 models
- Card view and table view
- Adjustable criteria: cost, speed, quality, context size
- Quick filter presets: Best for Coding, Best Value, Fastest, etc.
- Model recommendations based on task type

**Cost Estimation & Tracking:**
- Real-time cost tracking per session/day/all-time
- Pre-send cost estimation with confidence levels
- 40+ model pricing database
- Budget alerts with severity levels
- Usage charts (hourly, daily, weekly, monthly)
- Data export (CSV, JSON)

**Prompt Library (33 templates):**
| Category | Templates |
|----------|-----------|
| Code Review | standard, security, performance, quick, pull-request |
| Explain Code | standard, beginner, deep-dive, architecture, changes, quick |
| Refactor | standard, performance, design-patterns, modernize, simplify, extract, quick |
| Generate Tests | unit, integration, e2e, react, api, edge-cases, quick |
| Documentation | jsdoc, readme, api, inline, tech-spec, changelog, architecture, quick |

**Context Window Management:**
- tiktoken-based token counting with model-specific encoders
- File ranking: relevance, recency, proximity, dependencies
- 4 strategies: RECENT_FILES, RELATED_FILES, SEMANTIC, HYBRID
- Import parsing: TypeScript/JS, Python, Go, Rust
- Dependency graph with BFS depth calculation

### 7.3 AI Resilience

**Circuit Breaker Pattern:**
- Three states: CLOSED → OPEN → HALF_OPEN → CLOSED
- Configurable thresholds (default: 5 failures)
- 30-second reset timeout
- Per-provider circuit breakers for 8 providers
- Automatic fallback to healthy providers

**Provider Failover Chains:**
```
openrouter → azure-openai → anthropic → ollama
anthropic → openrouter → azure-openai
openai → openrouter → anthropic
```

---

## 8. Observability

### 8.1 Stack

| Component | Technology | Integration |
|-----------|------------|-------------|
| APM | Datadog | dd-trace-js |
| Logs | Datadog | JSON structured logging |
| Metrics | DogStatsD | UDP port 8135 |
| Traces | OpenTelemetry | OTLP HTTP → Datadog |
| Extension | Datadog VSCode v2.0.0 | 19+ commands, static analysis |

### 8.2 Custom Metrics

- `vibecode.service.*.healthy` - Per-service health
- `circuit_breaker.*` - Circuit breaker state/failures
- `resilient_ai.*` - AI provider latency/fallbacks
- `vibecode.vm.boot_time` - VM boot duration
- `vibecode.ai.cost.*` - AI usage costs

### 8.3 Dashboards

- Service Health Dashboard (infrastructure/dashboards/service-health.json)
- AI Usage & Cost Dashboard
- VM Performance Dashboard
- Connection Pool Monitor (/monitoring/connection-pool)
- Database Monitor (/monitoring/database)
- Embeddings Monitor (/monitoring/embeddings)

---

## 9. Web Application Pages

### 9.1 Existing Pages

| Route | Purpose | Status |
|-------|---------|--------|
| `/` | Landing + dashboard cards | Implemented (Wave 7) |
| `/chat` | AI chat interface | Implemented |
| `/chat/enhanced` | Enhanced AI chat | Implemented |
| `/chat/collaborative` | Collaborative chat | Implemented |
| `/editor` | Monaco code editor | Implemented |
| `/monitoring` | Monitoring dashboard | Implemented |
| `/monitoring/database` | Database metrics | Implemented |
| `/monitoring/embeddings` | Embeddings dashboard | Implemented |
| `/experiments` | Feature experiments | Implemented |
| `/projects` | Project management | Implemented |
| `/workspaces` | Workspace management | Implemented |
| `/onboarding` | First-run setup | Implemented |
| `/marketplace` | Extension marketplace | Implemented |
| `/deploy` | Deployment tools | Implemented |
| `/upload` | File upload | Implemented |
| `/auth/signin` | Authentication | Implemented |
| `/vm` | VM management dashboard | Implemented (Wave 6) |
| `/vm/snapshots` | VM snapshot management | Implemented (Wave 6) |
| `/ai/costs` | AI cost tracking | Implemented (Wave 6) |
| `/ai/models` | Model comparison | Implemented (Wave 6) |
| `/ai/prompts` | Prompt library browser | Implemented (Wave 6) |
| `/settings` | Application settings | Implemented (Wave 6) |
| `/health` | Service health + WebSocket | Implemented (Wave 6+7) |
| `/updates` | Auto-update management | Implemented (Wave 7) |

### 9.2 Shared Navigation & Layouts

| Component | Purpose | Status |
|-----------|---------|--------|
| `AppNavigation` | Responsive top nav with dropdowns | Implemented (Wave 7) |
| `ai/layout.tsx` | AI section sidebar (Chat, Models, Costs, Prompts) | Implemented (Wave 6) |
| `vm/layout.tsx` | VM section sidebar (Dashboard, Logs, Snapshots) | Implemented (Wave 6+9) |

### 9.3 Recently Added (Wave 8)

| Route | Purpose | Status |
|-------|---------|--------|
| `/containers` | Docker container management (list, run, stop, logs) | Implemented (Wave 8) |
| `/ai/chat` | AI chat under AI section layout | Implemented (Wave 8) |
| `/monitoring/alerts` | Service & budget alerts with filtering | Implemented (Wave 8) |

### 9.4 Wave 9 - Component Integration

| Feature | Target | Status |
|---------|--------|--------|
| `useKeyboardShortcuts` hook | Global shortcuts (Cmd+/, Cmd+T, Cmd+O, Cmd+Shift+S/H) | Integrated (Wave 9) |
| `ConsoleModal` | VM dashboard console viewer | Integrated (Wave 9) |
| `/vm/logs` | Terminal-style service log viewer (5 tabs) | Implemented (Wave 9) |
| `OnboardingDrawer` | First-visit experience + settings wizard | Integrated (Wave 10) |
| Settings Import/Export | JSON backup/restore/reset buttons | Implemented (Wave 9) |

### 9.5 Wave 10 - Design System Integration

| Route | Purpose | Status |
|-------|---------|--------|
| `/ai/agents` | Multi-agent workspace with 6 agents, conversations | Implemented (Wave 10) |
| `/ai/conversations` | Chat history browser with search/filter/archive | Implemented (Wave 10) |
| `/monitoring/performance` | API latency, VM metrics, endpoint performance table | Implemented (Wave 10) |

### 9.6 Wave 11 - Monitoring Completeness

| Route | Purpose | Status |
|-------|---------|--------|
| `/monitoring/vector-db` | pgvector collections, queries, index health | Implemented (Wave 11) |
| `/monitoring/api-performance` | 15+ endpoint metrics, latency percentiles, error breakdown | Implemented (Wave 11) |
| `/monitoring/logs` | Centralized log viewer with level/source filters, 35 mock entries | Implemented (Wave 11) |
| `/monitoring/datadog` | APM traces, monitors, services, config, VSCode extension | Implemented (Wave 11) |

---

## 10. Extensions & Plugins

| Extension | Version | Features |
|-----------|---------|----------|
| Workspace RAG | v0.1.0 | MLX-powered RAG, pgvector, ddtrace, workspace indexing |
| Datadog VSCode | v2.0.0 | 19+ commands, static analysis, cloud integration |

---

## 11. System Requirements

### macOS (Primary)
| Requirement | Specification |
|-------------|---------------|
| OS | macOS 13+ (Ventura) |
| Architecture | Apple Silicon (M1/M2/M3/M4) or Intel |
| RAM | 4 GB minimum, 8 GB recommended |
| Disk | 5 GB free space |
| Permissions | Full Disk Access for VZ framework |

### Linux
| Requirement | Specification |
|-------------|---------------|
| OS | Ubuntu 22.04+, Fedora 38+, Arch Linux |
| Architecture | x86_64 or ARM64 |
| Hypervisor | QEMU + KVM |
| RAM | 4 GB minimum |
| Disk | 5 GB free space |

### Windows (Planned)
| Requirement | Specification |
|-------------|---------------|
| OS | Windows 10+ |
| Architecture | x86_64 |
| Hypervisor | WSL2 |

---

## 12. Performance Targets

| Metric | Target | Actual |
|--------|--------|--------|
| VM Boot Time | <45s | ~25s |
| Memory Footprint | <300MB | ~200MB |
| VM Image Size | <100MB | 89MB |
| CPU Overhead | <5% idle | ~2% |
| Service Start | <30s | ~20s |
| MicroVM Boot | <2s | <2s (Cloud Hypervisor) |

---

## 13. Test Coverage

| Metric | Value |
|--------|-------|
| Total Tests | 7,262+ |
| Passing | 7,040+ |
| Failing | 0 |
| Skipped | 63 |
| Coverage (new code) | 87%+ |
| Wave 6 Page Tests | 48 (7 suites) |
| Wave 8 Tests | 38 (3 suites) |
| Wave 9 Tests | 45 (3 suites) |
| Wave 10 Tests | 51 (3 suites) |
| Frameworks | Jest 30.x |

---

## 14. CI/CD

| Pipeline | Technology | Trigger |
|----------|------------|---------|
| Linux Build | GitHub Actions | Push to linux-v*/v* tags |
| macOS Build | Local (Tauri) | `npm run build:macos` |
| Docker Build | Docker Compose | `docker/linux-builder/` |
| Tests | Jest + Datadog CI | PR / Push |

---

*Compiled from 48 GitHub releases by Level 3 Agent Team*
*Last Updated: 2026-02-06*
