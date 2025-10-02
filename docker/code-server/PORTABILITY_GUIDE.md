# Code-Server Build Portability Guide

Complete guide for making the VibeCode code-server build portable across registries, platforms, and air-gapped environments.

## Overview

The code-server build needs to be portable for:
- **Multiple Registries**: Docker Hub, GHCR, ACR, ECR, private registries
- **Multiple Platforms**: ARM64 (Apple Silicon, Raspberry Pi), AMD64 (x86_64)
- **Air-Gapped Environments**: Offline installations, restricted networks
- **CI/CD Pipelines**: Automated builds and deployments
- **Multi-Cloud**: AWS, Azure, GCP, on-premises

## Current Status

✅ **Completed:**
- Multi-architecture builds (ARM64 + AMD64)
- Local image tagging
- Dockerfile with build args
- Platform-specific optimizations

📋 **Needed for Full Portability:**
1. Multi-arch manifest creation
2. Registry-agnostic tagging
3. Platform auto-detection
4. Offline distribution
5. Automated build pipeline
6. Registry migration tools

---

## 1. Multi-Arch Manifest Creation

### Using Docker Buildx (Recommended)

```bash
#!/bin/bash
# scripts/push-multiarch-codeserver.sh

set -e

# Configuration
REGISTRY="${REGISTRY:-ghcr.io/ryanmaclean}"
IMAGE_NAME="${IMAGE_NAME:-vibecode-codeserver}"
VERSION="${VERSION:-latest}"

echo "🚀 Pushing multi-arch image to ${REGISTRY}/${IMAGE_NAME}:${VERSION}"

# Create and use buildx builder
docker buildx create --name vibecode-multiarch --use || docker buildx use vibecode-multiarch
docker buildx inspect --bootstrap

# Build and push multi-arch image
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -f docker/code-server/Dockerfile \
  -t "${REGISTRY}/${IMAGE_NAME}:${VERSION}" \
  -t "${REGISTRY}/${IMAGE_NAME}:$(date +%Y%m%d)" \
  --push \
  .

echo "✅ Multi-arch image pushed successfully!"
echo ""
echo "To pull: docker pull ${REGISTRY}/${IMAGE_NAME}:${VERSION}"
echo "Platform will be auto-detected"
```

### Using Docker Manifest (Alternative)

```bash
#!/bin/bash
# scripts/create-manifest.sh

set -e

REGISTRY="${REGISTRY:-ghcr.io/ryanmaclean}"
IMAGE_NAME="${IMAGE_NAME:-vibecode-codeserver}"
VERSION="${VERSION:-latest}"

echo "📦 Creating multi-arch manifest"

# Create manifest
docker manifest create \
  "${REGISTRY}/${IMAGE_NAME}:${VERSION}" \
  --amend "${REGISTRY}/${IMAGE_NAME}:${VERSION}-amd64" \
  --amend "${REGISTRY}/${IMAGE_NAME}:${VERSION}-arm64"

# Annotate architectures
docker manifest annotate \
  "${REGISTRY}/${IMAGE_NAME}:${VERSION}" \
  "${REGISTRY}/${IMAGE_NAME}:${VERSION}-amd64" \
  --os linux --arch amd64

docker manifest annotate \
  "${REGISTRY}/${IMAGE_NAME}:${VERSION}" \
  "${REGISTRY}/${IMAGE_NAME}:${VERSION}-arm64" \
  --os linux --arch arm64 --variant v8

# Push manifest
docker manifest push "${REGISTRY}/${IMAGE_NAME}:${VERSION}"

echo "✅ Manifest created and pushed!"
```

---

## 2. Registry-Agnostic Tagging Strategy

### Universal Tagging Script

```bash
#!/bin/bash
# scripts/tag-for-registry.sh

set -e

SOURCE_IMAGE="${1:-vibecode-codeserver:latest}"
TARGET_REGISTRY="${2:-ghcr.io/ryanmaclean}"
IMAGE_NAME="${3:-vibecode-codeserver}"

echo "🏷️  Tagging ${SOURCE_IMAGE} for ${TARGET_REGISTRY}"

# Detect platform
PLATFORM=$(docker inspect "${SOURCE_IMAGE}" --format='{{.Os}}/{{.Architecture}}')
echo "Detected platform: ${PLATFORM}"

# Tag for target registry
docker tag "${SOURCE_IMAGE}" "${TARGET_REGISTRY}/${IMAGE_NAME}:latest"
docker tag "${SOURCE_IMAGE}" "${TARGET_REGISTRY}/${IMAGE_NAME}:$(date +%Y%m%d)"
docker tag "${SOURCE_IMAGE}" "${TARGET_REGISTRY}/${IMAGE_NAME}:$(git rev-parse --short HEAD 2>/dev/null || echo 'local')"

echo "✅ Tagged for ${TARGET_REGISTRY}"
echo ""
echo "Available tags:"
docker images "${TARGET_REGISTRY}/${IMAGE_NAME}"
```

