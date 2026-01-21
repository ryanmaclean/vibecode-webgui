# VibeCode Docker Structure

This directory contains the consolidated Docker configuration for VibeCode WebGUI, replacing 15+ scattered Dockerfiles with a clean, maintainable structure.

## Structure

```
docker/
├── Dockerfile                    # Consolidated multi-stage Dockerfile
├── docker-compose.dev.yml       # Development environment
├── docker-compose.prod.yml      # Production environment
├── docker-compose.test.yml       # Testing environment
├── docker-compose.aks.yml        # AKS production with Datadog
├── build.sh                     # Build script for different targets
├── deploy.sh                    # Deployment script
└── README.md                    # This file
```

## Quick Start

### Development
```bash
cd docker
./deploy.sh dev
```

### Production
```bash
cd docker
./deploy.sh prod
```

### AKS Deployment
```bash
cd docker
./deploy.sh aks --registry ghcr.io/username
```

## Build Targets

The consolidated Dockerfile supports multiple build targets via build arguments:

### Available Targets:
- **development** - Full dev environment with hot reload
- **production** - Optimized production build
- **testing** - Testing environment with dev dependencies
- **ingestion** - RAG ingestion worker

### Build Arguments:
- `NODE_VERSION` - Node.js version (default: 20)
- `BASE_OS` - Base OS (alpine/slim, default: alpine)
- `BUILD_TARGET` - Build target (default: production)
- `INCLUDE_DEV_DEPS` - Include dev dependencies (default: false)
- `ENABLE_SOURCE_MAPS` - Enable source maps (default: false)
- `ENABLE_DATADOG` - Enable Datadog instrumentation (default: false)
- `ENABLE_LIGHTNINGCSS` - Enable LightningCSS (default: true)
- `ENABLE_PRISMA` - Enable Prisma (default: true)
- `ENABLE_HEALTH_CHECK` - Enable health checks (default: true)

## Build Script Usage

```bash
# Build development image
./build.sh dev

# Build production image with push
./build.sh prod --tag vibecode-webgui:latest --push

# Build multi-arch for AKS
./build.sh aks --platform linux/amd64,linux/arm64 --push

# Build ingestion worker
./build.sh ingestion --tag vibecode-ingest:latest
```

## Deployment Script Usage

```bash
# Deploy development environment
./deploy.sh dev

# Deploy production with registry
./deploy.sh prod --registry ghcr.io/username

# Deploy to AKS
./deploy.sh aks --registry ghcr.io/username --namespace production
```

## Environment-Specific Configurations

### Development (`docker-compose.dev.yml`)
- Hot reload enabled
- Debug port exposed (9229)
- Volume mounts for live code changes
- PostgreSQL and Redis services

### Production (`docker-compose.prod.yml`)
- Optimized production build
- Health checks enabled
- Datadog instrumentation
- Source maps for debugging
- Restart policies

### Testing (`docker-compose.test.yml`)
- Test environment variables
- All dev dependencies included
- Isolated test database
- Test-specific Redis instance

### AKS (`docker-compose.aks.yml`)
- Production build with Datadog
- RAG ingestion worker included
- Kubernetes-ready configuration
- Source maps for dynamic instrumentation

## Migration from Old Dockerfiles

The following old Dockerfiles have been consolidated:

| Old Dockerfile | New Target | Notes |
|----------------|------------|-------|
| `Dockerfile` | production | Basic multi-stage |
| `Dockerfile.prod` | production | LightningCSS support |
| `Dockerfile.dev` | development | Dev environment |
| `Dockerfile.production` | production | Datadog integration |
| `Dockerfile.fast` | production | BuildKit optimizations |
| `Dockerfile.multiarch` | production | Multi-arch support |
| `Dockerfile.aks` | production | AKS-specific |
| `Dockerfile.local` | development | Local development |
| `Dockerfile.ingest` | ingestion | RAG worker |
| `Dockerfile.test` | testing | Test environment |

## Benefits

1. **Single Source of Truth** - One Dockerfile to maintain
2. **Reduced Duplication** - Common patterns shared
3. **Easier Maintenance** - Security updates in one place
4. **Clearer Purpose** - Each compose file has specific role
5. **Better Caching** - Shared layers across environments
6. **Flexible Configuration** - Build args for different needs

## CI/CD Integration

Update your GitHub Actions workflows to use the new structure:

```yaml
# Old way
- name: Build image
  run: docker build -f Dockerfile.production -t $IMAGE .

# New way
- name: Build image
  run: docker/docker/build.sh prod --tag $IMAGE --push
```

## Troubleshooting

### Build Issues
- Check build arguments match your needs
- Verify base OS compatibility
- Ensure all required dependencies are included

### Deployment Issues
- Verify environment variables are set
- Check registry permissions for push
- Ensure Kubernetes context is correct for AKS

### Performance Issues
- Use BuildKit for faster builds
- Enable cache mounts for npm/yarn
- Use multi-stage builds efficiently
