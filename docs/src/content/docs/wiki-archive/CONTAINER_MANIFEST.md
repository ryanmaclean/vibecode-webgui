---
title: CONTAINER MANIFEST
description: CONTAINER MANIFEST documentation
---

# VibeCode Container Architecture

**Status**: ✅ Multi-Architecture Support (x86-64 + ARM64) | 🚀 Automated Builds on Push to Main

## Container Registry

All images are published to GitHub Container Registry (GHCR):
- **Registry**: `ghcr.io/vibecode/vibecode-webgui`
- **Architectures**: `linux/amd64`, `linux/arm64`
- **Build Triggers**: Push to `main` branch, tags, manual dispatch

## Container Images

### 1. **Main Application** (`vibecode-webgui`)
- **Dockerfile**: `Dockerfile` (production optimized)
- **Base**: `node:18-alpine`
- **Purpose**: Next.js web application with AI integration
- **Ports**: `3000`
- **Health Check**: `/api/health`
- **Security**: Non-root user (`nextjs:nodejs`)

### 2. **AI Gateway** (`vibecode-ai-gateway`)
- **Dockerfile**: `services/ai-gateway/Dockerfile`
- **Base**: `node:18-alpine`
- **Purpose**: Multi-provider AI routing and optimization
- **Ports**: `3001`
- **Health Check**: `/health`
- **Security**: Non-root user (`vibecode:nodejs`)

### 3. **Code Server** (`vibecode-code-server`)
- **Dockerfile**: `docker/code-server/Dockerfile`
- **Base**: Custom (VS Code server)
- **Purpose**: Cloud-based VS Code IDE
- **Ports**: `8080`
- **Features**: Real-time collaboration, extensions
- **Security**: Sandboxed environments

### 4. **Documentation Site** (`vibecode-docs`)
- **Dockerfile**: `docs/Dockerfile`
- **Base**: `nginx:alpine`
- **Purpose**: Astro-based documentation site
- **Ports**: `8080`
- **Health Check**: `/health`
- **Security**: Non-root nginx user

### 5. **Development Environment** (`vibecode-dev`)
- **Dockerfile**: `docker/development/Dockerfile`
- **Base**: `node:18-alpine`
- **Purpose**: Local development container
- **Ports**: `3000`
- **Features**: Hot reload, debugging tools

### 6. **MCP Servers** (`vibecode-mcp-servers`)
- **Dockerfile**: `docker/mcp-servers/Dockerfile`
- **Base**: `node:20-alpine`
- **Purpose**: Model Context Protocol servers
- **Ports**: `3001`, `3002`, `3003`
- **Features**: AI model integration, Docker-in-Docker

### 7. **Watermark Pod Autoscaler** (`vibecode-wpa`)
- **Dockerfile**: `watermarkpodautoscaler/Dockerfile`
- **Base**: `golang:alpine`
- **Purpose**: Kubernetes autoscaling controller
- **Features**: Datadog metrics integration

## Multi-Architecture Support

### Supported Platforms
- ✅ **linux/amd64** (Intel/AMD 64-bit)
- ✅ **linux/arm64** (ARM 64-bit, Apple Silicon)

### Build Process
1. **QEMU Setup**: Cross-platform emulation
2. **Docker Buildx**: Multi-arch build engine
3. **Layer Caching**: GitHub Actions cache optimization
4. **Security Scanning**: Datadog agentless vulnerability scanning
5. **Attestation**: SLSA build provenance

## Automated Workflows

### GitHub Actions Workflows

#### 1. **CI Workflow** (`.github/workflows/ci.yml`)
- **Triggers**: Push to `main`/`develop`, Pull Requests
- **Features**: Tests, builds, security scans
- **Multi-arch**: ✅ All images built for both architectures
- **Registry**: GitHub Container Registry (GHCR)