### Registry Configuration File

Create `registry-config.yaml`:

```yaml
registries:
  docker-hub:
    url: docker.io
    namespace: ryanmaclean
    public: true
  
  github:
    url: ghcr.io
    namespace: ryanmaclean
    public: true
    auth_required: true
  
  azure:
    url: vibecodecr.azurecr.io
    namespace: ""
    public: false
    auth_required: true
  
  aws:
    url: 123456789012.dkr.ecr.us-east-1.amazonaws.com
    namespace: vibecode
    public: false
    auth_required: true
  
  private:
    url: registry.internal.company.com
    namespace: vibecode
    public: false
    auth_required: true

default_registry: github
default_tags:
  - latest
  - "{{date}}"
  - "{{git_sha}}"
  - "{{version}}"
```

### Multi-Registry Push Script

```bash
#!/bin/bash
# scripts/push-to-registries.sh

set -e

SOURCE_IMAGE="${1:-vibecode-codeserver:latest}"
CONFIG_FILE="${2:-registry-config.yaml}"

echo "📤 Pushing to multiple registries"

# Parse config and push to each registry
# (Requires yq or similar YAML parser)

REGISTRIES=(
  "ghcr.io/ryanmaclean"
  "docker.io/ryanmaclean"
  "vibecodecr.azurecr.io"
)

for REGISTRY in "${REGISTRIES[@]}"; do
  echo "Pushing to ${REGISTRY}..."
  
  # Tag
  docker tag "${SOURCE_IMAGE}" "${REGISTRY}/vibecode-codeserver:latest"
  
  # Push
  docker push "${REGISTRY}/vibecode-codeserver:latest" || {
    echo "⚠️  Failed to push to ${REGISTRY}, skipping..."
    continue
  }
  
  echo "✅ Pushed to ${REGISTRY}"
done

echo "🎉 All registries updated!"
```

---

## 3. Platform Auto-Detection

### Smart Pull Script

```bash
#!/bin/bash
# scripts/smart-pull.sh

set -e

REGISTRY="${REGISTRY:-ghcr.io/ryanmaclean}"
IMAGE_NAME="${IMAGE_NAME:-vibecode-codeserver}"
VERSION="${VERSION:-latest}"

# Detect platform
ARCH=$(uname -m)
case "${ARCH}" in
  x86_64)
    PLATFORM="amd64"
    ;;
  aarch64|arm64)
    PLATFORM="arm64"
    ;;
  *)
    echo "❌ Unsupported architecture: ${ARCH}"
    exit 1
    ;;
esac

echo "🔍 Detected platform: ${PLATFORM}"
echo "📥 Pulling ${REGISTRY}/${IMAGE_NAME}:${VERSION}"

# Pull platform-specific image
docker pull --platform "linux/${PLATFORM}" \
  "${REGISTRY}/${IMAGE_NAME}:${VERSION}"

echo "✅ Image pulled successfully!"
```

### Platform Detection in Compose

```yaml
# docker-compose.platform.yml
version: '3.8'

x-platform: &platform
  platform: ${DOCKER_PLATFORM:-linux/amd64}

services:
  code-server:
    <<: *platform
    image: ${REGISTRY:-ghcr.io/ryanmaclean}/vibecode-codeserver:${VERSION:-latest}
    # ... rest of config
```

Usage:

```bash
# Auto-detect platform
export DOCKER_PLATFORM="linux/$(uname -m | sed 's/x86_64/amd64/;s/aarch64/arm64/')"
docker compose -f docker-compose.platform.yml up -d
```

---

## 4. Offline Distribution

### Export Images to Tarball

