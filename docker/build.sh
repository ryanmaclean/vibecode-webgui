#!/bin/bash
# VibeCode Docker Build Script
# Usage: ./build.sh [target] [options]

set -e

# Source Datadog logging library if available
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$SCRIPT_DIR/../scripts/lib/datadog-logging.sh" ]; then
    source "$SCRIPT_DIR/../scripts/lib/datadog-logging.sh"
elif [ -f "scripts/lib/datadog-logging.sh" ]; then
    source "scripts/lib/datadog-logging.sh"
fi

# Log script execution start
dd_info "Docker build script started" "action:start"

# Default values
TARGET="production"
TAG="vibecode-webgui"
PUSH=false
PLATFORM="linux/amd64"
CACHE_FROM=""
CACHE_TO=""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [target] [options]"
    echo ""
    echo "Targets:"
    echo "  dev         - Development environment"
    echo "  prod        - Production environment"
    echo "  test        - Testing environment"
    echo "  aks         - AKS production with Datadog"
    echo "  ingestion   - RAG ingestion worker"
    echo ""
    echo "Options:"
    echo "  --tag TAG           - Image tag (default: vibecode-webgui)"
    echo "  --push              - Push to registry after build"
    echo "  --platform PLATFORM - Target platform (default: linux/amd64)"
    echo "  --cache-from CACHE  - Cache from registry"
    echo "  --cache-to CACHE    - Cache to registry"
    echo "  --help              - Show this help"
    echo ""
    echo "Examples:"
    echo "  $0 dev"
    echo "  $0 prod --tag vibecode-webgui:latest --push"
    echo "  $0 aks --platform linux/amd64,linux/arm64 --push"
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        dev|prod|test|aks|ingestion)
            TARGET="$1"
            shift
            ;;
        --tag)
            TAG="$2"
            shift 2
            ;;
        --push)
            PUSH=true
            shift
            ;;
        --platform)
            PLATFORM="$2"
            shift 2
            ;;
        --cache-from)
            CACHE_FROM="$2"
            shift 2
            ;;
        --cache-to)
            CACHE_TO="$2"
            shift 2
            ;;
        --help)
            show_usage
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Set build arguments based on target
case $TARGET in
    dev)
        BUILD_ARGS="--build-arg NODE_VERSION=24 --build-arg BASE_OS=alpine --build-arg INCLUDE_DEV_DEPS=true --build-arg ENABLE_LIGHTNINGCSS=true --build-arg ENABLE_PRISMA=true"
        DOCKERFILE_TARGET="development"
        ;;
    prod)
        BUILD_ARGS="--build-arg NODE_VERSION=24 --build-arg BASE_OS=alpine --build-arg BUILD_TARGET=production --build-arg INCLUDE_DEV_DEPS=false --build-arg ENABLE_SOURCE_MAPS=true --build-arg ENABLE_DATADOG=true --build-arg ENABLE_LIGHTNINGCSS=true --build-arg ENABLE_PRISMA=true --build-arg ENABLE_HEALTH_CHECK=true"
        DOCKERFILE_TARGET="production"
        ;;
    test)
        BUILD_ARGS="--build-arg NODE_VERSION=24 --build-arg BASE_OS=alpine --build-arg INCLUDE_DEV_DEPS=true --build-arg ENABLE_LIGHTNINGCSS=true --build-arg ENABLE_PRISMA=true"
        DOCKERFILE_TARGET="testing"
        ;;
    aks)
        BUILD_ARGS="--build-arg NODE_VERSION=24 --build-arg BASE_OS=alpine --build-arg BUILD_TARGET=production --build-arg INCLUDE_DEV_DEPS=false --build-arg ENABLE_SOURCE_MAPS=true --build-arg ENABLE_DATADOG=true --build-arg ENABLE_LIGHTNINGCSS=true --build-arg ENABLE_PRISMA=true --build-arg ENABLE_HEALTH_CHECK=true"
        DOCKERFILE_TARGET="production"
        ;;
    ingestion)
        BUILD_ARGS="--build-arg NODE_VERSION=24 --build-arg BASE_OS=alpine"
        DOCKERFILE_TARGET="ingestion"
        ;;
    *)
        print_error "Invalid target: $TARGET"
        show_usage
        exit 1
        ;;
esac

# Build the docker build command
BUILD_CMD="docker buildx build"
BUILD_CMD="$BUILD_CMD --platform $PLATFORM"
BUILD_CMD="$BUILD_CMD --target $DOCKERFILE_TARGET"
BUILD_CMD="$BUILD_CMD --tag $TAG"
BUILD_CMD="$BUILD_CMD $BUILD_ARGS"

# Add cache options if provided
if [ -n "$CACHE_FROM" ]; then
    BUILD_CMD="$BUILD_CMD --cache-from $CACHE_FROM"
fi

if [ -n "$CACHE_TO" ]; then
    BUILD_CMD="$BUILD_CMD --cache-to $CACHE_TO"
fi

# Add push option
if [ "$PUSH" = true ]; then
    BUILD_CMD="$BUILD_CMD --push"
fi

# Add context
BUILD_CMD="$BUILD_CMD -f docker/Dockerfile ."

# Print build information
print_status "Building VibeCode WebGUI Docker image"
print_status "Target: $TARGET"
print_status "Tag: $TAG"
print_status "Platform: $PLATFORM"
print_status "Dockerfile Target: $DOCKERFILE_TARGET"
if [ "$PUSH" = true ]; then
    print_status "Push: Enabled"
else
    print_status "Push: Disabled"
fi

# Execute the build
print_status "Executing: $BUILD_CMD"
dd_info "Starting Docker build" "target:$TARGET,tag:$TAG,platform:$PLATFORM"
BUILD_START_TIME=$(date +%s)
if eval $BUILD_CMD; then
    BUILD_END_TIME=$(date +%s)
    BUILD_DURATION=$((BUILD_END_TIME - BUILD_START_TIME))
    dd_info "Build completed successfully" "target:$TARGET,tag:$TAG,duration:${BUILD_DURATION}s"
    dd_metric "docker.build.duration" "$BUILD_DURATION" "gauge" "target:$TARGET"
    dd_metric "docker.build.success" "1" "count" "target:$TARGET"
    print_success "Build completed successfully!"
    print_success "Image: $TAG"
else
    dd_error "Build failed" "target:$TARGET,tag:$TAG"
    dd_metric "docker.build.failure" "1" "count" "target:$TARGET"
    print_error "Build failed!"
    exit 1
fi
