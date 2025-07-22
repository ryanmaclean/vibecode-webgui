# 🚀 VibeCode KIND Scripts

**Automated Kubernetes setup for local development**

## 📖 Overview

This directory contains scripts to set up and manage a local Kubernetes development environment using KIND (Kubernetes in Docker) for VibeCode development.

## 📁 Scripts

| Script | Purpose | Usage |
|--------|---------|--------|
| `kind-setup.sh` | 🎯 **Main script** - Complete automated setup | `./scripts/kind-setup.sh` |
| `docker-doctor.sh` | 🏥 **Docker TUI** - Interactive Docker troubleshooting | `./scripts/docker-doctor.sh` |
| `kind-env-check.sh` | 🔍 Environment validation | `./scripts/kind-env-check.sh` |
| `kind-cleanup.sh` | 🧹 Clean previous installations | `./scripts/kind-cleanup.sh` |
| `kind-create-cluster.sh` | 🏗️ Create KIND cluster | `./scripts/kind-create-cluster.sh` |
| `kind-deploy-services.sh` | 📦 Deploy VibeCode services | `./scripts/kind-deploy-services.sh` |
| `kind-health-check.sh` | 🩺 Validate deployment | `./scripts/kind-health-check.sh` |
| `start-docker.sh` | 🐳 Docker Desktop helper | `./scripts/start-docker.sh` |

## 🚀 Quick Start

### Option 1: One-Command Setup
```bash
# Complete automated setup (recommended)
./scripts/kind-setup.sh

# If Docker issues are detected, use Docker Doctor:
./scripts/docker-doctor.sh
```

### Option 2: Step-by-Step
```bash
# 1. Check prerequisites
./scripts/kind-env-check.sh

# 2. Clean previous installations
./scripts/kind-cleanup.sh

# 3. Create cluster
./scripts/kind-create-cluster.sh

# 4. Deploy services
./scripts/kind-deploy-services.sh

# 5. Validate deployment
./scripts/kind-health-check.sh
```

## 📋 Prerequisites

### Required Tools
- **Docker Desktop** - Container runtime
- **kubectl** - Kubernetes CLI (v1.28+)
- **KIND** - Kubernetes in Docker (v0.20+)
- **Node.js** - Development environment (v18+)

### Optional Tools
- **Helm** - Package manager (v3.12+)

### Installation Commands

**macOS (Homebrew):**
```bash
brew install docker kind kubernetes-cli helm node
```

**Linux:**
```bash
# Docker
curl -fsSL https://get.docker.com | sh

# KIND
curl -Lo ./kind https://kind.sigs.k8s.io/dl/v0.20.0/kind-linux-amd64
chmod +x ./kind && sudo mv ./kind /usr/local/bin/kind

# kubectl
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
chmod +x kubectl && sudo mv kubectl /usr/local/bin/kubectl
```

## 🔧 Configuration

### Cluster Configuration
The cluster is configured via `k8s/vibecode-kind-config.yaml`:

```yaml
# 4-node cluster with port mappings
- Control plane: 1 node
- Workers: 3 nodes (code-server, platform services, database)
- Ports: 8090 (HTTP), 8443 (HTTPS), 8081 (code-server), 9091 (Authelia)
```

### Environment Variables
Set these in `.env.local`:
```bash
# Required for AI features
OPENROUTER_API_KEY=sk-or-v1-your-key

# Optional for full functionality
DATABASE_URL=postgresql://vibecode:password@localhost:5432/vibecode
DATADOG_API_KEY=your-datadog-key
```

## 📊 What Gets Deployed

### Core Services
1. **PostgreSQL** - Database with pgvector extension
2. **Redis** - Caching and session storage
3. **VibeCode App** - Main Next.js application
4. **Code-Server** - VS Code in browser (if configured)

### Network Configuration
- **Namespace:** `vibecode`
- **Internal DNS:** `*.vibecode.svc.cluster.local`
- **External Access:** `kubectl port-forward`

## 🧪 Testing