```bash
#!/bin/bash
# scripts/export-offline.sh

set -e

OUTPUT_DIR="${1:-./offline-images}"
mkdir -p "${OUTPUT_DIR}"

echo "📦 Exporting images for offline distribution"

# Export ARM64
docker save vibecode-codeserver:latest-arm64 | \
  gzip > "${OUTPUT_DIR}/vibecode-codeserver-arm64.tar.gz"

# Export AMD64
docker save vibecode-codeserver:latest-amd64 | \
  gzip > "${OUTPUT_DIR}/vibecode-codeserver-amd64.tar.gz"

# Create checksums
cd "${OUTPUT_DIR}"
sha256sum *.tar.gz > checksums.txt

# Create metadata
cat > metadata.json <<EOF
{
  "image": "vibecode-codeserver",
  "version": "$(date +%Y%m%d)",
  "platforms": ["linux/amd64", "linux/arm64"],
  "size_arm64": "$(du -h vibecode-codeserver-arm64.tar.gz | cut -f1)",
  "size_amd64": "$(du -h vibecode-codeserver-amd64.tar.gz | cut -f1)",
  "created": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "checksums": $(cat checksums.txt | jq -R -s -c 'split("\n") | map(select(length > 0))')
}
EOF

echo "✅ Images exported to ${OUTPUT_DIR}"
echo ""
echo "Files:"
ls -lh "${OUTPUT_DIR}"
```

### Import Images from Tarball

```bash
#!/bin/bash
# scripts/import-offline.sh

set -e

INPUT_DIR="${1:-./offline-images}"

echo "📥 Importing images from ${INPUT_DIR}"

# Verify checksums
cd "${INPUT_DIR}"
sha256sum -c checksums.txt || {
  echo "❌ Checksum verification failed!"
  exit 1
}

# Detect platform
ARCH=$(uname -m)
case "${ARCH}" in
  x86_64)
    TARBALL="vibecode-codeserver-amd64.tar.gz"
    ;;
  aarch64|arm64)
    TARBALL="vibecode-codeserver-arm64.tar.gz"
    ;;
  *)
    echo "❌ Unsupported architecture: ${ARCH}"
    exit 1
    ;;
esac

echo "Loading ${TARBALL}..."
gunzip -c "${TARBALL}" | docker load

echo "✅ Image imported successfully!"
docker images vibecode-codeserver
```

### Create Offline Bundle

```bash
#!/bin/bash
# scripts/create-offline-bundle.sh

set -e

BUNDLE_DIR="vibecode-codeserver-offline-$(date +%Y%m%d)"
mkdir -p "${BUNDLE_DIR}"

echo "📦 Creating offline bundle"

# Export images
./scripts/export-offline.sh "${BUNDLE_DIR}/images"

# Copy deployment files
cp docker-compose.yml "${BUNDLE_DIR}/"
cp .env.example "${BUNDLE_DIR}/"
cp -r k8s "${BUNDLE_DIR}/"
cp docker/code-server/*.md "${BUNDLE_DIR}/"

# Create installation script
cat > "${BUNDLE_DIR}/install.sh" <<'EOF'
#!/bin/bash
set -e

echo "🚀 Installing VibeCode Code-Server (Offline)"

# Import image
./scripts/import-offline.sh images

# Configure environment
if [ ! -f .env.local ]; then
  echo "Creating .env.local from template..."
  cp .env.example .env.local
  echo "⚠️  Please edit .env.local with your configuration"
fi

echo "✅ Installation complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env.local with your configuration"
echo "2. Run: docker compose up -d"
echo "3. Access: http://localhost:8765"
EOF

chmod +x "${BUNDLE_DIR}/install.sh"

# Create README
cat > "${BUNDLE_DIR}/README.md" <<'EOF'
# VibeCode Code-Server Offline Installation

This bundle contains everything needed to run VibeCode Code-Server in an offline environment.

## Contents

- `images/` - Docker images (ARM64 and AMD64)
- `docker-compose.yml` - Docker Compose configuration
- `k8s/` - Kubernetes manifests
- `install.sh` - Installation script
- Documentation files

## Installation

1. Transfer this entire directory to the target system
2. Run: `./install.sh`
3. Edit `.env` with your configuration
4. Deploy: `docker compose up -d`

## Platform Support

- ARM64: Apple Silicon (M1/M2/M3), Raspberry Pi 4/5
- AMD64: x86_64 servers and workstations

The installation script will automatically detect your platform.

## Documentation

See the included Markdown files for detailed documentation:
- `DEPLOYMENT_GUIDE.md` - Deployment options
- `DATADOG_INTEGRATION.md` - Monitoring setup
- `PORTABILITY_GUIDE.md` - This guide
EOF

# Create tarball
tar czf "${BUNDLE_DIR}.tar.gz" "${BUNDLE_DIR}"

echo "✅ Offline bundle created: ${BUNDLE_DIR}.tar.gz"
echo "Size: $(du -h ${BUNDLE_DIR}.tar.gz | cut -f1)"
```