#### 2. **Multi-Arch Docker** (`.github/workflows/docker-multiarch.yml`)
- **Triggers**: Push to `main`, tags, manual dispatch
- **Matrix Strategy**: Parallel builds for all containers
- **Security**: Datadog scanning, SBOM generation
- **Monitoring**: Datadog build notifications

#### 3. **Production Deployment** (`.github/workflows/production-deployment.yml`)
- **Triggers**: Push to `main`
- **Features**: Kubernetes deployment, monitoring setup
- **Images**: Uses multi-arch containers from GHCR

## Security Features

### Container Security
- **Non-root users** in all containers
- **Security updates** applied at build time
- **Minimal base images** (Alpine Linux)
- **Health checks** for monitoring
- **SLSA attestation** for supply chain security

### Build Security
- **Vulnerability scanning** with Datadog agentless scanning
- **Dependency scanning** with npm audit
- **License compliance** checking
- **SAST/SCA** with Datadog security scanning

## Performance Optimizations

### Build Optimizations
- **Multi-stage builds** to minimize image size
- **Layer caching** with GitHub Actions cache
- **Parallel builds** with matrix strategy
- **Build cache sharing** between architectures

### Runtime Optimizations
- **Signal handling** with dumb-init/tini
- **Resource limits** and requests defined
- **Health checks** for reliability
- **Graceful shutdowns** implemented

## Container Tags

### Tagging Strategy
```bash
# Latest from main branch
ghcr.io/vibecode/vibecode-webgui/[service]:latest

# Git commit SHA
ghcr.io/vibecode/vibecode-webgui/[service]:abc1234

# Branch name
ghcr.io/vibecode/vibecode-webgui/[service]:main

# Semantic versioning (tags)
ghcr.io/vibecode/vibecode-webgui/[service]:v1.0.0
ghcr.io/vibecode/vibecode-webgui/[service]:v1.0
ghcr.io/vibecode/vibecode-webgui/[service]:v1
```

## Deployment Instructions

### Local Development
```bash
# Pull all containers
docker-compose pull

# Start development stack
docker-compose up -d

# View logs
docker-compose logs -f
```

### Production Deployment
```bash
# Deploy to Kubernetes (automated via GitHub Actions)
kubectl apply -f k8s/

# Manual deployment
./scripts/production-deploy.sh
```

### Architecture-Specific Deployment
```bash
# Force x86-64 on ARM systems
docker run --platform linux/amd64 ghcr.io/vibecode/vibecode-webgui:latest

# Force ARM64 on x86 systems  
docker run --platform linux/arm64 ghcr.io/vibecode/vibecode-webgui:latest
```

## Monitoring Integration

### Container Metrics
- **Prometheus**: Container resource metrics
- **Datadog**: Application performance monitoring
- **Vector**: Log aggregation and routing

### Build Monitoring
- **GitHub Actions**: Build status and artifacts
- **Datadog Events**: Build success/failure notifications
- **Security Alerts**: Vulnerability scan results

## Next Steps

1. **Enable GitHub Container Registry** in repository settings
2. **Configure secrets** for production deployment
3. **Set up monitoring** dashboards for container metrics
4. **Test multi-arch deployment** on different platforms

## Troubleshooting

### Common Issues

**Multi-arch build failures:**
```bash
# Check QEMU emulation
docker run --rm --privileged multiarch/qemu-user-static --reset -p yes

# Verify buildx platforms
docker buildx ls
```

**Container startup issues:**
```bash
# Check platform compatibility
docker inspect ghcr.io/vibecode/vibecode-webgui:latest | grep Architecture

# Test health checks
docker run --rm ghcr.io/vibecode/vibecode-webgui:latest timeout 30s npm run health-check
```

**Registry authentication:**
```bash
# Login to GHCR
echo $GITHUB_TOKEN | docker login ghcr.io -u $GITHUB_USERNAME --password-stdin

# Verify permissions
docker pull ghcr.io/vibecode/vibecode-webgui:latest
```