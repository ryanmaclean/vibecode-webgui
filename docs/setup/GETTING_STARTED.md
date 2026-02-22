# Getting Started with VibeCode

**Get your development environment running in 5 minutes**

**Version:** 1.0
**Last Updated:** February 14, 2026
**Audience:** New users and contributors

---

## What is VibeCode?

VibeCode is a **cloud-native development platform** that combines the power of VS Code with flexible deployment options. Whether you need containers, Kubernetes, or native macOS virtualization, VibeCode adapts to your workflow.

### Key Features

- 🚀 **Multiple Deployment Modes** - Docker Compose, Kubernetes (KIND), Tauri desktop, or Apple Virtualization
- 🤖 **AI-Powered Development** - 321+ models via OpenRouter integration
- 🔐 **Enterprise Security** - OAuth providers, Touch ID support, zero-trust architecture
- 🎯 **Developer-Focused** - Based on OpenVSCode Server with extensive extension support
- 📦 **Template Library** - 50+ pre-configured project templates

---

## Choose Your Path

Pick the deployment mode that fits your needs:

| Mode | Best For | Setup Time | Complexity |
|------|----------|------------|------------|
| **Docker Compose** | Quick testing, development | 5 minutes | Low |
| **KIND Kubernetes** | Learning K8s, team deployments | 10 minutes | Medium |
| **Tauri Desktop** | Native macOS app experience | 15 minutes | Medium |
| **Apple Virtualization** | Full VM isolation, production | 20 minutes | High |

**First time here?** Start with Docker Compose. You can always switch later.

---

## Prerequisites

### Required Software

All deployment modes need:

| Tool | Version | Installation |
|------|---------|--------------|
| **Git** | Any recent version | `brew install git` or comes with macOS |
| **Node.js** | v22.15.1+ | `nvm install 22` |
| **npm** | v10.9.4+ | Comes with Node.js |

### Mode-Specific Requirements