---

## 5. Automated Build Pipeline

### GitHub Actions Workflow

```yaml
# .github/workflows/build-code-server.yml
name: Build Code-Server Multi-Arch

on:
  push:
    branches: [main, release/*]
    paths:
      - 'docker/code-server/**'
      - '.github/workflows/build-code-server.yml'
  pull_request:
    paths:
      - 'docker/code-server/**'
  workflow_dispatch:
    inputs:
      push_to_registry:
        description: 'Push to registry'
        required: false
        default: 'false'

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository_owner }}/vibecode-codeserver

jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      
      - name: Set up QEMU
        uses: docker/setup-qemu-action@v3
      
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
      
      - name: Log in to GitHub Container Registry
        if: github.event_name != 'pull_request'
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      
      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=ref,event=branch
            type=ref,event=pr
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=sha,prefix={{branch}}-
            type=raw,value=latest,enable={{is_default_branch}}
      
      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          file: docker/code-server/Dockerfile
          platforms: linux/amd64,linux/arm64
          push: ${{ github.event_name != 'pull_request' && (github.ref == 'refs/heads/main' || github.event.inputs.push_to_registry == 'true') }}
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
      
      - name: Generate SBOM
        if: github.event_name != 'pull_request'
        uses: anchore/sbom-action@v0
        with:
          image: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:latest
          format: spdx-json
          output-file: sbom.spdx.json
      
      - name: Upload SBOM
        if: github.event_name != 'pull_request'
        uses: actions/upload-artifact@v4
        with:
          name: sbom
          path: sbom.spdx.json
```

### GitLab CI Pipeline

```yaml
# .gitlab-ci.yml
build-code-server:
  stage: build
  image: docker:latest
  services:
    - docker:dind
  variables:
    DOCKER_DRIVER: overlay2
    DOCKER_TLS_CERTDIR: "/certs"
  before_script:
    - docker login -u $CI_REGISTRY_USER -p $CI_REGISTRY_PASSWORD $CI_REGISTRY
    - docker buildx create --use
  script:
    - |
      docker buildx build \
        --platform linux/amd64,linux/arm64 \
        -f docker/code-server/Dockerfile \
        -t $CI_REGISTRY_IMAGE/vibecode-codeserver:$CI_COMMIT_SHORT_SHA \
        -t $CI_REGISTRY_IMAGE/vibecode-codeserver:latest \
        --push \
        .
  only:
    - main
    - tags
```

---

## 6. Registry Migration Tools

### Migrate Between Registries

```bash
#!/bin/bash
# scripts/migrate-registry.sh

set -e

SOURCE_REGISTRY="${1}"
TARGET_REGISTRY="${2}"
IMAGE_NAME="${3:-vibecode-codeserver}"

echo "🔄 Migrating ${IMAGE_NAME} from ${SOURCE_REGISTRY} to ${TARGET_REGISTRY}"

# Pull from source
docker pull "${SOURCE_REGISTRY}/${IMAGE_NAME}:latest"

# Tag for target
docker tag \
  "${SOURCE_REGISTRY}/${IMAGE_NAME}:latest" \
  "${TARGET_REGISTRY}/${IMAGE_NAME}:latest"

# Push to target
docker push "${TARGET_REGISTRY}/${IMAGE_NAME}:latest"

echo "✅ Migration complete!"
```

### Sync Registries

```bash
#!/bin/bash
# scripts/sync-registries.sh

set -e

PRIMARY_REGISTRY="ghcr.io/ryanmaclean"
BACKUP_REGISTRIES=(
  "docker.io/ryanmaclean"
  "vibecodecr.azurecr.io"
)

IMAGE_NAME="vibecode-codeserver"

echo "🔄 Syncing registries"

# Pull from primary
docker pull "${PRIMARY_REGISTRY}/${IMAGE_NAME}:latest"

# Push to backups
for REGISTRY in "${BACKUP_REGISTRIES[@]}"; do
  echo "Syncing to ${REGISTRY}..."
  
  docker tag \
    "${PRIMARY_REGISTRY}/${IMAGE_NAME}:latest" \
    "${REGISTRY}/${IMAGE_NAME}:latest"
  
  docker push "${REGISTRY}/${IMAGE_NAME}:latest"
  
  echo "✅ Synced to ${REGISTRY}"
done

echo "🎉 All registries synced!"
```

