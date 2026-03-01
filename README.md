# VibeCode Studio (v5.1.0-beta)

> **🚨 Emergency Release (Feb 2026)** - The "Ruthless" Edition

<div align="center">

[![Version](https://img.shields.io/badge/version-5.1.0--beta-blue.svg)](#)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18.18.0%20%3C25.0.0-brightgreen.svg)](https://nodejs.org/)
[![npm](https://img.shields.io/badge/npm-%3E%3D9.0.0-red.svg)](https://www.npmjs.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9.3-blue.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

[![Next.js](https://img.shields.io/badge/Next.js-16.1.6-black.svg?logo=next.js&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2.4-61dafb.svg?logo=react&logoColor=white)](https://reactjs.org/)
[![Monaco Editor](https://img.shields.io/badge/Monaco%20Editor-0.55.1-0078d7.svg)](https://microsoft.github.io/monaco-editor/)
[![Tauri](https://img.shields.io/badge/Tauri-2.10.0-FFC131.svg?logo=tauri&logoColor=white)](https://tauri.app/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791.svg?logo=postgresql&logoColor=white)](https://www.postgresql.org/)

[![AI Models](https://img.shields.io/badge/AI%20Models-321%2B-purple.svg)](docs/ARCHITECTURE.md#ai-services)
[![Kubernetes](https://img.shields.io/badge/Kubernetes-Ready-326ce5.svg?logo=kubernetes&logoColor=white)](https://kubernetes.io/)
[![Docker](https://img.shields.io/badge/Docker-Supported-2496ED.svg?logo=docker&logoColor=white)](https://www.docker.com/)
[![Open Source](https://img.shields.io/badge/Open%20Source-%E2%9D%A4-red.svg)](https://opensource.org/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

</div>

---

## 📋 Table of Contents

- [🎯 What is VibeCode?](#-what-is-vibecode)
  - [Why VibeCode?](#why-vibecode)
  - [vs. Cursor / GitHub Copilot / VS Code](#vs-cursor--github-copilot--vs-code)
  - [Who Should Use VibeCode?](#who-should-use-vibecode)
- [✨ Features](#-features)
- [🤖 AI-Powered Development](#-ai-powered-development)
  - [Multi-Provider AI Access](#-multi-provider-ai-access)
  - [Key AI Features](#-key-ai-features)
  - [Getting Started with AI](#-getting-started-with-ai)
  - [Learn More](#-learn-more)
- [🏗️ Architecture Overview](#️-architecture-overview)
  - [System Architecture](#system-architecture)
  - [Key Architecture Components](#key-architecture-components)
  - [Detailed Documentation](#detailed-documentation)
- [🖥️ Canonical Desktop Runtime: Tauri](#️-canonical-desktop-runtime-tauri)
  - [Why Tauri?](#why-tauri)
  - [Platform Support](#platform-support)
  - [Getting Started with Tauri](#getting-started-with-tauri)
  - [Quick Launch](#quick-launch)
- [📋 Prerequisites and System Requirements](#-prerequisites-and-system-requirements)
  - [Required Software](#required-software)
  - [Operating System Requirements](#operating-system-requirements)
  - [Database Requirements](#database-requirements)
  - [Optional Dependencies](#optional-dependencies)
  - [Hardware Requirements](#hardware-requirements)
  - [Development Tools (Optional)](#development-tools-optional)
  - [API Keys and Services](#api-keys-and-services)
  - [Network Requirements](#network-requirements)
  - [Browser Support (Web Mode)](#browser-support-web-mode)
- [🚀 Quick Start](#-quick-start)
  - [New to VibeCode? Start Here!](#new-to-vibecode-start-here)
  - [1. Install Dependencies](#1-install-dependencies)
  - [2. Launch Backend (Ubuntu VM)](#2-launch-backend-ubuntu-vm)
  - [3. Launch Studio](#3-launch-studio)
- [🔧 Troubleshooting](#-troubleshooting)
  - [Node.js Version Issues](#nodejs-version-issues)
  - [vfkit Installation (macOS)](#vfkit-installation-macos)
  - [Port Conflicts](#port-conflicts)
  - [Database Connection Issues](#database-connection-issues)
  - [Docker Setup Problems](#docker-setup-problems)
  - [Tauri Build Failures](#tauri-build-failures)
  - [Python/pip Issues](#pythonpip-issues)
  - [AI Provider API Errors](#ai-provider-api-errors)
  - [Platform-Specific Issues](#platform-specific-issues)
  - [Still Having Issues?](#still-having-issues)
- [🛠️ CLI Tool](#️-cli-tool)
- [🖥️ Menubar App](#️-menubar-app)
- [🔄 Ralph Loop](#-ralph-loop)
- [📦 Legacy & Migration](#-legacy--migration)
- [🍎 Native macOS Virtualization](#-native-macos-virtualization)
- [🐳 Docker Option (Lightweight)](#-docker-option-lightweight)
- [GitHub Actions Cost Optimization](#github-actions-cost-optimization)
  - [Main Branch (Lightweight)](#main-branch-lightweight)
  - [Release Branches (Comprehensive)](#release-branches-comprehensive)
  - [Creating Release Branches](#creating-release-branches)
- [🔒 Security Considerations](#-security-considerations)
  - [Environment Isolation](#environment-isolation)
  - [✅ What It Protects Against](#-what-it-protects-against)
  - [❌ What It Does NOT Protect Against](#-what-it-does-not-protect-against)
  - [Attack Vectors](#attack-vectors)
  - [For True Security Isolation](#for-true-security-isolation)
  - [Recommendation](#recommendation)
- [🤝 Contributing & Community](#-contributing--community)
  - [Contributing](#contributing)
  - [Getting Help](#getting-help)
  - [Community Channels](#community-channels)
  - [Reporting Issues](#reporting-issues)
  - [License](#license)

---

## 🎯 What is VibeCode?

**VibeCode is a next-generation AI-native IDE** that brings the power of 321+ AI models directly into your development workflow. Unlike traditional IDEs with AI bolt-ons, VibeCode is built from the ground up for AI-assisted development, combining the flexibility of VS Code with unprecedented AI model access and semantic code intelligence.

### Why VibeCode?

**For Solo Developers:**
- 🤖 **Access 321+ AI Models** - OpenAI, Anthropic, Gemini, Groq, DeepSeek, and more from one interface
- 🔍 **Semantic Code Search** - Find code by meaning, not just keywords, powered by pgvector
- ✨ **Real-time AI Completion** - Context-aware suggestions powered by Monaco Editor and Monacopilot
- 🏠 **Run Anywhere** - Cloud, self-hosted, or fully offline with local LLMs via Ollama

**For Teams:**
- 👥 **Real-time Collaboration** - WebSocket-based collaborative editing with shared AI context
- 🔒 **Self-Hosted Option** - Full data control with on-premise deployment
- 🎯 **Unified AI Stack** - One platform for all team AI needs, no vendor lock-in
- 📊 **Shared Knowledge** - Team-wide semantic search across all codebases

### vs. Cursor / GitHub Copilot / VS Code

| Feature | VibeCode | Cursor | GitHub Copilot | VS Code |
|---------|----------|--------|----------------|---------|
| **AI Models** | 321+ providers | 4 models | 1 model | Via extensions |
| **Self-Hosted** | ✅ Full control | ❌ Cloud only | ❌ Cloud only | ✅ Local only |
| **Semantic Search** | ✅ Vector DB (pgvector) | ⚠️ Basic | ❌ None | ⚠️ Keyword only |
| **Real-time Collab** | ✅ Built-in | ❌ None | ❌ None | ⚠️ Live Share |
| **Open Source** | ✅ MIT License | ❌ Proprietary | ❌ Proprietary | ✅ MIT License |
| **Local LLMs** | ✅ Ollama integration | ❌ Cloud only | ❌ Cloud only | ⚠️ Manual setup |
| **Multi-Provider** | ✅ OpenRouter + Direct | ⚠️ Limited | ❌ Single | ⚠️ Extension-dependent |
| **Agent Orchestration** | ✅ MCP Support | ⚠️ Limited | ❌ None | ❌ None |

**Key Differentiators:**
- ✅ **Model Choice Freedom** - Not locked to a single AI provider
- ✅ **Privacy First** - Self-host everything or run local LLMs offline
- ✅ **Semantic Intelligence** - Vector search understands code context
- ✅ **Transparent & Open** - MIT licensed with full source access
- ✅ **Enterprise Ready** - Kubernetes deployment, Datadog monitoring, PostgreSQL 16

### Who Should Use VibeCode?

- **🧑‍💻 Developers** seeking AI-powered assistance with flexibility to choose the best model for each task
- **👥 Teams** requiring collaborative development environments with integrated AI capabilities
- **🏢 Organizations** needing self-hosted AI development platforms with full data sovereignty
- **🔓 OSS Contributors** wanting to extend, customize, and understand their IDE architecture
- **🔬 AI Researchers** experimenting with multiple LLMs in real development workflows
- **🛡️ Security-Conscious** users requiring on-premise AI without data leaving their network

## ✨ Features

- **🤖 AI-Powered Development**: Multi-provider AI integration (OpenAI, Anthropic, Gemini, Groq, DeepSeek)
- **🔍 Semantic Code Search**: Vector-based code search using pgvector with HNSW indexes
- **📝 Monaco Editor Integration**: Advanced code editing with AI completion via Monacopilot
- **👥 Real-time Collaboration**: WebSocket-based collaborative editing
- **💻 Terminal Integration**: Web-based terminal with node-pty
- **🎯 Onboarding System**: 7-step guided setup for new users
- **🧩 Extension Marketplace**: 53+ VS Code extensions support
- **🔌 MCP Server**: Model Context Protocol for AI integrations
- **🧪 Offline Testing**: Comprehensive cloud infrastructure testing without cloud resources

## 🤖 AI-Powered Development

VibeCode provides **unprecedented access to 321+ AI models** from multiple providers, giving you the freedom to choose the best model for each task. Whether you need cutting-edge reasoning, fast completions, or specialized capabilities, VibeCode has you covered.

### Multi-Provider AI Access

Access the latest and most powerful AI models through multiple integration paths:

#### OpenRouter (321+ Models)
The primary AI gateway providing unified access to models from:
- **OpenAI**: GPT-4, GPT-4 Turbo, GPT-3.5, o1, o1-mini
- **Anthropic**: Claude 3.5 Sonnet, Claude 3 Opus, Claude 3 Haiku
- **Google**: Gemini Pro, Gemini 1.5 Flash, Gemini Ultra
- **Meta**: Llama 3.1 (405B, 70B, 8B), Llama 3
- **Mistral AI**: Mistral Large, Mistral Medium, Mistral Small
- **Cohere**: Command R+, Command R
- **DeepSeek**: DeepSeek-V2, DeepSeek Coder
- **Groq**: Lightning-fast inference for Llama, Mixtral models
- **And 300+ more models** - including specialized models for code, reasoning, and vision tasks

#### Direct Provider APIs

For organizations with existing contracts or specific requirements:
- Direct OpenAI API integration
- Direct Anthropic API integration
- Direct Google AI (Gemini) integration
- Custom API endpoint support

#### Local & Offline AI (Ollama)
Run models entirely on your own hardware for:
- **Complete Privacy**: No data leaves your machine
- **Offline Development**: Work without internet connectivity
- **Cost Savings**: No API usage fees
- **Custom Models**: Use fine-tuned or specialized models

Popular Ollama models supported:
- CodeLlama, StarCoder, WizardCoder (specialized for code)
- Llama 3.1, Llama 3, Mistral, Mixtral (general purpose)
- Phi-3, Gemma (lightweight, fast inference)

### ✨ Key AI Features

#### **🔍 Semantic Code Search**
Powered by PostgreSQL 16 with pgvector extension:
- **HNSW Indexing**: Fast approximate nearest neighbor search
- **Code Embeddings**: Understand code meaning, not just syntax
- **Natural Language Queries**: "Find authentication logic" → relevant code
- **Cross-Repository Search**: Search across all your projects simultaneously

#### **💬 AI Chat & Completion**
- **Streaming Responses**: See AI output in real-time
- **Context-Aware**: Automatically includes relevant code context
- **Multi-Turn Conversations**: Maintain conversation history
- **Code Suggestions**: Inline completions via Monacopilot integration

#### **🔌 Model Context Protocol (MCP)**
VibeCode implements the Model Context Protocol for advanced AI integrations:
- **Tool Use**: AI can interact with external tools and APIs
- **Agent Orchestration**: Multi-step AI workflows
- **Custom Integrations**: Extend AI capabilities with MCP servers
- **Standardized Interface**: Compatible with MCP-enabled tools

#### **🎯 Smart Model Selection**
Choose the right model for each task:
- **Code Generation**: DeepSeek Coder, GPT-4, Claude 3.5 Sonnet
- **Fast Completions**: Groq-hosted Llama, GPT-3.5 Turbo
- **Complex Reasoning**: Claude 3 Opus, GPT-4, o1
- **Cost Optimization**: Smaller models for simple tasks, larger for complex

### 🚀 Getting Started with AI

1. **Set up API keys** in your environment:
   ```bash
   # OpenRouter (easiest - access to 321+ models)
   export OPENROUTER_API_KEY=sk-or-...

   # Or direct provider APIs
   export OPENAI_API_KEY=sk-...
   export ANTHROPIC_API_KEY=sk-ant-...
   ```

2. **Or use Ollama for offline AI** (no API key needed):
   ```bash
   # Install Ollama
   curl -fsSL https://ollama.com/install.sh | sh

   # Pull a model
   ollama pull codellama
   ollama pull llama3.1
   ```

3. **Start coding with AI assistance!** - VibeCode automatically detects available providers and models.

### 📚 Learn More

- **[AI Architecture](docs/ARCHITECTURE.md#ai-services)** - Technical deep dive into AI implementation and supported models
- **[MCP Integration Guide](examples/mcp-servers/README.md)** - Extend AI capabilities with MCP

## 🏗️ Architecture Overview

VibeCode is an AI-powered development platform built on a modern, cloud-native technology stack. The system provides a web-based IDE with integrated AI assistance, semantic code search, and collaborative development features.

### System Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        Browser[Web Browser]
        Monaco[Monaco Editor 0.53.0]
    end

    subgraph "Application Layer"
        NextJS[Next.js 15 App Router]
        React[React 19]
        API[API Routes]
    end

    subgraph "Service Layer"
        AI[AI Services]
        Vector[Vector Search]
        Collab[Collaboration]
        Terminal[Terminal Service]
    end

    subgraph "Data Layer"
        Postgres[(PostgreSQL 16 + pgvector)]
        Cache[(Redis/Valkey)]
        VectorDB[(Vector Store)]
    end

    subgraph "Infrastructure Layer"
        K8s[Kubernetes]
        Docker[Docker]
        Datadog[Datadog Monitoring]
    end

    Browser --> NextJS
    Monaco --> NextJS
    NextJS --> API
    API --> AI
    API --> Vector
    API --> Collab
    API --> Terminal
    AI --> Postgres
    Vector --> Postgres
    Vector --> VectorDB
    Collab --> Cache
    NextJS --> Postgres
    NextJS --> Cache
    K8s --> Docker
    Docker --> NextJS
    Datadog -.-> K8s
    Datadog -.-> Postgres
    Datadog -.-> NextJS
```

### Key Architecture Components

- **Client Layer**: Monaco Editor 0.53.0 integrated with React 19 for advanced code editing
- **Application Layer**: Next.js 15 with App Router for modern React development
- **Service Layer**: AI services, vector search, collaboration, and terminal integration
- **Data Layer**: PostgreSQL 16 with pgvector for semantic search, Redis/Valkey for caching
- **Infrastructure Layer**: Kubernetes orchestration with Docker containers, Datadog monitoring

### Detailed Documentation

For comprehensive architecture information including:
- Complete technology stack and versions
- Architecture Decision Records (ADRs)
- Core subsystems and integration details
- Security architecture
- Deployment models
- Scalability considerations

**See: [Architecture Documentation](docs/ARCHITECTURE.md)** | **[Architecture Diagrams](docs/ARCHITECTURE_DIAGRAM.md)** | **[Folder Structure](docs/FOLDER_STRUCTURE.md)**

## 🖥️ Canonical Desktop Runtime: Tauri

**Tauri is the official and canonical desktop runtime for VibeCode Studio.** It provides a secure, lightweight, and cross-platform foundation for delivering the VibeCode desktop experience.

### Why Tauri?

- **Cross-Platform Native**: Single codebase for macOS, Windows, and Linux
- **Small Bundle Size**: ~3-5MB base runtime (vs 100MB+ Electron alternatives)
- **Security First**: Rust-based backend with granular security permissions
- **Native Performance**: Direct system API access without overhead
- **Web Standards**: Leverages platform-native WebView (WebKit on macOS/Linux, WebView2 on Windows)
- **Modern Stack Integration**: Seamless integration with Next.js 15 and React 19

### Platform Support

- **macOS**: 10.13 (High Sierra) or later (Intel and Apple Silicon)
- **Windows**: Windows 10 or later (64-bit)
- **Linux**: Ubuntu 20.04+, Fedora 35+, or equivalent

### Getting Started with Tauri

For detailed platform-specific setup instructions including Rust installation, system dependencies, and comprehensive troubleshooting:

**📖 [Tauri Desktop Setup Guide](docs/setup/TAURI_DESKTOP_SETUP.md)**

### Quick Launch

```bash
# Development mode with hot reload
npm run tauri:dev

# Production build
npm run tauri:build
```

## 📋 Prerequisites and System Requirements

Before getting started with VibeCode, ensure your system meets the following requirements:

### Required Software

#### Node.js and npm
- **Node.js**: `>=18.18.0 <25.0.0`
- **npm**: `>=9.0.0`

```bash
# Check your versions
node --version
npm --version
```

> **Note**: We recommend using [nvm](https://github.com/nvm-sh/nvm) (Node Version Manager) to manage Node.js versions.

#### Python
- **Python**: `>=3.8`
- **pip**: Latest version

```bash
# Check your version
python3 --version
pip --version
```

### Operating System Requirements

VibeCode supports the following operating systems:

| OS | Minimum Version | Recommended | Architecture |
|---|---|---|---|
| **macOS** | 10.13 (High Sierra) | 12.0+ (Monterey) | Intel & Apple Silicon |
| **Linux** | Ubuntu 20.04+ | Ubuntu 22.04+ | x86_64, ARM64 |
| | Fedora 35+ | Fedora 38+ | x86_64, ARM64 |
| **Windows** | Windows 10 (64-bit) | Windows 11 | x86_64 |

### Database Requirements

#### Required
- **PostgreSQL**: `16.x`
- **pgvector extension**: Latest version (for semantic search)

#### Optional
- **Redis**: `>=6.0` or **Valkey** (for caching and collaboration features)

### Optional Dependencies

Depending on your deployment mode, you may need:

#### Desktop Application (Tauri)
- **Rust**: `>=1.70`
- **Cargo**: Latest version
- **Platform-specific WebView**:
  - macOS: Built-in WebKit
  - Linux: webkit2gtk
  - Windows: WebView2

See [Tauri Desktop Setup Guide](docs/setup/TAURI_DESKTOP_SETUP.md) for detailed installation.

#### Native macOS Virtualization
- **macOS**: 13.0+ (Ventura or later, for ASIF support)
- **vfkit**: Latest version
  ```bash
  brew install vfkit
  ```

#### Container Deployment
- **Docker**: `>=20.10`
- **Docker Compose**: `>=2.0`

#### Production Deployment
- **Kubernetes**: `>=1.24`
- **kubectl**: Matching cluster version
- **Helm**: `>=3.0` (optional, for chart deployment)

#### Monitoring (Optional)
- **Datadog Agent**: Latest version (for production monitoring)

### Hardware Requirements

#### Minimum
- **CPU**: 2 cores
- **RAM**: 4GB
- **Storage**: 10GB free space

#### Recommended
- **CPU**: 4+ cores
- **RAM**: 8GB+
- **Storage**: 20GB+ SSD
- **Network**: Stable internet connection for AI model access

#### For Production Deployment
- **CPU**: 8+ cores
- **RAM**: 16GB+
- **Storage**: 100GB+ SSD
- **Network**: Low-latency connection to AI providers

### Development Tools (Optional)

- **Git**: `>=2.30` (for version control)
- **VS Code**: Latest version (for development)
- **Swift**: Latest version (for macOS menubar app)

### API Keys and Services

VibeCode can work with various AI providers. You'll need at least one of:

- **OpenRouter**: API key for multi-provider access (321+ models)
- **OpenAI**: API key for direct access
- **Anthropic**: API key for Claude models
- **Google AI**: API key for Gemini models
- **Groq**: API key for ultra-fast inference
- **DeepSeek**: API key for specialized models
- **Ollama**: For local, offline AI models (no API key needed)

> **Privacy Note**: VibeCode can run completely offline using Ollama for local LLM inference.

### Network Requirements

- **Outbound HTTPS (443)**: For AI provider APIs
- **PostgreSQL (5432)**: For database connections
- **Redis (6379)**: For caching (if using Redis)
- **WebSocket**: For real-time collaboration features

### Browser Support (Web Mode)

- **Chrome/Edge**: Latest 2 versions
- **Firefox**: Latest 2 versions
- **Safari**: 14+

---

## 🚀 Quick Start

> **📖 New to VibeCode?** See the [Environment Setup Guide](docs/ENVIRONMENT_SETUP_GUIDE.md) for detailed configuration instructions.

### 📚 Installation Documentation

**Choose your path:**
- 🎯 **[Installation Master Guide](docs/INSTALLATION_MASTER_GUIDE.md)** - Comprehensive installation guide covering all platforms, dependencies, and troubleshooting
- ✅ **[Quickstart Checklist](docs/QUICKSTART_CHECKLIST.md)** - Step-by-step checklist to get running in under 5 minutes

### New to VibeCode? Start Here!
Get up and running in under 5 minutes:
```bash
npm run quickstart
```
This single command will:
- ✅ Check and install dependencies
- ✅ Set up your development environment
- ✅ Launch all services
- ✅ Open the onboarding wizard
- ✅ Create a sample project for you to explore

📚 **For detailed quickstart flow and troubleshooting**, see [QUICK_START.md](docs/QUICK_START.md)

> **🤝 Want to contribute?** See our [Contributing Guide](CONTRIBUTING.md) for development setup, coding standards, and PR workflows.

### 1. Install Dependencies
```bash
brew install vfkit
pip install -r scripts/requirements.txt
```

### 2. Launch Backend (Ubuntu VM)
You can use the restored CLI tool:
```bash
bin/vibecode-vm start
```
Or run the script directly:
```bash
python3 scripts/launch_ubuntu_vm.py
```

### 3. Launch Studio
```bash
npm run tauri:dev
```

## 🔧 Troubleshooting

Encountering issues during setup or runtime? Here are solutions to common problems:

### Node.js Version Issues

**Problem**: `npm install` fails or shows warnings about Node.js version incompatibility.

**Solution**:
```bash
# Check your current Node.js version
node --version

# If outside the supported range (>=18.18.0 <25.0.0), use nvm to switch:
nvm install 22
nvm use 22

# Verify the version
node --version  # Should show v22.x.x

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

**Prevention**: Use [nvm](https://github.com/nvm-sh/nvm) to manage Node.js versions and create a `.nvmrc` file:
```bash
echo "22" > .nvmrc
nvm use
```

### vfkit Installation (macOS)

**Problem**: `vfkit` command not found or VM fails to start.

**Solution**:
```bash
# Install vfkit via Homebrew
brew install vfkit

# Verify installation
vfkit --version

# If Homebrew install fails, try manual installation:
# Download from: https://github.com/crc-org/vfkit/releases
# Extract and move to PATH:
sudo mv vfkit /usr/local/bin/
sudo chmod +x /usr/local/bin/vfkit
```

**macOS Permission Issues**:
```bash
# Grant necessary permissions in System Settings > Privacy & Security
# If prompted, allow "vfkit" in the security panel
```

**Minimum Requirements**:
- macOS 10.13+ (High Sierra or later)
- For ASIF support: macOS 13.0+ (Ventura or later)

### Port Conflicts

**Problem**: "Address already in use" errors when starting services.

**Solution**:
```bash
# Check which process is using a port (e.g., port 3000)
lsof -i :3000

# Kill the process
kill -9 <PID>

# Common VibeCode ports:
# - 3000: Next.js dev server
# - 18789: OpenClaw Gateway
# - 5432: PostgreSQL
# - 6379: Redis/Valkey
# - WebSocket ports for collaboration

# To find and kill all conflicting processes:
lsof -ti :3000 | xargs kill -9
```

**Alternative**: Configure custom ports in `.env.local`:
```env
PORT=3001
OPENCLAW_PORT=18790
```

### Database Connection Issues

**Problem**: "Connection refused" or "database does not exist" errors.

**Solution**:
```bash
# 1. Check if PostgreSQL is running
pg_isready

# 2. Start PostgreSQL if not running (macOS with Homebrew)
brew services start postgresql@16

# 3. Create the database
createdb vibecode_dev

# 4. Install pgvector extension
psql vibecode_dev -c 'CREATE EXTENSION IF NOT EXISTS vector;'

# 5. Verify connection
psql -U postgres -d vibecode_dev -c '\l'
```

**Connection String**: Ensure your `.env.local` has correct credentials:
```env
DATABASE_URL="postgresql://username:password@localhost:5432/vibecode_dev"
```

**Docker PostgreSQL**:
```bash
# Start PostgreSQL in Docker
docker run -d \
  --name vibecode-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=vibecode_dev \
  -p 5432:5432 \
  pgvector/pgvector:pg16
```

### Docker Setup Problems

**Problem**: Docker containers fail to start or build.

**Solution**:
```bash
# 1. Clean up existing containers and images
docker compose down -v
docker system prune -a

# 2. Rebuild from scratch
docker compose build --no-cache
docker compose up -d

# 3. Check container logs
docker compose logs -f

# 4. Verify Docker is running
docker ps
```

**Common Docker Issues**:
- **Out of disk space**: Run `docker system prune -a --volumes`
- **Port conflicts**: See [Port Conflicts](#port-conflicts) section
- **Permission denied**: Add user to docker group (Linux):
  ```bash
  sudo usermod -aG docker $USER
  newgrp docker
  ```

### Tauri Build Failures

**Problem**: `npm run tauri:build` or `npm run tauri:dev` fails.

**Solution**:
```bash
# 1. Ensure Rust is installed
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env

# 2. Update Rust to latest version
rustup update

# 3. Install platform-specific dependencies

# macOS:
xcode-select --install

# Linux (Ubuntu/Debian):
sudo apt update
sudo apt install -y \
  libwebkit2gtk-4.1-dev \
  build-essential \
  curl \
  wget \
  file \
  libssl-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev

# Linux (Fedora):
sudo dnf install \
  webkit2gtk4.1-devel \
  openssl-devel \
  curl \
  wget \
  file \
  libappindicator-gtk3-devel \
  librsvg2-devel

# 4. Clear Tauri cache
rm -rf src-tauri/target

# 5. Rebuild
npm run tauri:build
```

**See detailed guide**: [Tauri Desktop Setup Guide](docs/setup/TAURI_DESKTOP_SETUP.md)

### Python/pip Issues

**Problem**: `pip install -r scripts/requirements.txt` fails.

**Solution**:
```bash
# 1. Ensure Python 3.8+ is installed
python3 --version

# 2. Upgrade pip
python3 -m pip install --upgrade pip

# 3. Use virtual environment (recommended)
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# 4. Install requirements
pip install -r scripts/requirements.txt

# 5. If specific package fails (e.g., psycopg2):
# Install system dependencies first

# macOS:
brew install postgresql

# Linux (Ubuntu/Debian):
sudo apt install python3-dev libpq-dev

# Then retry:
pip install -r scripts/requirements.txt
```

### AI Provider API Errors

**Problem**: "API key invalid" or "Rate limit exceeded" errors.

**Solution**:
```bash
# 1. Verify API keys are set in .env.local
cat .env.local | grep API_KEY

# 2. Required format:
OPENROUTER_API_KEY="sk-or-v1-..."
OPENAI_API_KEY="sk-..."
ANTHROPIC_API_KEY="sk-ant-..."
GROQ_API_KEY="gsk_..."
```

**Rate Limiting**:
- Use OpenRouter for multi-provider access with shared rate limits
- Implement exponential backoff in your code
- Consider upgrading to paid tiers for higher limits

**Offline Mode**: Use Ollama for local LLMs without API keys:
```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Pull a model
ollama pull llama3.1

# Configure VibeCode to use Ollama
# Add to .env.local:
OLLAMA_BASE_URL="http://localhost:11434"
```

### Platform-Specific Issues

#### macOS

**Problem**: "Operation not permitted" when running scripts.

**Solution**:
```bash
# Grant Terminal full disk access:
# System Settings > Privacy & Security > Full Disk Access > Add Terminal

# Or run with sudo (not recommended for dev):
sudo python3 scripts/launch_ubuntu_vm.py
```

#### Linux

**Problem**: Permission errors or missing dependencies.

**Solution**:
```bash
# Ensure all dev dependencies are installed
# Ubuntu/Debian:
sudo apt update && sudo apt install -y \
  build-essential \
  pkg-config \
  libssl-dev \
  libpq-dev \
  python3-dev

# Fedora:
sudo dnf groupinstall "Development Tools"
sudo dnf install openssl-devel postgresql-devel python3-devel

# Fix npm global package permissions:
mkdir -p ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
```

#### Windows

**Problem**: Scripts fail or dependencies missing.

**Solution**:
```powershell
# Run PowerShell as Administrator

# Install Chocolatey (package manager)
Set-ExecutionPolicy Bypass -Scope Process -Force
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

# Install dependencies
choco install -y nodejs-lts python postgresql docker-desktop

# For Tauri development:
choco install -y visualstudio2022-workload-vctools
```

**WSL2 Recommended**: For best experience, use Windows Subsystem for Linux 2:
```bash
wsl --install
wsl --set-default-version 2
```

### Still Having Issues?

If you're still experiencing problems after trying these solutions:

1. **Check the logs**:
   ```bash
   # Application logs
   tail -f logs/vibecode.log

   # Docker logs
   docker compose logs -f

   # Tauri logs (in dev console)
   ```

2. **Search existing issues**: Check GitHub Issues for similar problems

3. **Ask for help**:
   - Create a new GitHub issue with:
     - Your OS and version
     - Node.js and npm versions
     - Full error message and stack trace
     - Steps to reproduce

4. **Community support**:
   - Check our GitHub Discussions
   - Join our community chat (if available)

5. **Review documentation**:
   - [Environment Setup Guide](docs/ENVIRONMENT_SETUP_GUIDE.md)
   - [Quick Start Guide](docs/QUICK_START.md)
   - [Tauri Desktop Setup](docs/setup/TAURI_DESKTOP_SETUP.md)
   - [Architecture Documentation](docs/ARCHITECTURE.md)

## 🛠️ CLI Tool
Manage the VM environment with the unified CLI:
```bash
bin/vibecode-vm status  # Check health via Ralph Loop
bin/vibecode-vm start   # Launch Ubuntu VM
bin/vibecode-vm stop    # Stop VM
```

## 🖥️ Menubar App
A native macOS status bar app is available to control the environment:
1. **Build:** `cd platforms/macos/VibeCodeMenubar && swift build -c release`
2. **Run:** `.build/release/VibeCodeMenubar`

## 🔄 Ralph Loop
System health is monitored by the Ralph Loop daemon:
```bash
python3 scripts/ralph_loop.py
```

## 📦 Legacy & Migration
- **Gas Town:** Use `python3 scripts/gt_shim.py` for legacy commands.
- **Remote:** Use `scripts/migrate_from_remote.sh` to pull from `mbp-m1`.

---
*Powered by OpenClaw*

## 🍎 Native macOS Virtualization

VibeCode supports **Apple Virtualization Framework** for native macOS VM performance:
- **Native Speed**: Direct hardware virtualization without Docker overhead
- **ASIF Support**: Apple Sparse Image Format on macOS 13.0+ (2-3x faster I/O)
- **Full VM Control**: Start, stop, suspend, resume operations
- **Linux GUI VMs**: Graphics support with VirtIO GPU

See [Apple Virtualization Framework Documentation](docs/features/APPLE_VIRTUALIZATION_FRAMEWORK.md) for details.

## 🐳 Docker Option (Lightweight)
If you prefer containers over a full VM:
```bash
docker compose up -d
```
This launches the OpenClaw Gateway on port `18789`.

## GitHub Actions Cost Optimization

To control costs, we use a two-tier CI/CD strategy:

### Main Branch (Lightweight)
- Fast linting and basic unit tests only
- ~$0.05 per run

### Release Branches (Comprehensive)
- Full test suite (unit, integration, E2E)
- Security scans and performance testing
- Production deployment pipelines
- ~$2-4 per run

### Creating Release Branches
```bash
# Create release branch for full testing
./create-release-branch.sh v1.2.0
```

## 🧪 Testing Infrastructure

VibeCode maintains a comprehensive testing infrastructure to ensure code quality and reliability:

### Testing Strategy
- **Unit Tests**: Test individual components and functions in isolation
- **Integration Tests**: Test interactions between components and services
- **E2E Tests**: Test complete user flows in real browser environments

### Testing Stack
- **Jest** + **React Testing Library**: Unit and integration testing
- **Playwright**: End-to-end browser automation
- **Coverage Reports**: Progressive roadmap to 80% coverage with 30% milestones

### Quick Commands
```bash
# Run all unit tests
npm run test:unit

# Run tests with coverage
npm run test:coverage

# Run E2E tests
npm run test:e2e

# Run tests in watch mode
npm run test:watch
```

### Coverage Thresholds

**Phase 0 Baseline** (Current): 18-24% - prevents regressions while improving coverage
**Progressive Milestones**: Phase 0 (18-24%) → 30% → 50% → 65% → 80%

Current enforcement in CI:
- Branches: 18%
- Functions: 22%
- Lines: 24%
- Statements: 22%

📚 **For comprehensive testing patterns, best practices, and detailed guides**, see [Testing Guide](docs/testing/TESTING_GUIDE.md)
📊 **For coverage roadmap and strategy**, see [Coverage Strategy](docs/testing/COVERAGE_STRATEGY.md)

## 🔒 Security Considerations

### Environment Isolation

The environment isolation feature provides **safety**, not **security**.

#### ✅ What It Protects Against

- Accidental operations in the wrong environment
- Human error and confusion
- Lack of visual environment indicators
- Unintentional production changes

#### ❌ What It Does NOT Protect Against

- **Determined attackers** with system access
- **Environment variable manipulation** (`NODE_ENV`, `DD_ENV`, etc.)
- **Hostname or domain spoofing**
- **Malicious code execution**
- **Privileged users** intentionally bypassing checks

#### Attack Vectors

Environment detection can be bypassed by:
- Setting environment variables (`NODE_ENV=test`)
- Modifying hostname or domain configuration
- Manipulating git branch information
- Setting custom environment detection rules

#### For True Security Isolation

To protect against determined attackers:

1. **Infrastructure Isolation**
   - Separate AWS accounts/GCP projects per environment
   - Network-level firewall rules
   - VPC/subnet isolation

2. **Cryptographic Attestation**
   - Use TPM or HSM for environment proof
   - Signed environment tokens
   - Certificate-based validation

3. **Access Control**
   - Multi-factor authentication for production
   - Role-based access control (RBAC)
   - Just-in-time (JIT) access

4. **Monitoring & Audit**
   - Comprehensive audit logging
   - Real-time alerting on suspicious activity
   - Regular security reviews

#### Recommendation

**Treat environment isolation as a guardrail, not a security boundary.**

For production systems, implement defense-in-depth with infrastructure, network,
identity, and application-level security controls.

---

## 🤝 Contributing & Community

We welcome contributions from the community! Whether you're fixing bugs, adding features, improving documentation, or helping others, your contributions make VibeCode better for everyone.

### Contributing

Ready to contribute? Here's how to get started:

- **📖 [Contributing Guide](CONTRIBUTING.md)** - Comprehensive guide covering:
  - Development environment setup
  - Code style and conventions
  - Testing requirements
  - Pull request workflow
  - Commit message guidelines
  - Architecture decision records (ADRs)

- **🐛 Found a bug?** Open an issue with details on how to reproduce it
- **💡 Have an idea?** Start a discussion to get feedback from the community
- **📝 Improve docs?** Documentation improvements are always welcome!
- **🧪 Add tests?** Help us increase code coverage

### Getting Help

Need assistance or have questions?

- **📖 [Documentation](docs/)** - Start with our comprehensive docs:
  - [Quick Start Guide](docs/QUICK_START.md)
  - [Environment Setup](docs/ENVIRONMENT_SETUP_GUIDE.md)
  - [Architecture Overview](docs/ARCHITECTURE.md)
  - [Tauri Desktop Setup](docs/setup/TAURI_DESKTOP_SETUP.md)

- **💬 GitHub Discussions** - Ask questions, share ideas, and connect with the community
- **🔍 [Troubleshooting Guide](#-troubleshooting)** - Solutions to common problems

### Community Channels

Join our growing community:

- **GitHub Discussions**: General questions, feature requests, and community chat
- **Issue Tracker**: Bug reports and tracked feature development
- **Pull Requests**: Code review and collaboration

> **Note**: We're building this community from the ground up. If you'd like to help establish additional community channels (Discord, Slack, etc.), please open a discussion!

### Reporting Issues

Found a bug or have a feature request?

- **🐛 Report a Bug** - Use GitHub Issues to report bugs
- **✨ Request a Feature** - Submit feature requests via GitHub Issues
- **📖 Browse Issues** - Check existing issues on GitHub

When reporting issues, please include:
- Your operating system and version
- Node.js and npm versions
- Steps to reproduce the problem
- Expected vs actual behavior
- Error messages and stack traces
- Screenshots (if applicable)

### License

VibeCode is open source software licensed under the [MIT License](LICENSE).

This means you can:
- ✅ Use it commercially
- ✅ Modify and distribute
- ✅ Use privately
- ✅ Use it for research

See the [LICENSE](LICENSE) file for full details.

---

<div align="center">

**Built with ❤️ by the VibeCode community**

⭐ Star us on GitHub | 🐛 Report an Issue | 💬 Join Discussions

</div>