### Health Validation
```bash
# Complete health check
./scripts/kind-health-check.sh

# Quick status check
kubectl get pods -n vibecode
```

### Access Application
```bash
# Port forward to access locally
kubectl port-forward -n vibecode svc/vibecode-service 3000:3000

# Open in browser
open http://localhost:3000
```

### Test Features
- **AI Chat:** Multiple model support
- **RAG Search:** Upload files, test semantic search
- **Console Mode:** VS Code in browser
- **Project Generation:** AI-powered scaffolding
- **Vector Database:** pgvector with Chroma/Weaviate fallbacks

## 🚨 Troubleshooting

### Common Issues

#### 1. Docker Not Running
```
❌ Docker is NOT running or not responding
```
**Solution:**
```bash
# Start Docker Desktop
./scripts/start-docker.sh

# Or manually
open /Applications/Docker.app  # macOS
sudo systemctl start docker   # Linux
```

#### 2. Port Conflicts
```
⚠️ Port 8443 is in use by: Docker
```
**Solution:**
```bash
# Find and kill conflicting process
lsof -ti:8443 | xargs kill

# Or change ports in k8s/vibecode-kind-config.yaml
```

#### 3. Cluster Creation Fails
```
❌ Cluster creation failed
```
**Solution:**
```bash
# Clean up and retry
./scripts/kind-cleanup.sh
./scripts/kind-create-cluster.sh

# Check Docker resources
docker system df
docker system prune
```

#### 4. Pods Not Starting
```
❌ Some pods not running
```
**Solution:**
```bash
# Check pod status
kubectl get pods -n vibecode
kubectl describe pod <pod-name> -n vibecode

# Check logs
kubectl logs -l app=vibecode-webgui -n vibecode

# Restart deployment
kubectl rollout restart deployment/vibecode-webgui -n vibecode
```

### Emergency Reset
```bash
# Nuclear option - reset everything
kind delete clusters --all
docker system prune -af
./scripts/kind-setup.sh
```

## 📖 Documentation

- **[KIND_TROUBLESHOOTING_GUIDE.md](../KIND_TROUBLESHOOTING_GUIDE.md)** - Comprehensive troubleshooting
- **[REPOSITORY_SCAN_REPORT_JULY_2025.md](../REPOSITORY_SCAN_REPORT_JULY_2025.md)** - Repository status
- **[ENHANCED_AI_FEATURES.md](../ENHANCED_AI_FEATURES.md)** - AI capabilities

## 🔄 Development Workflow

### Daily Development
```bash
# Start your day
./scripts/kind-health-check.sh
kubectl port-forward -n vibecode svc/vibecode-service 3000:3000

# Make changes, then redeploy
docker build -t vibecode-webgui:latest .
kind load docker-image vibecode-webgui:latest --name=vibecode-test
kubectl rollout restart deployment/vibecode-webgui -n vibecode
```

### Debugging
```bash
# View logs
kubectl logs -f deployment/vibecode-webgui -n vibecode

# Shell into container
kubectl exec -it deployment/vibecode-webgui -n vibecode -- bash

# Port forward database
kubectl port-forward -n vibecode svc/postgres 5432:5432

# View all resources
kubectl get all -n vibecode
```

## 📈 Performance

### Resource Usage
- **Cluster:** ~2GB RAM, 2 CPU cores
- **Startup Time:** 2-5 minutes
- **Build Time:** 1-2 minutes
- **Health Check:** <30 seconds

### Optimization Tips
- Use `kind load docker-image` instead of pulling
- Pre-build images during development
- Use resource limits to prevent over-allocation
- Monitor with `kubectl top pods`

## 🤝 Contributing

When updating scripts:
1. Test on clean environment
2. Update friction log in `KIND_TROUBLESHOOTING_GUIDE.md`
3. Add error handling and timeouts
4. Include helpful error messages
5. Test both success and failure paths

## 📧 Support

- **GitHub Issues:** [Report bugs](https://github.com/vibecode/webgui/issues)
- **Troubleshooting:** See `KIND_TROUBLESHOOTING_GUIDE.md`
- **Development:** Check repository documentation