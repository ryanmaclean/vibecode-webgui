# vibecode-webgui

Web-based GUI for VibeCode - AI-powered development environment

## 🚀 Quick Demo: Alpine ARM64 VMs with vfkit

**Run a complete VibeCode demo in minutes on Apple Silicon!**

```bash
# One-command setup
./scripts/vfkit/setup-demo-environment.sh

# Includes:
# - code-server (Web IDE)
# - PostgreSQL (Database)
# - Valkey (Redis alternative, compiled with musl)
# - nginx (Reverse proxy)
```

**📖 [Complete Demo Guide](./docs/VFKIT_DEMO_GUIDE.md)** | **⚡ [Valkey ARM64 Build](./scripts/vfkit/compile-valkey-musl.sh)**

### Why This Demo?

- ✅ **Native ARM64**: Zero emulation overhead on M-Series Macs
- ✅ **Minimal**: Alpine Linux (~130MB), fast boot (<6s)
- ✅ **Production-Ready**: Real PostgreSQL + Valkey + code-server
- ✅ **Efficient**: 8 CPU cores, 7GB RAM total (leaves plenty free)

---

![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Node](https://img.shields.io/badge/node-18.18.0 25.0.0-brightgreen.svg)
![Next.js](https://img.shields.io/badge/Next.js-15-black.svg)
![React](https://img.shields.io/badge/React-19-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)

A comprehensive AI-powered development platform with advanced monitoring, security, and performance optimization.

> Last updated: October 23, 2025

## Table of Contents

- [Features](#features)
- [Desktop Application](#desktop-application)
- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [API Documentation](#api-documentation)
- [Vibecode CLI](#vibecode-cli)
- [Available Scripts](#available-scripts)
- [Codex Salvage Extractions](#codex-salvage-extractions)
- [eBPF Observability](#ebpf-observability)
- [Dependencies](#dependencies)
- [Development](#development)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [License](#license)

## Features

🚀 **Next.js 15** - Latest React framework with App Router
🤖 **RAG System** - PostgreSQL + pgvector + Valkey for intelligent retrieval
🔒 **Security Hardened** - Comprehensive security middleware and monitoring
📊 **Performance Monitoring** - Real-time metrics with Datadog integration
💾 **Caching Layer** - Valkey (Redis alternative) compiled for ARM64
🗄️ **Database** - PostgreSQL with pgvector for AI embeddings
🧪 **Testing** - Complete testing suite with Jest, Playwright, and TestContainers
📚 **Documentation** - Auto-generated API docs and developer guides
🐳 **Alpine VMs** - Lightweight ARM64 VMs with vfkit
🔧 **TypeScript** - Full type safety with strict configuration

**🌟 [Platform Overview](./docs/PLATFORM_OVERVIEW.md)** - Complete system overview
**📖 [Multi-Agent Workflow Complete](./docs/MULTI_AGENT_WORKFLOW_COMPLETE.md)** - Full implementation
**📖 [RAG System Architecture](./docs/ARCHITECTURE_RAG_SYSTEM.md)** - Complete technical overview
**🛠️ [VibeCode CLI](./cli-tools/README.md)** - Unified development toolkit

## 💻 Desktop Application

VibeCode is available as a native desktop application for macOS, Linux, and Windows!

### Download Latest Release

**[📥 Download VibeCode Desktop](https://github.com/your-repo/releases/latest)**

#### Available Platforms

| Platform | Architectures | Package Formats |
|----------|--------------|-----------------|
| **macOS** | Universal (Intel + Apple Silicon) | `.dmg`, `.app` |
| **Linux** | x86_64, ARM64 | `.deb`, `.AppImage`, `.rpm` |
| **Windows** | x86_64 | `.msi`, `.exe` |

### Quick Installation

**macOS:**
```bash
# Download and install the DMG
# Or use Homebrew (coming soon)
brew install --cask vibecode
```

**Linux (Ubuntu/Debian):**
```bash
# x86_64
sudo dpkg -i VibeCode_*_amd64.deb

# ARM64
sudo dpkg -i VibeCode_*_arm64.deb
```

**Linux (AppImage):**
```bash
chmod +x VibeCode_*_amd64.AppImage
./VibeCode_*_amd64.AppImage
```

**Windows:**
```powershell
# Download and run the MSI or NSIS installer
# Double-click to install
```

### Features

- ✅ **Native Performance** - Built with Tauri and Rust
- ✅ **Cross-Platform** - Consistent experience across all platforms
- ✅ **Auto-Updates** - Automatic updates for new features and fixes
- ✅ **Offline Support** - Full functionality without internet
- ✅ **System Integration** - Native menus, notifications, and tray icons
- ✅ **Code Signed** - Signed and notarized for security

### Compatibility

- `code-server` is not supported on WebKit/Safari and cannot be embedded in Tauri.
- Use a Chromium-based browser (Chrome, Edge, Brave) to access `code-server`.
- Treat the Tauri desktop app as a separate distribution path (not a wrapper around `code-server`).

### Build from Source

Want to build the desktop app yourself? See our comprehensive build guide:

**📖 [Desktop Build Guide](./docs/DESKTOP_BUILD_GUIDE.md)**

Quick build commands:
```bash
# Install dependencies
npm install --legacy-peer-deps

# Build for your platform
npm run tauri:build

# Or use platform-specific scripts
./scripts/desktop/build-macos.sh      # macOS
./scripts/desktop/build-linux.sh      # Linux
./scripts/desktop/build-windows.ps1   # Windows
```

### System Requirements

**macOS:**
- macOS 10.13 or later
- Intel or Apple Silicon processor

**Linux:**
- Ubuntu 20.04+, Debian 11+, Fedora 35+, or similar
- GLIBC 2.31+
- x86_64 or ARM64 processor

**Windows:**
- Windows 10 (build 1809+) or Windows 11
- x86_64 (64-bit) processor

## 🚀 GenAI Development VM

We've set up a **dedicated GenAI VM** with all major AI coding tools for isolated development:

### Quick Access
```bash
# Access the GenAI VM locally
limactl shell vibecode-minimal

# Remote access via Tailscale
ssh studio@100.81.117.81
```

### Installed AI Tools
- ✅ **Claude Code CLI** (`claude`) - v2.0.26
- ✅ **OpenAI Codex CLI** (`codex`) - v0.48.0  
- ✅ **just-every/code** (`coder`) - v0.2.188
- ✅ **Google Gemini CLI** (`gemini`) - v0.10.0
- ✅ **OpenCode** (`opencode`) - v0.15.16
- ✅ **Aider** (`aider`) - Python AI assistant

### Benefits
- **Secure Isolation**: AI tools run in separate VM
- **Cross-Platform Access**: Available via Tailscale from any device
- **No Docker Desktop**: Uses native macOS virtualization (Lima)
- **All Tools Ready**: Pre-installed and configured

📖 **Full Documentation**: [GenAI VM Setup Guide](docs/genai-vm-setup.md)

---

## Quick Start

### Prerequisites

- Node.js >=18.18.0 <25.0.0
- PostgreSQL 16+ with pgvector extension
- Redis 6+ (or Upstash account)
- Docker & Docker Compose (optional)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd vibecode-webgui

# Install dependencies
npm install --legacy-peer-deps

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Start services (optional)
docker-compose -f docker-compose.dev.yml up -d

# Initialize database
npm run db:migrate
npm run db:generate

# Start development server
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to see the application.

## 🧪 Benchmarking References

- Mini-VM vi latency notes and kernel build instructions: [docs/virtualization/minivim-kernel.md](./docs/virtualization/minivim-kernel.md)
- Downloadable bundle: [MiniVim x86_64 (2025-10-02) release](https://github.com/ryanmaclean/vibecode-webgui/releases/tag/minivim-20251002) (`minivim-x86_64-20251002.tar.gz` ships the stripped bzImage, BusyBox binary, initramfs, CPU info, and benchmark JSON)

| Guest | Avg boot-to-vi (3 runs) | vi runtime |
|-------|------------------------|------------|
| BusyBox initramfs (MiniVim kernel) | **4.38 s** | 0.11 s |
| TinyCore 16.2 | 15.1 s | 0.14 s |
| Yocto 5.2.3 core-image-minimal | 12.9 s | 0.08 s |
| OpenWrt 23.05.4 | 18.8 s | 0.07 s |

Raw measurements live in `reports/benchmarks/vim_qemu_results_2025-10-02-stripped.json` and `reports/benchmarks/vim_hypervisor_results_2025-10-02.json`.

#### Quick start (QEMU/Lima/HyperKit)
```bash
# 1. Fetch and unpack the bundle
curl -LO https://github.com/ryanmaclean/vibecode-webgui/releases/download/minivim-20251002/minivim-x86_64-20251002.tar.gz
tar -xzf minivim-x86_64-20251002.tar.gz

# 2. Run the BusyBox vi benchmark in QEMU (exits immediately)
qemu-system-x86_64 \
  -m 256 \
  -kernel bzImage-x86_64-6.12.10-stripped \
  -initrd busybox-initramfs.cpio.gz \
  -append "console=ttyS0 loglevel=3" \
  -nographic

# The initramfs drops to /bin/sh; `vi -u NONE -U NONE -c q` is what the benchmark harness measures.
```
Use the same bzImage/initramfs pair for Lima (`vmType=vz`/`vmType=qemu`) or HyperKit by pointing the guest config at the extracted files. The bundle’s `vim_qemu_results_2025-10-02-stripped.json` captures the latest timings (BusyBox 4.38 s total, TinyCore 15.1 s, Yocto 12.9 s, OpenWrt 18.8 s).

### ⚡ Fast OpenVSCode MicroVM (x86_64 & arm64)

Download the latest archives from the [Fast OpenVSCode release](https://github.com/ryanmaclean/vibecode-webgui/releases/tag/fast-openvscode-vm-v0.1.0):

- `fast-openvscode-vm-*.tar.gz` (x86_64, Hypervisor.framework/KVM)
- `fast-openvscode-vm-arm64-*.tar.gz` (arm64, Virtualization.framework/Colima)

Extract beside the repo and use the helper script:

```bash
# x86_64 (default flow)
tar -xzf fast-openvscode-vm-20251003T015614Z.tar.gz
scripts/benchmarks/vscode_microvm.sh start
curl -I http://127.0.0.1:3600/
scripts/benchmarks/vscode_microvm.sh stop

# arm64 (QEMU on Intel, Virtualization.framework on Apple Silicon)
tar -xzf fast-openvscode-vm-arm64-20251003T022414Z.tar.gz
MICROVM_ARCH=arm64 scripts/benchmarks/vscode_microvm.sh start
curl -I http://127.0.0.1:4600/
MICROVM_ARCH=arm64 scripts/benchmarks/vscode_microvm.sh stop
```

Need a fresh build? Repackage with `scripts/release/package-fast-openvscode-vm.sh fast-openvscode-vm[-arm64]`; new tarballs drop into `dist/` along with `.sha256` files for release uploads. For CI automation, use `scripts/ci/package_microvm.sh` to benchmark and package both arches in one shot.

## 💻 Fast OpenVSCode on macOS Virtualization.framework

- Ships the same `fast-openvscode-vm` payload we use in QEMU, but boots it with Apple’s native hypervisor for lower overhead on modern macOS.
- Works today on Intel Macs (x86_64 kernel + initramfs). Apple Silicon support lands with the arm64 image tracked in [#553](https://github.com/ryanmaclean/vibecode-webgui/issues/553).
- Reuses the BusyBox init that auto-starts our OpenVSCode fork, proxying `/` and `/healthz` while the editor warms up.
- Full release flow (download helper, packaging, verification, pending tasks) is captured in `wiki/FAST_OPENVSCODIUM_RELEASE_FLOW.md`.

### 1. Prerequisites

- macOS 14.6 or newer with the Virtualization entitlement enabled (launch `vfkit` once to grant permissions).
- Xcode command line tools (`xcode-select --install`) for `cpio`/`pkgutil` updates.
- Homebrew packages:

```bash
brew install vfkit gvisor-tap-vsock
```

`vfkit` exposes the Virtualization.framework CLI, while `gvproxy` from gvisor-tap-vsock gives us user-mode networking with dynamic port forwarding.

### 2. Package (or download) the OpenVSCode initramfs

```bash
# from repo root
scripts/release/fetch-openvscode-server.sh   # pulls the latest Gitpod tarball
scripts/release/package-fast-openvscode-vm.sh
ls dist/fast-openvscode-vm-*.tar.gz
```

`fetch-openvscode-server.sh` also writes a `.sha256` beside the tarball so you can verify the download before injecting it into the initramfs. Grab the published release (`fast-openvscode-vm-v0.1.0`) instead if you don’t want to rebuild (see `demos/README.md`).

### 3. Adjust the static IP for gvproxy networking

```bash
REPO_ROOT=$(pwd)
tmpdir=$(mktemp -d)
pushd "$tmpdir"
gzip -dc "$REPO_ROOT/fast-openvscode-vm/openvscode-initramfs.cpio.gz" | cpio -idm
sed -i '' 's/10.0.2.15/192.168.127.2/' init
sed -i '' 's/10.0.2.2/192.168.127.1/' init
find . -print0 | cpio --null -ov --format=newc | gzip > "$REPO_ROOT/fast-openvscode-vm/openvscode-initramfs.cpio.gz"
popd
rm -rf "$tmpdir"
```

> On GNU sed (Linux builders), drop the empty string after `-i`.

### 4. Launch gvproxy for user-mode networking

```bash
gvproxy --listen unix:///tmp/openvscode-net.sock \
        --listen-vfkit unixgram:///tmp/openvscode-vfkit.sock \
        --ssh-port 0 --mtu 1500 &
GVPROXY_PID=$!
```

The UNIX datagram socket lets `vfkit` hand packets to `gvproxy`, which in turn NATs traffic and exposes a REST API for port forwarding.

### 5. Boot the microVM with vfkit

```bash
vfkit \
  --cpus 4 \
  --memory 2048 \
  --bootloader linux,\\
kernel=$PWD/fast-openvscode-vm/vmlinuz-host,\\
initrd=$PWD/fast-openvscode-vm/openvscode-initramfs.cpio.gz,\\
cmdline="\"rdinit=/init console=hvc0 quiet\"" \
  --device virtio-net,unixSocketPath=/tmp/openvscode-vfkit.sock,mac=5a:94:ef:e4:0c:ee \
  --device virtio-serial,stdio
```

When the init script reports “OpenVSCode ready”, note the DHCP lease in `/tmp/openvscode-net.sock` via `curl` (next step).

### 6. Forward the IDE port back to localhost

```bash
# replace 192.168.127.2 if gvproxy handed out a different address
curl --unix-socket /tmp/openvscode-net.sock \
  http:/unix/services/forwarder/expose \
  -X POST -d '{"local":":3600","remote":"192.168.127.2:3000"}'
```

Visit `http://127.0.0.1:3600` to reach the forked OpenVSCode instance. Tear down by killing `vfkit`, undoing the port forward (`forwarder/unexpose`), then stopping `gvproxy`.

### 7. Optional: wrap the IDE in HTTPS (for Safari/iPad testing)

```bash
# run from repo root after the microVM is up
npm run microvm:https
# opens https://127.0.0.1:3443 -> http://127.0.0.1:3600
```

The helper script generates a local certificate (prefers mkcert, falls back to OpenSSL) and proxies HTTPS/WebSocket traffic to the microVM. Trust the certificate in macOS/iPadOS so Safari can treat the workspace as a secure context—extensions will otherwise fail to activate.

### 8. Apple Silicon alternative (preview)

Until the arm64 initramfs is ready, Apple Silicon users can run the same fork inside Apple’s `container` CLI, which spins up per-container micro-VMs on macOS 15.5+. Install the CLI and launch a Kali-derived workspace as a placeholder while #553 lands:

```bash
brew install --cask container
container system start
container run --rm -it kalilinux/kali-rolling
```

Swap in our OpenVSCode OCI image once the arm64 build artifact ships. Apple’s container runtime uses Virtualization.framework under the hood and boots OCI images in under a second.

> Need Rosetta-backed x86 tooling on Apple Silicon? The Virtualization framework now supports Rosetta inside Linux guests—download an ARM ISO and enable Rosetta when provisioning with vfkit or `vzcli`.

> **Heads-up:** Virtualization.framework is macOS-only, so there is no supported path to run these microVMs directly on iPhone or iPad; use a browser pointed at a remote IDE instead.

> **Safari testing tip:** host the editor over HTTPS (mkcert/self-signed certs work locally). WebKit blocks many extension APIs on plain HTTP, so serving the workspace securely is required before validating extensions on iPad.

## Project Structure

```
vibecode-webgui/
├── AppleContainerRuntime/    
├── __mocks__/    
├── archive/    
├── artifacts/    
├── audit-results/    
├── azure/    
├── azure-functions/    
├── bench-images/    
├── bin/    
├── charts/    
├── claudedocs/    
├── cmd/    
├── code-server/    
├── config/    
├── configs/    
├── content/    
├── data/    
├── database/    # Database schemas and migrations
├── datadog/    
├── demo/    
├── demos/    
├── docker/    
├── docs/    # Documentation files
├── examples/    
├── extensions/    # VSCode extensions and tools
├── fast-openvscode-vm/    
├── helm/    
├── homebrew-vibecode/    
├── infrastructure/    
├── k8s/    # Kubernetes deployment manifests
├── kubernetes/    
├── launchd/    
├── litellm/    
├── logs/    
├── macos-fleet-orchestration/    
├── macos-native-build/    
├── macos-services/    
├── macos-vm/    
├── monitoring/    
├── ops/    
├── packages/    
├── performance-results/    
├── playwright-report/    
├── plugins/    
├── prisma/    
├── public/    # Static assets
├── queue-worker/    
├── reports/    
├── requirements/    
├── samples/    
├── scripts/    # Build and utility scripts
├── sdk/    
├── security/    
├── server/    
├── services/    
├── src/    # Source code
├── src-tauri/    
├── swift/    
├── templates/    
├── tests/    # Test files and configurations
├── tmp/    
├── tmp-codeium-example/    
├── tofu/    
├── types/    
├── vibecode-pgvector/    
├── watermarkpodautoscaler/    
├── web-dashboard/    
├── wiki/    
└── package.json
```

### Key Directories

- **src/app/** - Next.js app router pages and API routes
- **src/components/** - Reusable React components
- **src/lib/** - Utility functions and shared services
- **src/hooks/** - Custom React hooks
- **tests/** - Test files (unit, integration, E2E)
- **docs/** - Documentation and guides

## API Documentation

The application provides REST API endpoints for various functionalities:

### Core Endpoints

#### Agent-builder

- `/api/agent-builder/session`

#### Agents

- `/api/agents/[...path]`

#### Ai

- `/api/ai/chat`
- `/api/ai/chat/enhanced`
- `/api/ai/chat/stream`
- `/api/ai/chat/unified`
- `/api/ai/conversations/[workspaceId]`
- `/api/ai/function-call`
- `/api/ai/generate-project`
- `/api/ai/huggingface-chat`
- `/api/ai/huggingface-init`
- `/api/ai/litellm`
- `/api/ai/management`
- `/api/ai/model-selection`
- `/api/ai/provider-health`
- `/api/ai/search`
- `/api/ai/sequential-thinking`
- `/api/ai/upload`
- `/api/ai/web-search`

#### Auth

- `/api/auth/[...nextauth]`
- `/api/auth/login-tracking`
- `/api/auth/mfa/setup`
- `/api/auth/mfa/verify`
- `/api/auth/saml/metadata`
- `/api/auth/saml/sso`

#### Chat

- `/api/chat/mongodb`
- `/api/chat/mongodb-simple`
- `/api/chat/stream`

#### Claude

- `/api/claude/analyze`
- `/api/claude/chat`
- `/api/claude/generate`
- `/api/claude/session`

#### Code-completion

- `/api/code-completion`

#### Code-server

- `/api/code-server/session`
- `/api/code-server/session/[sessionId]`

#### Containers

- `/api/containers`
- `/api/containers/[id]`

#### Docker

- `/api/docker/status`

#### Docs

- `/api/docs/search`

#### Experiments

- `/api/experiments`

#### Files

- `/api/files`
- `/api/files/sync`

#### Gradio

- `/api/gradio/run`

#### Health

- `/api/health`
- `/api/health/connection-pool`
- `/api/health/database`
- `/api/health/database/metrics`
- `/api/health/db`
- `/api/health/simple`
- `/api/health/vector-db`
- `/api/health/vector-metrics`

#### Healthz

- `/api/healthz`

#### Monitoring

- `/api/monitoring/azure-embedding`
- `/api/monitoring/cache`
- `/api/monitoring/connection-pool/dashboard`
- `/api/monitoring/dashboard`
- `/api/monitoring/embeddings`
- `/api/monitoring/metrics`
- `/api/monitoring/otel-config`
- `/api/monitoring/page-load`
- `/api/monitoring/performance`
- `/api/monitoring/pool`
- `/api/monitoring/pool-alerts`
- `/api/monitoring/rum`
- `/api/monitoring/security`
- `/api/monitoring/traces`
- `/api/monitoring/user-journey`
- `/api/monitoring/web-vitals`

#### Ollama

- `/api/ollama/models`

#### Projects

- `/api/projects/template`

#### Readyz

- `/api/readyz`

#### Security

- `/api/security/csp-report`

#### Templates

- `/api/templates`

#### Terminal

- `/api/terminal/session`
- `/api/terminal/ws`

#### Test-db

- `/api/test-db`

#### Uploads

- `/api/uploads/pdf`

#### User

- `/api/user/preferences`

#### Vector-search

- `/api/vector-search`

#### Vector-store

- `/api/vector-store`

#### Workspace

- `/api/workspace/[id]/init-goose`
- `/api/workspace/auto-scaling`

#### Workspaces

- `/api/workspaces`
- `/api/workspaces/[id]`

For endpoint details and request/response examples, see [`docs/src/content/docs/api-reference.md`](docs/src/content/docs/api-reference.md).

## Vibecode CLI

The Vibecode CLI provides a unified, interactive interface for all platform operations - from development and testing to deployment and monitoring.

### Quick Start

```bash
# Install the CLI
bash scripts/vibecode-cli/install.sh

# Launch interactive menu
bash scripts/vibecode-cli.sh
```

### Features

The CLI organizes operations into 6 main categories:

#### 1. Development & Testing
- Local development setup and teardown
- Test execution (unit, integration, e2e)
- Code quality checks (lint, format, type-check)
- Build and compilation

#### 2. Security & Compliance
- Dependency vulnerability scanning
- Secret detection
- Security audits and monitoring
- Compliance validation

#### 3. Database Operations
- Schema migrations
- Database seeding and backups
- Performance tuning
- Connection testing

#### 4. Deployment Automation
- Multi-environment deployment (dev, staging, prod)
- Platform-specific deployment (AKS, Fly.io, Docker)
- Rollback capabilities
- Deployment validation

#### 5. VM Management
- VM creation and lifecycle
- Configuration and provisioning
- Snapshot management
- Resource monitoring

#### 6. Monitoring & Observability
- **Datadog Setup** - APM, DBM, CNM, and LLM observability
- **Performance Baselines** - Record, view, and compare system performance
- **Log Analysis** - View, search, and tail application logs
- **Metrics Dashboards** - System and application metrics
- **Health Checks** - System, services, and dependency validation
- **Security Monitoring** - Continuous threat detection

### Example: Deploy Monitoring Stack

```bash
# Launch CLI
bash scripts/vibecode-cli.sh

# Navigate: 6) Monitoring & Observability
# Select: 1) Deploy Datadog Monitoring Stack
# Choose: 1) Docker Compose
# Enter your Datadog API key

# Result: Complete monitoring stack deployed with:
# - Datadog agent for APM
# - Log collection
# - Metrics collection
# - Database monitoring
```

### Example: Performance Baseline

```bash
# Record baseline before optimization
# Navigate: 6) Monitoring & Observability
# Select: 7) Record Performance Baseline
# Name: "pre-optimization"

# Make your changes...

# Record new baseline
# Select: 7) Record Performance Baseline
# Name: "post-optimization"

# Compare results
# Select: 9) Compare Performance Baselines
# Shows side-by-side performance metrics
```

### Documentation

- **User Guide**: [scripts/VIBECODE_CLI.md](scripts/VIBECODE_CLI.md) - Complete usage guide
- **Architecture**: [scripts/vibecode-cli-lib/README.md](scripts/vibecode-cli-lib/README.md) - Technical documentation

### Script Mapping

Legacy scripts are now organized into the CLI:

| Original Script | CLI Menu Path |
|----------------|---------------|
| `deploy-monitoring.sh` | Monitoring > Deploy Datadog Monitoring Stack |
| `setup-azure-openai-monitoring.sh` | Monitoring > Setup Azure OpenAI Monitoring |
| `security-monitoring.sh` | Monitoring > Start Security Monitoring |
| `test-monitoring.sh` | Monitoring > Validate Monitoring Setup |

See [scripts/VIBECODE_CLI.md](scripts/VIBECODE_CLI.md) for complete mapping.

## Available Scripts

### Development

### Development

```bash
npm run dev
```
Start development server with monitoring

```bash
npm run dev:simple
```
Start development server without monitoring

```bash
npm run build
```
Build production application

```bash
npm run start
```
Start production server

```bash
npm run lint
```
Run ESLint code linting

```bash
npm run type-check
```
Run TypeScript type checking


### Testing

```bash
npm run test
```
Run unit tests

```bash
npm run test:watch
```


```bash
npm run test:e2e
```
Run end-to-end tests

```bash
npm run test:integration
```
Run integration tests

```bash
npm run test:security
```
Run security tests


### Database

```bash
npm run db:migrate
```
Deploy database migrations


### Monitoring

```bash
npm run monitoring:health
```
Check system health

```bash
npm run monitoring:metrics
```
View performance metrics


### Security

```bash
npm run security:test
```
Run security vulnerability scan

```bash
npm run security:audit
```



### Documentation

```bash
npm run docs:validate
```
Validate documentation accuracy

```bash
npm run docs:stats
```


## Codex Salvage Extractions

**Date**: October 24, 2025  
**Source**: Codex Salvage Branch (1,762 commits, 121K files)  
**Status**: ✅ **Selective Extraction Complete**

### 🎯 **Strategic Approach**

Instead of merging the massive salvage branch (which would have been risky), we used a **selective extraction strategy** to recover the most valuable content while preserving our consolidated codebase.

### ✅ **Valuable Content Extracted**

#### **💰 GitHub Actions Cost Optimization**
- **Problem**: $100/month GitHub Actions bill
- **Solution**: Release branch strategy with 70-80% cost reduction
- **Implementation**: Optimization scripts and workflow improvements
- **Status**: Added to TODO.md for immediate action

#### **🏥 Health Route Test Suite**
- **Complete test file**: `src/app/api/health/__tests__/route.test.ts`
- **Comprehensive coverage**: Database, Valkey, AI service health checks
- **Proper mocking**: Jest configuration with monitoring mocks
- **Status**: Applied to current codebase

#### **🧩 TypeScript Follow-ups**
- **Collaborative editing stack**: Yjs provider awareness fixes
- **Template marketplace**: Props alignment and type safety
- **Monaco editor**: Configuration improvements
- **Zustand middleware**: Generic helpers for type safety
- **Status**: Added to TODO.md for systematic implementation

#### **🔧 CI Failures Fix**
- **Logger circular dependency**: Monitoring.ts fixes
- **Jest parameters**: Deprecated CLI parameter updates
- **Workflow conflicts**: Merge conflict resolutions
- **Status**: Documented for future application

### 📊 **Extraction Statistics**

- **Commits analyzed**: 5 most recent and valuable
- **Files extracted**: 3 key files + documentation
- **Lines added**: 4,146 insertions
- **Documentation enhanced**: TODO.md significantly improved
- **Test coverage**: Health route tests restored

### 🎉 **Result**

**Successfully extracted the most valuable content from the massive salvage branch without risking our consolidated state!**

## eBPF Observability

**Date**: October 24, 2025  
**Source**: Codex Salvage Branch eBPF Implementation  
**Status**: ✅ **Complete Implementation Extracted**

### 🐧 **Alpine Linux eBPF Support**

**YES - Alpine CAN run eBPF!**

- **Alpine 6.6.68 kernel** with BTF (BPF Type Format) support
- **Full eBPF toolchain**: bpftool, bpftrace, BCC tools
- **CO-RE support**: Compile Once - Run Everywhere
- **<1% performance overhead** achieved
- **Perfect for VMs**: Minimal footprint with maximum observability

### 🔧 **Complete eBPF Implementation**

#### **VM Lifecycle Monitoring** (280 lines)
- Boot time measurement with nanosecond precision
- Per-VM statistics tracking
- Resource usage monitoring

#### **Network Monitoring** (417 lines)
- Real-time latency tracking
- Protocol analysis
- Throughput monitoring

#### **Performance Scripts**
- `profile-cpu.bt` - CPU profiling at 99Hz
- `memory-alloc.bt` - Memory allocation tracking
- `network-latency.bt` - Network latency breakdown

### 📊 **Datadog Integration**

- **TypeScript client**: Complete metrics collection
- **StatsD forwarding**: Real-time metrics to Datadog
- **Custom dashboards**: VM performance visualization
- **Event API**: Rich alerting and context

### 🛠️ **Build System**

- **Makefile**: Complete eBPF compilation system
- **BTF validation**: Kernel compatibility checks
- **Alpine packages**: Automated dependency installation
- **Testing framework**: Comprehensive validation

### 📁 **Files Created**

- `src/lib/ebpf/integration/datadog-integration.ts` - Complete Datadog client
- `src/lib/ebpf/Makefile` - Build system for eBPF programs
- `docs/ebpf-alpine-datadog-analysis.md` - Comprehensive compatibility analysis
- `src/lib/ebpf/EBPF_OBSERVABILITY_IMPLEMENTATION_546.md` - Full documentation

### 🚀 **Benefits**

- **Zero-copy monitoring**: Direct kernel-to-userspace data transfer
- **Real-time insights**: Sub-millisecond latency monitoring
- **Minimal resource usage**: Perfect for Alpine's minimal footprint
- **Production ready**: Complete implementation with <1% overhead
- **Datadog native**: Full integration with existing monitoring stack

### 🎯 **Next Steps**

The eBPF implementation is now ready for:
1. **Alpine VM deployment** with eBPF monitoring
2. **Datadog dashboard creation** for VM performance
3. **Real-time alerting** for performance anomalies
4. **Production monitoring** of your vfkit/Alpine VMs

## Dependencies

### Core Technologies

- **next** (15.5.3) - React framework for production
- **react** (19.1.1) - JavaScript library for user interfaces
- **tailwindcss** (4.0.0) - Utility-first CSS framework
- **@prisma/client** (6.12.0) - Type-safe database client
- **redis** (5.8.3) - In-memory data structure store
- **next-auth** (^4.24.11) - Authentication library for Next.js
- **openai** (^4.104.0) - OpenAI API client
- **dd-trace** (5.72.0) - Datadog tracing library

### Development Dependencies

Key development tools include Jest, Playwright, ESLint, and Prisma CLI.

See [package.json](package.json) for complete dependency list.

## Development

### Environment Setup

1. Copy environment template:
   ```bash
   cp .env.example .env.local
   ```

2. Configure required environment variables:
   - Database connection string
   - Redis connection string
   - API keys for AI services
   - Authentication secrets

3. Start development services:
   ```bash
   docker-compose -f docker-compose.dev.yml up -d
   ```

### Code Quality

- **TypeScript**: Strict mode enabled with comprehensive type checking
- **ESLint**: Code quality and consistency enforcement
- **Prettier**: Automated code formatting
- **Husky**: Git hooks for pre-commit validation

### Testing Strategy

- **Unit Tests**: Jest with React Testing Library
- **Integration Tests**: API and database integration testing
- **E2E Tests**: Playwright for browser automation
- **Security Tests**: Automated vulnerability scanning

### Development Workflow

1. Create feature branch: `git checkout -b feature/your-feature`
2. Make changes and test: `npm run test && npm run test:e2e`
3. Check code quality: `npm run lint && npm run type-check`
4. Submit pull request with tests and documentation

## Deployment

### Production Environment

The application supports multiple deployment strategies:

#### Docker Deployment

```bash
# Build production image
docker build -t vibecode-webgui .

# Run with dependencies
docker-compose -f docker-compose.prod.yml up -d

# Run database migrations
docker-compose exec app npm run db:migrate
```

#### Environment Variables

Required environment variables for production:

- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `NEXTAUTH_SECRET` - Authentication secret key
- `OPENAI_API_KEY` - OpenAI API key
- `ANTHROPIC_API_KEY` - Anthropic API key
- `DD_API_KEY` - Datadog API key (optional)

#### Health Checks

Monitor application health:

```bash
curl http://localhost:3000/api/monitoring/performance?action=health
```

## Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

**Code of Conduct**: This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you agree to uphold this code.

### Quick Contribution Guide

1. **Fork** the repository
2. **Clone** your fork locally
3. **Create** a feature branch
4. **Make** your changes with tests
5. **Run** the test suite
6. **Submit** a pull request

### Code Standards

- Follow TypeScript best practices
- Write comprehensive tests
- Update documentation
- Use conventional commit messages
- Ensure security best practices

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**Need Help?** 
- Check the [Developer Guide](docs/src/content/docs/developer-guide.md)
- Review [API Documentation](docs/src/content/docs/api-reference.md)
- **Troubleshooting**: [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) for common issues and solutions
- Run health checks: `npm run perf:health`
- View monitoring: `http://localhost:3000/api/monitoring/performance`
