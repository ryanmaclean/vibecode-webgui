#!/bin/bash
# Enhanced Docker Build Script with BuildKit Optimizations
# Container Team: Production-ready build automation

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
IMAGE_NAME="vibecode-webgui"
REGISTRY=""
BUILD_CONTEXT="."
DOCKERFILE="Dockerfile.production.enhanced"
PLATFORM="linux/amd64,linux/arm64"
PUSH=false
CACHE_FROM=""
CACHE_TO=""
BUILD_ARGS=""
TAGS=""
VERBOSE=false
DRY_RUN=false
PROFILE="production"
OPTIMIZE_CONTEXT=true

# Build metadata
BUILD_DATE=$(date -u +'%Y-%m-%dT%H:%M:%SZ')
BUILD_VERSION="${VERSION:-latest}"
BUILD_COMMIT="${GITHUB_SHA:-$(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')}"

usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Build optimized Docker images with BuildKit

Options:
    -n, --name NAME          Image name (default: vibecode-webgui)
    -r, --registry REGISTRY  Registry URL (e.g., ghcr.io/org)
    -f, --file DOCKERFILE    Dockerfile path (default: Dockerfile.production.enhanced)
    -t, --tag TAG            Additional tags (can be used multiple times)
    -p, --platform PLATFORM  Target platforms (default: linux/amd64,linux/arm64)
    --push                   Push to registry after build
    --cache-from SOURCE      Cache source (e.g., type=registry,ref=image:cache)
    --cache-to DEST          Cache destination
    --build-arg ARG=VALUE    Build argument (can be used multiple times)
    --profile PROFILE        Build profile: production|development|testing
    --verbose                Enable verbose output
    --dry-run                Show commands without executing
    --no-context-optimize    Disable build context optimization
    -h, --help              Show this help

Profiles:
    production    - Multi-platform, optimized for size and performance
    development   - Single platform, fast builds with dev tools
    testing       - Include test dependencies and tools

Examples:
    # Basic production build
    $0
    
    # Build and push to registry
    $0 --registry ghcr.io/org --push
    
    # Development build with cache
    $0 --profile development --cache-from type=local,src=/tmp/buildx-cache
    
    # Multi-tag build
    $0 --tag latest --tag v1.0.0 --tag main
    
    # Custom build args
    $0 --build-arg NODE_VERSION=20-alpine --build-arg BUILD_ENV=staging

EOF
}

log() {
    echo -e "${BLUE}[$(date +'%H:%M:%S')]${NC} $1" >&2
}

warn() {
    echo -e "${YELLOW}[$(date +'%H:%M:%S')] WARNING:${NC} $1" >&2
}

error() {
    echo -e "${RED}[$(date +'%H:%M:%S')] ERROR:${NC} $1" >&2
}

success() {
    echo -e "${GREEN}[$(date +'%H:%M:%S')] SUCCESS:${NC} $1" >&2
}

check_prerequisites() {
    log "Checking prerequisites..."
    
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed or not in PATH"
        exit 1
    fi
    
    # Check Docker BuildKit support
    if ! docker buildx version &> /dev/null; then
        error "Docker BuildKit/buildx is not available"
        exit 1
    fi
    
    # Check if Docker daemon is running
    if ! docker info &> /dev/null; then
        error "Docker daemon is not running"
        exit 1
    fi
    
    success "Prerequisites check passed"
}

optimize_build_context() {
    if [[ "$OPTIMIZE_CONTEXT" == "true" ]]; then
        log "Optimizing build context..."
        
        # Use enhanced .dockerignore if available
        if [[ -f ".dockerignore.enhanced" ]]; then
            log "Using enhanced .dockerignore"
            cp .dockerignore.enhanced .dockerignore.backup
        fi
        
        # Calculate build context size
        local context_size
        context_size=$(du -sh "$BUILD_CONTEXT" 2>/dev/null | cut -f1 || echo "unknown")
        log "Build context size: $context_size"
        
        # Warn if context is large
        if [[ "$context_size" =~ ^[0-9]+G ]]; then
            warn "Large build context detected ($context_size). Consider optimizing .dockerignore"
        fi
    fi
}

