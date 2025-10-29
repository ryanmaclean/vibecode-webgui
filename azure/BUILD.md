# Build and Deployment Guide

## Quick Build Commands

### Build the Image
```bash
cd azure
docker build -t vibecode/openvscode-server:1.95.3 -f Dockerfile .
```

### Check Image Size
```bash
docker images vibecode/openvscode-server:1.95.3
```

Expected output:
```
REPOSITORY                      TAG       SIZE
vibecode/openvscode-server      1.95.3    ~450-500MB
```

### Run with Docker Compose
```bash
# Setup environment
cp .env.example .env

# Start services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Manual Run
```bash
docker run -d \
  --name vibecode-openvscode \
  -p 3000:3000 \
  -v $(pwd)/workspace:/workspace \
  vibecode/openvscode-server:1.95.3
```

## Build Process Breakdown

### Stage 1: Builder (Alpine 3.19)
Downloads and prepares:
- OpenVSCode Server 1.95.3 (~200MB)
- Datadog Agent (~150MB)
- Creates directory structure

### Stage 2: Runtime (Alpine 3.19)
Installs runtime dependencies:
- Node.js 20 LTS (~50MB)
- Python 3.11 (~40MB)
- Essential tools (git, curl, bash) (~30MB)
- Required libraries (~20MB)

**Total estimated size: 450-500MB**

## Optimization Techniques Used

1. **Multi-stage Build**: Separates build and runtime stages
2. **Alpine Linux**: Minimal base image (~7MB)
3. **Layer Consolidation**: Combines RUN commands to reduce layers
4. **Cache Cleanup**: Removes APK cache after installations
5. **No-cache Flag**: Uses `--no-cache` for package installations
6. **Temporary File Removal**: Cleans up downloaded archives

## Testing the Build

### 1. Validate Dockerfile (No Docker Required)
```bash
bash validate-dockerfile.sh
```

### 2. Full Build and Test
```bash
bash test-container.sh
```

This script will:
- Build the image
- Start a container
- Run health checks
- Verify all components
- Display resource usage
- Show startup logs

### 3. Manual Testing

```bash
# Build
docker build -t vibecode/openvscode-server:1.95.3 -f Dockerfile .

# Run
docker run -d --name test-vscode -p 3000:3000 vibecode/openvscode-server:1.95.3

# Wait for startup (30-60 seconds)
sleep 30

# Test health endpoint
curl http://localhost:3000/healthz

# Open in browser
open http://localhost:3000

# Check logs
docker logs test-vscode

# Cleanup
docker stop test-vscode && docker rm test-vscode
```

## Troubleshooting Build Issues

### Issue: Download Timeout
```bash
# Increase timeout
docker build --build-arg HTTP_TIMEOUT=600 -t vibecode/openvscode-server:1.95.3 .
```

### Issue: Out of Space
```bash
# Clean up Docker
docker system prune -a --volumes

# Check space
df -h
```

### Issue: Build Cache Problems
```bash
# Build without cache
docker build --no-cache -t vibecode/openvscode-server:1.95.3 -f Dockerfile .
```

### Issue: Network Problems
```bash
# Use different registry mirror
docker build --build-arg ALPINE_MIRROR=http://dl-cdn.alpinelinux.org/alpine -t vibecode/openvscode-server:1.95.3 .
```

## Expected Build Time

- **First build**: 5-10 minutes (depending on network speed)
- **Cached builds**: 1-2 minutes
- **No-cache rebuild**: 5-10 minutes

## Size Breakdown

| Component | Size |
|-----------|------|
| Alpine Linux Base | ~7 MB |
| Node.js 20 | ~50 MB |
| Python 3 | ~40 MB |
| OpenVSCode Server | ~200 MB |
| Datadog Agent | ~150 MB |
| System Libraries | ~20 MB |
| Tools (git, curl, etc) | ~30 MB |
| **Total (estimated)** | **~500 MB** |

## Registry Push

### Docker Hub
```bash
# Tag
docker tag vibecode/openvscode-server:1.95.3 yourusername/openvscode-server:1.95.3

# Login
docker login

# Push
docker push yourusername/openvscode-server:1.95.3
```

### Azure Container Registry
```bash
# Login
az acr login --name yourregistry

