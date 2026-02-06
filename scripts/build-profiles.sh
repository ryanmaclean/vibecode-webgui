#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

# Build and push code-server with different profiles
# Usage: ./scripts/build-profiles.sh [version] [profile]

# Initialize log aggregation
init_log_aggregation


set -e

VERSION="${1:-1.0.0}"
PROFILE="${2:-all}"
BUILD_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
GIT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")

# Registries
GHCR="ghcr.io/ryanmaclean"
DOCKERHUB="ryanmaclean"  # Change to your Docker Hub username

IMAGE_NAME="vibecode-codeserver"

echo "🚀 Building VibeCode Code-Server"
echo "=================================="
echo "Version: $VERSION"
echo "Profile: $PROFILE"
echo "Build Date: $BUILD_DATE"
echo "Git Commit: $GIT_COMMIT"
echo ""

# Function to build and push a profile
build_profile() {
    local profile=$1
    local tag_suffix=$2
    
    echo "📦 Building profile: $profile"
    
    # Build for both architectures
    docker buildx build \
        --platform linux/amd64,linux/arm64 \
        -f docker/code-server/Dockerfile \
        --build-arg PROFILE=$profile \
        --build-arg BUILD_DATE="$BUILD_DATE" \
        --build-arg GIT_COMMIT="$GIT_COMMIT" \
        --build-arg VERSION="$VERSION" \
        -t "${GHCR}/${IMAGE_NAME}:${VERSION}${tag_suffix}" \
        -t "${GHCR}/${IMAGE_NAME}:${profile}" \
        -t "${DOCKERHUB}/${IMAGE_NAME}:${VERSION}${tag_suffix}" \
        -t "${DOCKERHUB}/${IMAGE_NAME}:${profile}" \
        --push \
        .
    
    echo "✅ Pushed $profile to both registries"
}

# Build profiles
case $PROFILE in
    minimal)
        build_profile "minimal" "-minimal"
        ;;
    standard)
        build_profile "standard" "-standard"
        ;;
    ai)
        build_profile "ai" "-ai"
        ;;
    web)
        build_profile "web" "-web"
        ;;
    full)
        build_profile "full" ""
        # Also tag as latest
        docker buildx imagetools create \
            -t "${GHCR}/${IMAGE_NAME}:latest" \
            -t "${DOCKERHUB}/${IMAGE_NAME}:latest" \
            "${GHCR}/${IMAGE_NAME}:${VERSION}"
        ;;
    all)
        echo "🏗️  Building all profiles..."
        build_profile "minimal" "-minimal"
        build_profile "standard" "-standard"
        build_profile "ai" "-ai"
        build_profile "web" "-web"
        build_profile "full" ""
        
        # Tag full as latest
        docker buildx imagetools create \
            -t "${GHCR}/${IMAGE_NAME}:latest" \
            -t "${DOCKERHUB}/${IMAGE_NAME}:latest" \
            "${GHCR}/${IMAGE_NAME}:${VERSION}"
        ;;
    *)
        echo "❌ Unknown profile: $PROFILE"
        echo "Available: minimal, standard, ai, web, full, all"
        exit 1
        ;;
esac

echo ""
echo "✅ Build complete!"
echo ""
echo "📦 Images available:"
echo "  GHCR:"
echo "    - ${GHCR}/${IMAGE_NAME}:${VERSION}"
echo "    - ${GHCR}/${IMAGE_NAME}:${PROFILE}"
echo "  Docker Hub:"
echo "    - ${DOCKERHUB}/${IMAGE_NAME}:${VERSION}"
echo "    - ${DOCKERHUB}/${IMAGE_NAME}:${PROFILE}"
echo ""
echo "🚀 To use:"
echo "  docker pull ${DOCKERHUB}/${IMAGE_NAME}:${PROFILE}"
echo ""