setup_buildx() {
    log "Setting up buildx builder..."
    
    local builder_name="vibecode-builder"
    
    # Create builder if it doesn't exist
    if ! docker buildx inspect "$builder_name" &> /dev/null; then
        log "Creating buildx builder: $builder_name"
        docker buildx create --name "$builder_name" --driver docker-container --bootstrap
    fi
    
    # Use the builder
    docker buildx use "$builder_name"
    
    success "Buildx builder ready"
}

build_tags() {
    local image_ref="$1"
    local tags_array=()
    
    # Add default tag
    tags_array+=("--tag" "${image_ref}:${BUILD_VERSION}")
    
    # Add additional tags
    if [[ -n "$TAGS" ]]; then
        IFS=',' read -ra tag_list <<< "$TAGS"
        for tag in "${tag_list[@]}"; do
            tags_array+=("--tag" "${image_ref}:${tag}")
        done
    fi
    
    echo "${tags_array[@]}"
}

build_cache_args() {
    local cache_args=()
    
    if [[ -n "$CACHE_FROM" ]]; then
        cache_args+=("--cache-from" "$CACHE_FROM")
    fi
    
    if [[ -n "$CACHE_TO" ]]; then
        cache_args+=("--cache-to" "$CACHE_TO")
    fi
    
    # Add default registry cache if pushing
    if [[ "$PUSH" == "true" ]] && [[ -n "$REGISTRY" ]] && [[ -z "$CACHE_TO" ]]; then
        local cache_ref="${REGISTRY}/${IMAGE_NAME}:buildcache"
        cache_args+=("--cache-to" "type=registry,ref=${cache_ref},mode=max")
        cache_args+=("--cache-from" "type=registry,ref=${cache_ref}")
        log "Using registry cache: $cache_ref"
    fi
    
    echo "${cache_args[@]}"
}

build_args() {
    local build_args_array=()
    
    # Add standard build args
    build_args_array+=("--build-arg" "BUILD_DATE=${BUILD_DATE}")
    build_args_array+=("--build-arg" "BUILD_VERSION=${BUILD_VERSION}")
    build_args_array+=("--build-arg" "BUILD_COMMIT=${BUILD_COMMIT}")
    build_args_array+=("--build-arg" "BUILDKIT_INLINE_CACHE=1")
    
    # Add profile-specific args
    case "$PROFILE" in
        "production")
            build_args_array+=("--build-arg" "NODE_VERSION=20-slim")
            build_args_array+=("--build-arg" "BUILD_ENV=production")
            ;;
        "development")
            build_args_array+=("--build-arg" "NODE_VERSION=20-slim")
            build_args_array+=("--build-arg" "DEV_MODE=true")
            ;;
        "testing")
            build_args_array+=("--build-arg" "NODE_VERSION=20-slim")
            build_args_array+=("--build-arg" "INCLUDE_TEST_DEPS=true")
            ;;
    esac
    
    # Add custom build args
    if [[ -n "$BUILD_ARGS" ]]; then
        IFS=',' read -ra args_list <<< "$BUILD_ARGS"
        for arg in "${args_list[@]}"; do
            build_args_array+=("--build-arg" "$arg")
        done
    fi
    
    echo "${build_args_array[@]}"
}

get_dockerfile() {
    case "$PROFILE" in
        "development")
            echo "Dockerfile.dev.enhanced"
            ;;
        "testing")
            echo "Dockerfile.dev.enhanced"
            ;;
        *)
            echo "$DOCKERFILE"
            ;;
    esac
}

get_target() {
    case "$PROFILE" in
        "development")
            echo "--target development"
            ;;
        "testing")
            echo "--target testing"
            ;;
        *)
            echo ""
            ;;
    esac
}