# Tag
docker tag vibecode/openvscode-server:1.95.3 yourregistry.azurecr.io/openvscode-server:1.95.3

# Push
docker push yourregistry.azurecr.io/openvscode-server:1.95.3
```

### GitHub Container Registry
```bash
# Login
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin

# Tag
docker tag vibecode/openvscode-server:1.95.3 ghcr.io/username/openvscode-server:1.95.3

# Push
docker push ghcr.io/username/openvscode-server:1.95.3
```

## CI/CD Integration

### GitHub Actions
```yaml
name: Build Docker Image

on:
  push:
    branches: [ main ]
    paths:
      - 'azure/Dockerfile'
      - '.github/workflows/docker-build.yml'

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v2

      - name: Login to Registry
        uses: docker/login-action@v2
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and Push
        uses: docker/build-push-action@v4
        with:
          context: azure
          file: azure/Dockerfile
          push: true
          tags: |
            ghcr.io/${{ github.repository }}/openvscode-server:latest
            ghcr.io/${{ github.repository }}/openvscode-server:1.95.3
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

## Deployment

### Docker Compose Production
```bash
# Production environment
cp .env.example .env
nano .env  # Add DATADOG_API_KEY

# Start with restart policy
docker-compose up -d

# Monitor
docker-compose ps
docker-compose logs -f
```

### Kubernetes
```bash
# Create deployment
kubectl apply -f kubernetes/deployment.yaml

# Expose service
kubectl expose deployment openvscode-server --type=LoadBalancer --port=3000

# Check status
kubectl get pods
kubectl logs -l app=openvscode-server
```

### Azure Container Instances
```bash
az container create \
  --resource-group vibecode \
  --name openvscode-server \
  --image vibecode/openvscode-server:1.95.3 \
  --dns-name-label vibecode-code \
  --ports 3000 \
  --environment-variables \
    DATADOG_API_KEY=$DATADOG_API_KEY \
    VSCODE_PORT=3000
```

## Performance Tuning

### Build Performance
```bash
# Use BuildKit (faster builds)
DOCKER_BUILDKIT=1 docker build -t vibecode/openvscode-server:1.95.3 .

# Parallel builds
docker buildx build --platform linux/amd64,linux/arm64 -t vibecode/openvscode-server:1.95.3 .
```

### Runtime Performance
```bash
# Increase resources
docker run -d \
  --cpus=4 \
  --memory=4g \
  -p 3000:3000 \
  vibecode/openvscode-server:1.95.3
```

## Security Scanning

### Scan for Vulnerabilities
```bash
# Using Trivy
trivy image vibecode/openvscode-server:1.95.3

# Using Docker Scout
docker scout cves vibecode/openvscode-server:1.95.3

# Using Snyk
snyk container test vibecode/openvscode-server:1.95.3
```

## Maintenance

### Update Base Image
1. Change Alpine version in Dockerfile
2. Rebuild and test
3. Update documentation

### Update OpenVSCode Server
1. Change version number in Dockerfile
2. Update download URL
3. Rebuild and test
4. Update tags

### Update Node.js
```dockerfile
# In Dockerfile, change:
nodejs~=20  # to newer version
```

## Rollback

### Revert to Previous Version
```bash
# Tag current as backup
docker tag vibecode/openvscode-server:1.95.3 vibecode/openvscode-server:1.95.3-backup

# Pull previous version
docker pull vibecode/openvscode-server:1.95.2

# Retag as latest
docker tag vibecode/openvscode-server:1.95.2 vibecode/openvscode-server:1.95.3
```

## Monitoring Build Health

### Check Build Success Rate
```bash
# View build history
docker history vibecode/openvscode-server:1.95.3

# Inspect image
docker inspect vibecode/openvscode-server:1.95.3
```

### Verify Image Contents
```bash
# Run shell in container
docker run -it --rm vibecode/openvscode-server:1.95.3 /bin/bash

# Check installed packages
docker run --rm vibecode/openvscode-server:1.95.3 apk list

# Verify file structure
docker run --rm vibecode/openvscode-server:1.95.3 ls -la /opt/
```