#### Docker Compose
- **Docker Desktop** (latest) - [Download here](https://www.docker.com/products/docker-desktop)

#### KIND Kubernetes
- **Docker Desktop** (latest)
- **kubectl** - `brew install kubectl`
- **kind** - `brew install kind`

#### Tauri Desktop
- **Rust** 1.90.0+ - `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
- **Xcode Command Line Tools** - `xcode-select --install`

#### Apple Virtualization
- **macOS** 10.13+ (High Sierra) - Apple Silicon or Intel
- **Swift 5** - Comes with Xcode Command Line Tools
- **Rust** 1.90.0+
- **16 GB RAM** minimum

### Optional (Recommended)

- **nvm** - Node version management: `curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash`
- **Homebrew** - Package management: `/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"`

---

## Quick Start: Docker Compose (Recommended)

This is the fastest way to get VibeCode running.

### Step 1: Clone the Repository

```bash
cd ~/Projects  # Or your preferred directory
git clone https://github.com/ryanmaclean/vibecode-webgui.git
cd vibecode-webgui
```

### Step 2: Setup Node Environment

```bash
# Install and use Node.js 22 LTS
source ~/.nvm/nvm.sh
nvm install 22
nvm use 22

# Verify versions
node --version  # Should show v22.15.1 or later
npm --version   # Should show v10.9.4 or later
```

### Step 3: Install Dependencies

```bash
npm install --legacy-peer-deps
```

**Expected time:** 2-3 minutes

### Step 4: Start with Docker Compose

```bash
# Start all services
docker-compose up -d

# Check status
docker-compose ps
```

**Expected output:**
```
NAME                     COMMAND                  SERVICE             STATUS
vibecode-web            "docker-entrypoint.s…"   web                 running
vibecode-postgres       "docker-entrypoint.s…"   postgres            running
vibecode-valkey         "valkey-server --bin…"   valkey              running
```

### Step 5: Access VibeCode

Open your browser to: **http://localhost:3000**

You should see the VibeCode dashboard!

### Step 6: Create Your First Workspace

1. Click **"+ New Workspace"**
2. Choose a template (or start empty)
3. Enter workspace name: `my-first-project`
4. Click **"Create"**
5. The IDE launches automatically

**Congratulations!** You're now running VibeCode.

---

## Alternative Deployment Modes

### Quick Start: KIND Kubernetes

For those wanting Kubernetes experience:

```bash
# Create KIND cluster
kind create cluster --name vibecode-cluster

# Deploy VibeCode
kubectl apply -f platforms/kubernetes/k8s/

# Setup port forwarding
kubectl port-forward svc/vibecode-web 3000:3000

# Access at http://localhost:3000
```

**Full guide:** See [KIND_KUBERNETES_SETUP.md](./KIND_KUBERNETES_SETUP.md)

### Quick Start: Tauri Desktop

For native macOS app experience:

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env

# Install dependencies
npm install --legacy-peer-deps

# Run in development mode
npm run tauri:dev

# Or build release
npm run tauri:build
```

**Full guide:** See [TAURI_DESKTOP_SETUP.md](./TAURI_DESKTOP_SETUP.md)

### Quick Start: Apple Virtualization

For VM-based isolation (macOS only):

```bash
# Build Swift components
cd VibeCodeSwift
swift build -c release
cd ..

# Setup VMs
./scripts/setup-vms-for-new-clone.sh

# Launch VibeCode
./scripts/launch-vibecode.sh
```

**Full guide:** See [APPLE_VIRTUALIZATION_SETUP.md](./APPLE_VIRTUALIZATION_SETUP.md)

---

## Common First Steps

### Configure Authentication

1. Go to **Settings** → **Authentication**
2. Choose your preferred method:
   - **Local Password** (with Touch ID)
   - **GitHub OAuth**
   - **Google OAuth**
   - **Apple Sign In**
3. Follow the setup wizard

### Install Extensions

VibeCode supports VS Code extensions:

1. Click **Extensions** icon (left sidebar)
2. Search for your favorite extensions
3. Click **Install**

**Popular extensions:**
- Python
- ESLint
- Prettier
- GitLens
- Docker

### Setup AI Assistant

1. Get an API key from [OpenRouter](https://openrouter.ai)
2. Go to **Settings** → **AI Models**
3. Enter your API key
4. Choose your preferred models (321+ available)

---

## Troubleshooting Quick Reference

### Docker Compose Issues

**Problem:** Ports already in use
```bash
# Find what's using port 3000
lsof -i :3000

# Kill the process or change ports in docker-compose.yml
```

**Problem:** Services won't start
```bash
# Check logs
docker-compose logs web

# Restart services
docker-compose restart
```

### Node.js Issues

**Problem:** Wrong Node version
```bash
# Switch to Node 22
nvm use 22

# Set as default
nvm alias default 22
```

**Problem:** npm install fails
```bash
# Clear cache and retry
npm cache clean --force
npm install --legacy-peer-deps
```

### General Issues

**Problem:** Build fails
```bash
# Check Node/npm versions
node --version
npm --version

# Update npm
npm install -g npm@latest
```

**Problem:** Can't access localhost:3000
```bash
# Check if services are running
docker-compose ps  # For Docker mode
lsof -i :3000      # For other modes

# Check firewall settings
```

**For detailed troubleshooting:** See [TROUBLESHOOTING_GUIDE.md](./TROUBLESHOOTING_GUIDE.md)

---

## Next Steps

### For Users

1. **Explore Templates** - Check out 50+ project templates
2. **Customize Settings** - Tune VibeCode to your workflow
3. **Install Extensions** - Add your favorite VS Code extensions
4. **Setup AI Models** - Configure OpenRouter integration

### For Contributors

1. **Read the Docs** - See [SETUP_FOR_NEW_CONTRIBUTORS.md](../SETUP_FOR_NEW_CONTRIBUTORS.md)
2. **Check Issues** - Browse [open issues](https://github.com/ryanmaclean/vibecode-webgui/issues)
3. **Join Discussions** - Participate in [GitHub Discussions](https://github.com/ryanmaclean/vibecode-webgui/discussions)
4. **Review Guidelines** - See [CONTRIBUTING.md](../../CONTRIBUTING.md)

---

## Understanding the Architecture

VibeCode has a modular architecture:

```
┌────────────────────────────────────────────────┐
│  Frontend (React/TypeScript)                   │
│  ┌──────────────────────────────────────────┐ │
│  │  Dashboard UI                            │ │
│  │  - Workspace Management                  │ │
│  │  - Settings & Configuration              │ │
│  │  - AI Model Selection                    │ │
│  └──────────────────────────────────────────┘ │
└────────────────────────────────────────────────┘
                     ↕
┌────────────────────────────────────────────────┐
│  Backend Services                              │
│  ┌──────────┐ ┌──────────┐ ┌───────────────┐ │
│  │ Node.js  │ │PostgreSQL│ │ Valkey/Redis  │ │
│  │ API      │ │ Database │ │ Cache/Queue   │ │
│  └──────────┘ └──────────┘ └───────────────┘ │
└────────────────────────────────────────────────┘
                     ↕
┌────────────────────────────────────────────────┐
│  IDE Layer (OpenVSCode Server)                 │
│  - Code editing and debugging                  │
│  - Extension support                           │
│  - Terminal access                             │
└────────────────────────────────────────────────┘
                     ↕
┌────────────────────────────────────────────────┐
│  Runtime Environment                           │
│  ├─ Docker Containers (Docker Compose/K8s)     │
│  ├─ Native Process (Tauri)                     │
│  └─ Virtual Machines (Apple Virtualization)    │
└────────────────────────────────────────────────┘
```

**For detailed architecture:** See [ARCHITECTURE_OVERVIEW.md](./ARCHITECTURE_OVERVIEW.md)

---

## System Requirements Summary

### Minimum Requirements

- **OS:** macOS 10.13+, Linux (Ubuntu 20.04+), Windows 10+ (WSL2 recommended)
- **RAM:** 8 GB (16 GB recommended)
- **Disk:** 20 GB free space
- **CPU:** 2 cores (4+ recommended)
- **Internet:** Required for initial setup

### Recommended for Production

- **OS:** macOS 12+ or Ubuntu 22.04+
- **RAM:** 16 GB minimum
- **Disk:** 50 GB+ SSD
- **CPU:** 4+ cores
- **Network:** Stable broadband connection

---

## Getting Help

### Documentation Resources

- **Quick Reference Guides** - See [docs/](../)
- **Setup Guides** - See [docs/setup/](.)
- **API Documentation** - See [docs/api/](../api/)
- **Architecture Docs** - See [docs/architecture/](../architecture/)

### Community Support

- **GitHub Issues** - Report bugs or request features
- **GitHub Discussions** - Ask questions, share ideas
- **Discord** - Real-time community chat (coming soon)
- **Documentation** - Comprehensive guides and references

### Common Resources

- **Full Quickstart** - [QUICKSTART.md](../QUICKSTART.md)
- **Developer Guide** - [DEVELOPER_GUIDE.md](../DEVELOPER_GUIDE.md)
- **Troubleshooting** - [TROUBLESHOOTING.md](../TROUBLESHOOTING.md)
- **Contributing** - [CONTRIBUTING.md](../../CONTRIBUTING.md)

---

## FAQ

### Can I use VibeCode in production?

Yes, but note that this is currently **beta software** (v0.9-beta). We recommend thorough testing in staging environments first.

### Which deployment mode should I use?

- **Learning/Testing:** Docker Compose
- **Team Development:** KIND Kubernetes
- **Personal Use (macOS):** Tauri Desktop
- **Production (macOS):** Apple Virtualization

### Do I need all deployment modes?

No. Choose one mode that fits your needs. Most users start with Docker Compose.

### Can I migrate between deployment modes?

Yes. Your workspace data is portable. See the migration guides in each deployment mode's documentation.

### What if I get stuck during setup?

1. Check the [Troubleshooting Guide](./TROUBLESHOOTING_GUIDE.md)
2. Review logs: `docker-compose logs` (Docker) or check console output
3. Search [GitHub Issues](https://github.com/ryanmaclean/vibecode-webgui/issues)
4. Open a new issue with your setup details

### Is VibeCode free?

Yes, VibeCode is open source under the MIT license. Some AI models via OpenRouter may require API credits.

---

## Success Checklist

Before you're done, verify:

- [ ] Node.js v22+ installed and active
- [ ] Repository cloned successfully
- [ ] Dependencies installed without errors
- [ ] Deployment mode running (Docker/KIND/Tauri/VM)
- [ ] Can access VibeCode at localhost:3000 (or relevant port)
- [ ] Can create a new workspace
- [ ] IDE launches and loads properly
- [ ] Can edit files and save changes

**All checked?** You're ready to code!

---

## What's Next?

### Explore VibeCode Features

1. **Workspace Templates** - Try different project types
2. **AI Integration** - Setup your preferred models
3. **Extensions** - Install productivity tools
4. **Settings** - Customize themes, keybindings, etc.

### Learn More

- **Architecture** - Understand how VibeCode works internally
- **Development** - Start contributing to the project
- **Deployment** - Deploy for your team or organization
- **Advanced Features** - VM management, custom templates, API integration

### Stay Updated

- **Watch the repo** - Get notified of new releases
- **Read the changelog** - See what's new in each version
- **Follow development** - Check the roadmap and milestones
- **Join discussions** - Share feedback and ideas

---

**Happy Coding with VibeCode!** 🚀

For more detailed setup instructions for specific deployment modes, see:
- [Docker Compose Setup](./DOCKER_COMPOSE_SETUP.md)
- [KIND Kubernetes Setup](./KIND_KUBERNETES_SETUP.md)
- [Tauri Desktop Setup](./TAURI_DESKTOP_SETUP.md)
- [Apple Virtualization Setup](./APPLE_VIRTUALIZATION_SETUP.md)
