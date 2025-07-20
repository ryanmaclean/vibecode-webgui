---
title: Quick Start Guide
description: Get VibeCode running in minutes with our step-by-step guide
---

Get VibeCode up and running in your local environment in under 10 minutes.

## Prerequisites

- **Docker**: Version 20.10+ with Docker Compose V2
- **kubectl**: Kubernetes command-line tool
- **KIND**: Kubernetes in Docker (for local clusters)
- **Node.js**: Version 18+ for the web interface
- **Git**: For cloning the repository

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/vibecode/vibecode-webgui.git
cd vibecode-webgui
```

### 2. Configure Environment

```bash
# Copy environment template
cp claude-prompt.md .env.local

# Edit with your API keys
nano .env.local
```

**Required Environment Variables:**
```bash
# Datadog (for monitoring)
DATADOG_API_KEY="your-datadog-api-key"
DD_API_KEY="your-datadog-api-key"

# AI Integration
OPENROUTER_API_KEY="your-openrouter-key"
CLAUDE_API_KEY="your-claude-key"

# Database
DATABASE_URL="postgresql://username:password@localhost:5432/vibecode_dev"
```

### 3. Create Local Cluster

```bash
# Create KIND cluster with monitoring
./scripts/setup-kind-cluster.sh

# Verify cluster is running
kubectl cluster-info --context kind-vibecode-cluster
```

### 4. Deploy Monitoring Stack

```bash
# Source environment variables
source .env.local

# Deploy hybrid monitoring (Datadog + Prometheus + Vector)
./scripts/deploy-monitoring.sh -m kubernetes -d "$DATADOG_API_KEY"
```

### 5. Start the Application

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

## Verification

### Check Cluster Status
```bash
# View all pods
kubectl get pods -A

# Check monitoring namespace
kubectl get pods -n vibecode-monitoring
```

### Access Interfaces

- **VibeCode UI**: http://localhost:3000
- **Prometheus**: http://localhost:9090 (via port-forward)
- **Grafana**: http://localhost:3001 (via port-forward)
- **Datadog**: https://app.datadoghq.com/

### Test AI Integration

1. Navigate to http://localhost:3000
2. Go to the AI Project Generator
3. Enter a prompt like: "Create a React todo app with TypeScript"
4. Watch as the AI generates a complete project structure

## Troubleshooting

### Common Issues

**Docker Compose not found:**
```bash
# Check Docker Compose version
docker compose version

# If using old version, install Docker Compose V2
```

**KIND cluster creation fails:**
```bash
# Check Docker is running
docker info

# Remove existing cluster and retry
kind delete cluster --name vibecode-cluster
./scripts/setup-kind-cluster.sh
```

**Monitoring pods not starting:**
```bash
# Check node resources
kubectl top nodes

# Verify Datadog API key
curl -X GET "https://api.datadoghq.com/api/v1/validate" \
  -H "DD-API-KEY: $DATADOG_API_KEY"
```

### Getting Help

- **Documentation**: Browse this documentation site
- **GitHub Issues**: https://github.com/vibecode/vibecode-webgui/issues
- **Community**: Join our discussions on GitHub

## Next Steps

- [Architecture Overview](/architecture/overview/) - Understand the system design
- [Monitoring Setup](/monitoring/overview/) - Configure observability
- [Azure Deployment](/deployment/azure/) - Deploy to production
- [Contributing](/development/contributing/) - Join the development