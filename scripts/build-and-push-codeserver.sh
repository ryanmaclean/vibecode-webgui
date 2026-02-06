#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

# Build and push multi-architecture code-server images
# Usage: ./scripts/build-and-push-codeserver.sh [version]
# 
# Prerequisites:
# - Docker logged in to GHCR: echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin
# - Or set GITHUB_TOKEN environment variable

# Initialize log aggregation
init_log_aggregation


set -e

# Configuration
REGISTRY="${REGISTRY:-ghcr.io/ryanmaclean}"
IMAGE_NAME="vibecode-codeserver"
VERSION="${1:-1.0.0}"
BUILD_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
GIT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")

echo "🚀 Building VibeCode Code-Server"
echo "=================================="
echo "Registry: $REGISTRY"
echo "Image: $IMAGE_NAME"
echo "Version: $VERSION"
echo "Build Date: $BUILD_DATE"
echo "Git Commit: $GIT_COMMIT"
echo ""

# Check if logged in to GHCR
if ! docker info 2>/dev/null | grep -q "ghcr.io"; then
    echo "⚠️  Not logged in to GHCR"
    if [ -n "$GITHUB_TOKEN" ]; then
        echo "🔐 Logging in to GHCR using GITHUB_TOKEN..."
        echo "$GITHUB_TOKEN" | docker login ghcr.io -u ryanmaclean --password-stdin
    else
        echo "❌ Please login to GHCR first:"
        echo "   export GITHUB_TOKEN=your_token"
        echo "   echo \$GITHUB_TOKEN | docker login ghcr.io -u ryanmaclean --password-stdin"
        exit 1
    fi
fi
echo ""

# Clean up old builds
echo "🧹 Cleaning up old images..."
docker images | grep "$IMAGE_NAME" | awk '{print $3}' | xargs -r docker rmi -f 2>/dev/null || true
docker buildx prune -f

# Create/use buildx builder
echo "🔧 Setting up buildx builder..."
docker buildx create --name vibecode-builder --use 2>/dev/null || docker buildx use vibecode-builder

# Build multi-arch image
echo ""
echo "🏗️  Building multi-architecture images..."
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -f docker/code-server/Dockerfile \
  -t "${REGISTRY}/${IMAGE_NAME}:${VERSION}" \
  -t "${REGISTRY}/${IMAGE_NAME}:latest" \
  --build-arg BUILD_DATE="${BUILD_DATE}" \
  --build-arg GIT_COMMIT="${GIT_COMMIT}" \
  --build-arg VERSION="${VERSION}" \
  --push \
  .

echo ""
echo "✅ Build and push complete!"
echo ""
echo "📦 Images pushed:"
echo "  - ${REGISTRY}/${IMAGE_NAME}:${VERSION}"
echo "  - ${REGISTRY}/${IMAGE_NAME}:latest"
echo ""
echo "🔍 To pull:"
echo "  docker pull ${REGISTRY}/${IMAGE_NAME}:${VERSION}"
echo ""
echo "🚀 To run:"
echo "  docker run -d -p 8765:8765 -p 46203:46203 \\"
echo "    -e PASSWORD=your-password \\"
echo "    ${REGISTRY}/${IMAGE_NAME}:${VERSION}"
echo ""

# Clean up builder
docker buildx rm vibecode-builder 2>/dev/null || true

echo "✨ Done!"
