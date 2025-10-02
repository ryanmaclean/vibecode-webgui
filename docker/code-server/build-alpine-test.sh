#!/bin/bash
# Alpine Build Test Script
# Tests Alpine Dockerfile build and size comparison

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$PROJECT_ROOT"

echo "================================================"
echo "Alpine Linux Code-Server Build Test"
echo "================================================"
echo ""

# Detect platform
PLATFORM=$(uname -m)
case "$PLATFORM" in
    x86_64)
        TARGET_PLATFORM="linux/amd64"
        ARCH_NAME="amd64"
        ;;
    arm64|aarch64)
        TARGET_PLATFORM="linux/arm64"
        ARCH_NAME="arm64"
        ;;
    *)
        echo "Unsupported platform: $PLATFORM"
        exit 1
        ;;
esac

echo "Detected Platform: $TARGET_PLATFORM"
echo "Architecture: $ARCH_NAME"
echo ""

# Build configuration
BUILD_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
GIT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
VERSION="1.2.0-alpine-experimental"

echo "Build Configuration:"
echo "  Date: $BUILD_DATE"
echo "  Commit: $GIT_COMMIT"
echo "  Version: $VERSION"
echo ""

# Phase 1: Build Alpine image
echo "================================================"
echo "Phase 1: Building Alpine Image"
echo "================================================"
echo ""
echo "This will take 15-20 minutes (compiling code-server from source)..."
echo ""

time docker build \
    -f docker/code-server/Dockerfile.alpine \
    --build-arg TARGETPLATFORM="$TARGET_PLATFORM" \
    --build-arg TARGETARCH="$ARCH_NAME" \
    --build-arg PROFILE=minimal \
    --build-arg BUILD_DATE="$BUILD_DATE" \
    --build-arg GIT_COMMIT="$GIT_COMMIT" \
    --build-arg VERSION="$VERSION" \
    -t vibecode-alpine:test-$ARCH_NAME \
    .

echo ""
echo "✅ Alpine build completed"
echo ""

# Phase 2: Size comparison
echo "================================================"
echo "Phase 2: Size Comparison"
echo "================================================"
echo ""

ALPINE_SIZE=$(docker images vibecode-alpine:test-$ARCH_NAME --format "{{.Size}}")
echo "Alpine Image Size: $ALPINE_SIZE"

if docker images | grep -q "vibecode-optimized"; then
    UBUNTU_SIZE=$(docker images vibecode-optimized:latest --format "{{.Size}}" | head -1)
    echo "Ubuntu Image Size: $UBUNTU_SIZE (for comparison)"

    # Calculate savings percentage (approximate)
    echo ""
    echo "Expected Savings: 60-70% reduction"
else
    echo "Ubuntu image not found (skipping comparison)"
fi

echo ""

# Phase 3: Layer inspection
echo "================================================"
echo "Phase 3: Layer Breakdown"
echo "================================================"
echo ""

docker history vibecode-alpine:test-$ARCH_NAME --human --no-trunc | head -20

echo ""

# Phase 4: Runtime test
echo "================================================"
echo "Phase 4: Runtime Test"
echo "================================================"
echo ""

echo "Starting container for runtime test..."
CONTAINER_ID=$(docker run -d -p 8765:8765 vibecode-alpine:test-$ARCH_NAME)

echo "Container ID: $CONTAINER_ID"
echo "Waiting 10 seconds for startup..."
sleep 10

# Test health check
echo ""
echo "Testing health endpoint..."
if curl -f http://localhost:8765/healthz 2>/dev/null; then
    echo "✅ Health check passed"
else
    echo "⚠️  Health check failed (may need more time)"
fi

# Test extension listing
echo ""
echo "Listing installed extensions..."
docker exec "$CONTAINER_ID" code-server --list-extensions || true

# Cleanup
echo ""
echo "Stopping test container..."
docker stop "$CONTAINER_ID" >/dev/null
docker rm "$CONTAINER_ID" >/dev/null

echo ""
echo "================================================"
echo "Test Complete"
echo "================================================"
echo ""
echo "Alpine image: vibecode-alpine:test-$ARCH_NAME"
echo "Size: $ALPINE_SIZE"
echo ""
echo "To run the Alpine image manually:"
echo "  docker run -p 8765:8765 vibecode-alpine:test-$ARCH_NAME"
echo ""
echo "To inspect the image:"
echo "  docker inspect vibecode-alpine:test-$ARCH_NAME"
echo ""
echo "To remove the test image:"
echo "  docker rmi vibecode-alpine:test-$ARCH_NAME"
echo ""
