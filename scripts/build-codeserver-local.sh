#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

# Build multi-architecture code-server images locally (no push)
# Usage: ./scripts/build-codeserver-local.sh [version]

# Initialize log aggregation
init_log_aggregation


set -e

# Configuration
IMAGE_NAME="vibecode-codeserver"
VERSION="${1:-1.0.0}"
BUILD_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
GIT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")

echo "🚀 Building VibeCode Code-Server (Local)"
echo "========================================="
echo "Image: $IMAGE_NAME"
echo "Version: $VERSION"
echo "Build Date: $BUILD_DATE"
echo "Git Commit: $GIT_COMMIT"
echo ""

# Clean up old builds
echo "🧹 Cleaning up old images..."
docker images | grep "$IMAGE_NAME" | awk '{print $3}' | xargs -r docker rmi -f 2>/dev/null || true

# Build AMD64
echo ""
echo "🏗️  Building AMD64 image..."
docker buildx build \
  --platform linux/amd64 \
  -f docker/code-server/Dockerfile \
  -t "${IMAGE_NAME}:${VERSION}-amd64" \
  -t "${IMAGE_NAME}:latest-amd64" \
  --build-arg BUILD_DATE="${BUILD_DATE}" \
  --build-arg GIT_COMMIT="${GIT_COMMIT}" \
  --build-arg VERSION="${VERSION}" \
  --load \
  .

# Build ARM64
echo ""
echo "🏗️  Building ARM64 image..."
docker buildx build \
  --platform linux/arm64 \
  -f docker/code-server/Dockerfile \
  -t "${IMAGE_NAME}:${VERSION}-arm64" \
  -t "${IMAGE_NAME}:latest-arm64" \
  --build-arg BUILD_DATE="${BUILD_DATE}" \
  --build-arg GIT_COMMIT="${GIT_COMMIT}" \
  --build-arg VERSION="${VERSION}" \
  --load \
  .

# Tag the native architecture as latest
ARCH=$(uname -m)
if [ "$ARCH" = "arm64" ] || [ "$ARCH" = "aarch64" ]; then
    docker tag "${IMAGE_NAME}:${VERSION}-arm64" "${IMAGE_NAME}:${VERSION}"
    docker tag "${IMAGE_NAME}:${VERSION}-arm64" "${IMAGE_NAME}:latest"
else
    docker tag "${IMAGE_NAME}:${VERSION}-amd64" "${IMAGE_NAME}:${VERSION}"
    docker tag "${IMAGE_NAME}:${VERSION}-amd64" "${IMAGE_NAME}:latest"
fi

echo ""
echo "✅ Build complete!"
echo ""
echo "📦 Images built:"
echo "  - ${IMAGE_NAME}:${VERSION}"
echo "  - ${IMAGE_NAME}:latest"
echo ""
echo "🚀 To run:"
echo "  docker run -d -p 8765:8765 -p 46203:46203 \\"
echo "    -e PASSWORD=your-password \\"
echo "    ${IMAGE_NAME}:${VERSION}"
echo ""
echo "✨ Done!"