build_image() {
    local dockerfile
    dockerfile=$(get_dockerfile)
    
    local target
    target=$(get_target)
    
    local image_ref
    if [[ -n "$REGISTRY" ]]; then
        image_ref="${REGISTRY}/${IMAGE_NAME}"
    else
        image_ref="$IMAGE_NAME"
    fi
    
    log "Building Docker image..."
    log "Image: $image_ref"
    log "Dockerfile: $dockerfile"
    log "Profile: $PROFILE"
    log "Platform: $PLATFORM"
    
    # Build command array
    local cmd=("docker" "buildx" "build")
    
    # Add basic options
    cmd+=("--file" "$dockerfile")
    cmd+=("--platform" "$PLATFORM")
    
    # Add target if specified
    if [[ -n "$target" ]]; then
        cmd+=($target)
    fi
    
    # Add tags
    local tags_args
    tags_args=$(build_tags "$image_ref")
    cmd+=($tags_args)
    
    # Add cache options
    local cache_args
    cache_args=$(build_cache_args)
    if [[ -n "$cache_args" ]]; then
        cmd+=($cache_args)
    fi
    
    # Add build args
    local build_args_array
    build_args_array=$(build_args)
    cmd+=($build_args_array)
    
    # Add push option
    if [[ "$PUSH" == "true" ]]; then
        cmd+=("--push")
    else
        cmd+=("--load")
    fi
    
    # Add verbose output
    if [[ "$VERBOSE" == "true" ]]; then
        cmd+=("--progress" "plain")
    fi
    
    # Add build context
    cmd+=("$BUILD_CONTEXT")
    
    # Execute or show command
    if [[ "$DRY_RUN" == "true" ]]; then
        log "DRY RUN - Command that would be executed:"
        echo "${cmd[@]}"
    else
        log "Executing build command..."
        if [[ "$VERBOSE" == "true" ]]; then
            echo "Command: ${cmd[@]}"
        fi
        
        local start_time
        start_time=$(date +%s)
        
        "${cmd[@]}"
        
        local end_time
        end_time=$(date +%s)
        local duration=$((end_time - start_time))
        
        success "Build completed in ${duration}s"
    fi
}

show_summary() {
    log "Build Summary:"
    echo "  Image Name:    $IMAGE_NAME"
    echo "  Registry:      ${REGISTRY:-'local'}"
    echo "  Profile:       $PROFILE"
    echo "  Dockerfile:    $(get_dockerfile)"
    echo "  Platform:      $PLATFORM"
    echo "  Version:       $BUILD_VERSION"
    echo "  Commit:        $BUILD_COMMIT"
    echo "  Push:          $PUSH"
    echo "  Build Date:    $BUILD_DATE"
}

cleanup() {
    if [[ -f ".dockerignore.backup" ]]; then
        mv .dockerignore.backup .dockerignore
        log "Restored original .dockerignore"
    fi
}

trap cleanup EXIT

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -n|--name)
            IMAGE_NAME="$2"
            shift 2
            ;;
        -r|--registry)
            REGISTRY="$2"
            shift 2
            ;;
        -f|--file)
            DOCKERFILE="$2"
            shift 2
            ;;
        -t|--tag)
            if [[ -n "$TAGS" ]]; then
                TAGS="$TAGS,$2"
            else
                TAGS="$2"
            fi
            shift 2
            ;;
        -p|--platform)
            PLATFORM="$2"
            shift 2
            ;;
        --push)
            PUSH=true
            shift
            ;;
        --cache-from)
            CACHE_FROM="$2"
            shift 2
            ;;
        --cache-to)
            CACHE_TO="$2"
            shift 2
            ;;
        --build-arg)
            if [[ -n "$BUILD_ARGS" ]]; then
                BUILD_ARGS="$BUILD_ARGS,$2"
            else
                BUILD_ARGS="$2"
            fi
            shift 2
            ;;
        --profile)
            PROFILE="$2"
            shift 2
            ;;
        --verbose)
            VERBOSE=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --no-context-optimize)
            OPTIMIZE_CONTEXT=false
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            error "Unknown option: $1"
            usage
            exit 1
            ;;
    esac
done

# Validate profile
case "$PROFILE" in
    "production"|"development"|"testing")
        ;;
    *)
        error "Invalid profile: $PROFILE. Must be one of: production, development, testing"
        exit 1
        ;;
esac

# Main execution
main() {
    log "Starting optimized Docker build..."
    
    show_summary
    
    check_prerequisites
    optimize_build_context
    setup_buildx
    build_image
    
    success "Docker build completed successfully!"
    
    if [[ "$PUSH" == "true" ]]; then
        success "Image pushed to registry"
    else
        log "Image available locally. Use 'docker images $IMAGE_NAME' to see it."
    fi
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