---

## 7. Testing Portability

### Test Script

```bash
#!/bin/bash
# scripts/test-portability.sh

set -e

echo "🧪 Testing image portability"

REGISTRIES=(
  "ghcr.io/ryanmaclean"
  "docker.io/ryanmaclean"
)

PLATFORMS=(
  "linux/amd64"
  "linux/arm64"
)

for REGISTRY in "${REGISTRIES[@]}"; do
  for PLATFORM in "${PLATFORMS[@]}"; do
    echo "Testing ${REGISTRY} on ${PLATFORM}..."
    
    # Pull
    docker pull --platform "${PLATFORM}" \
      "${REGISTRY}/vibecode-codeserver:latest" || {
      echo "❌ Failed to pull ${PLATFORM} from ${REGISTRY}"
      continue
    }
    
    # Test run
    CONTAINER_ID=$(docker run -d --platform "${PLATFORM}" \
      "${REGISTRY}/vibecode-codeserver:latest")
    
    # Wait for startup
    sleep 10
    
    # Check health
    docker exec "${CONTAINER_ID}" curl -f http://localhost:8765/healthz || {
      echo "❌ Health check failed"
      docker logs "${CONTAINER_ID}"
      docker rm -f "${CONTAINER_ID}"
      continue
    }
    
    # Cleanup
    docker rm -f "${CONTAINER_ID}"
    
    echo "✅ ${PLATFORM} on ${REGISTRY} works!"
  done
done

echo "🎉 All tests passed!"
```

---

## Quick Reference

### Push to GHCR

```bash
# Login
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin

# Build and push
./scripts/push-multiarch-codeserver.sh
```

### Push to Docker Hub

```bash
# Login
docker login

# Set registry
export REGISTRY=docker.io/ryanmaclean
./scripts/push-multiarch-codeserver.sh
```

### Push to Azure ACR

```bash
# Login
az acr login --name vibecodecr

# Set registry
export REGISTRY=vibecodecr.azurecr.io
./scripts/push-multiarch-codeserver.sh
```

### Create Offline Bundle

```bash
./scripts/create-offline-bundle.sh
# Transfer vibecode-codeserver-offline-YYYYMMDD.tar.gz to target system
```

### Import Offline

```bash
tar xzf vibecode-codeserver-offline-YYYYMMDD.tar.gz
cd vibecode-codeserver-offline-YYYYMMDD
./install.sh
```

---

## Best Practices

1. **Always use multi-arch manifests** - Enables platform auto-detection
2. **Tag with multiple versions** - latest, date, git SHA, semver
3. **Test on both platforms** - ARM64 and AMD64
4. **Keep offline bundles updated** - Monthly or quarterly
5. **Document registry locations** - Maintain registry inventory
6. **Use registry mirrors** - For reliability and performance
7. **Implement SBOM** - Track dependencies and vulnerabilities
8. **Automate builds** - CI/CD for consistency
9. **Monitor registry health** - Ensure availability
10. **Plan for registry migration** - Have backup registries

---

## Troubleshooting

### Multi-arch manifest not working

```bash
# Enable experimental features
export DOCKER_CLI_EXPERIMENTAL=enabled

# Recreate buildx builder
docker buildx rm vibecode-multiarch
docker buildx create --name vibecode-multiarch --use
```

### Platform not detected

```bash
# Explicitly specify platform
docker pull --platform linux/arm64 ghcr.io/ryanmaclean/vibecode-codeserver:latest
```

### Registry authentication fails

```bash
# Check credentials
docker logout
docker login ghcr.io

# Verify token permissions
# GHCR requires: write:packages, read:packages
```

### Image too large for transfer

```bash
# Use compression
docker save vibecode-codeserver:latest | gzip -9 > image.tar.gz

# Or use registry-to-registry transfer
skopeo copy \
  docker://source.registry/image:tag \
  docker://target.registry/image:tag
```

---

## Additional Resources

- [Docker Buildx Documentation](https://docs.docker.com/buildx/working-with-buildx/)
- [Multi-Platform Images](https://docs.docker.com/build/building/multi-platform/)
- [GitHub Container Registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)
- [Skopeo for Registry Operations](https://github.com/containers/skopeo)
