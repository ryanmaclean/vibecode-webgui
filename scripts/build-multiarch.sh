#!/bin/bash

# Multi-architecture Docker build script for VibeCode WebGUI
# Supports ARM64 (Apple Silicon, ARM servers) and AMD64 (Intel/AMD)

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REGISTRY=${REGISTRY:-""}
IMAGE_NAME=${IMAGE_NAME:-"vibecode-webgui"}
TAG=${TAG:-"latest"}
DOCKERFILE=${DOCKERFILE:-"Dockerfile.multiarch"}
PUSH=${PUSH:-"false"}
BUILD_ARGS=${BUILD_ARGS:-""}

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

# Function to check if Docker buildx is available
check_buildx() {
    if ! docker buildx version > /dev/null 2>&1; then
        print_error "Docker buildx is required for multi-architecture builds"
        print_status "Installing Docker buildx..."
        
        # Try to enable buildx if available
        if docker buildx create --name multiarch-builder --use > /dev/null 2>&1; then
            print_success "Docker buildx enabled"
        else
            print_error "Failed to enable Docker buildx"
            exit 1
        fi
    else
        print_success "Docker buildx is available"
    fi
}

# Function to create or use buildx builder
setup_builder() {
    local builder_name="vibecode-multiarch-builder"
    
    print_status "Setting up multi-architecture builder..."
    
    # Check if builder exists
    if docker buildx inspect $builder_name > /dev/null 2>&1; then
        print_status "Using existing builder: $builder_name"
        docker buildx use $builder_name
    else
        print_status "Creating new builder: $builder_name"
        docker buildx create \
            --name $builder_name \
            --driver docker-container \
            --bootstrap \
            --use
        
        # Inspect the builder to ensure it supports required platforms
        docker buildx inspect --bootstrap
    fi
}

# Function to build multi-architecture image
build_image() {
    local full_image_name="${REGISTRY:+$REGISTRY/}$IMAGE_NAME:$TAG"
    local platforms="linux/amd64,linux/arm64"
    
    print_status "Building multi-architecture image: $full_image_name"
    print_status "Target platforms: $platforms"
    print_status "Using Dockerfile: $DOCKERFILE"
    
    # Build command
    local build_cmd="docker buildx build"
    build_cmd="$build_cmd --platform $platforms"
    build_cmd="$build_cmd --file $DOCKERFILE"
    build_cmd="$build_cmd --tag $full_image_name"
    
    # Add build arguments if provided
    if [ -n "$BUILD_ARGS" ]; then
        for arg in $BUILD_ARGS; do
            build_cmd="$build_cmd --build-arg $arg"
        done
    fi
    
    # Add push flag if enabled
    if [ "$PUSH" = "true" ]; then
        build_cmd="$build_cmd --push"
        print_status "Will push to registry after build"
    else
        build_cmd="$build_cmd --load"
        print_warning "Image will be built locally only (use PUSH=true to push to registry)"
    fi
    
    # Add context (current directory)
    build_cmd="$build_cmd ."
    
    print_status "Executing: $build_cmd"
    
    # Execute the build
    if eval $build_cmd; then
        print_success "Multi-architecture build completed successfully"
        
        # Show image information
        if [ "$PUSH" != "true" ]; then
            print_status "Image details:"
            docker images | grep "$IMAGE_NAME" | head -5
        fi
    else
        print_error "Build failed"
        exit 1
    fi
}

# Function to build specific targets
build_target() {
    local target=$1
    local full_image_name="${REGISTRY:+$REGISTRY/}$IMAGE_NAME:$TAG-$target"
    local platforms="linux/amd64,linux/arm64"
    
    print_status "Building target '$target' for multi-architecture: $full_image_name"
    
    local build_cmd="docker buildx build"
    build_cmd="$build_cmd --platform $platforms"
    build_cmd="$build_cmd --file $DOCKERFILE"
    build_cmd="$build_cmd --target $target"
    build_cmd="$build_cmd --tag $full_image_name"
    
    if [ "$PUSH" = "true" ]; then
        build_cmd="$build_cmd --push"
    else
        build_cmd="$build_cmd --load"
    fi
    
    build_cmd="$build_cmd ."
    
    if eval $build_cmd; then
        print_success "Target '$target' build completed successfully"
    else
        print_error "Target '$target' build failed"
        exit 1
    fi
}

# Function to test built images
test_image() {
    local full_image_name="${REGISTRY:+$REGISTRY/}$IMAGE_NAME:$TAG"
    
    if [ "$PUSH" = "true" ]; then
        print_warning "Cannot test pushed image locally"
        return 0
    fi
    
    print_status "Testing built image..."
    
    # Simple test to verify image can run
    if docker run --rm $full_image_name node --version > /dev/null 2>&1; then
        print_success "Image test passed"
    else
        print_warning "Image test failed or skipped"
    fi
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [OPTIONS] [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  build       Build multi-architecture image (default)"
    echo "  build-dev   Build development target"
    echo "  build-prod  Build production target"
    echo "  test        Test the built image"
    echo "  clean       Clean up builder and images"
    echo ""
    echo "Environment Variables:"
    echo "  REGISTRY    Docker registry (optional)"
    echo "  IMAGE_NAME  Image name (default: vibecode-webgui)"
    echo "  TAG         Image tag (default: latest)"
    echo "  DOCKERFILE  Dockerfile to use (default: Dockerfile.multiarch)"
    echo "  PUSH        Push to registry (default: false)"
    echo "  BUILD_ARGS  Additional build arguments"
    echo ""
    echo "Examples:"
    echo "  $0 build                                    # Build locally"
    echo "  PUSH=true $0 build                        # Build and push"
    echo "  REGISTRY=myregistry.com TAG=v1.0 $0 build # Custom registry and tag"
    echo "  $0 build-dev                              # Build development target"
}

# Function to clean up
cleanup() {
    print_status "Cleaning up builder and images..."
    
    # Remove builder if it exists
    if docker buildx inspect vibecode-multiarch-builder > /dev/null 2>&1; then
        docker buildx rm vibecode-multiarch-builder || true
    fi
    
    # Clean up build cache
    docker buildx prune -f || true
    
    print_success "Cleanup completed"
}

# Main script logic
main() {
    local command=${1:-build}
    
    case $command in
        "build")
            check_buildx
            setup_builder
            build_image
            test_image
            ;;
        "build-dev")
            check_buildx
            setup_builder
            build_target "development"
            ;;
        "build-prod")
            check_buildx
            setup_builder
            build_target "runtime"
            ;;
        "test")
            test_image
            ;;
        "clean")
            cleanup
            ;;
        "help"|"-h"|"--help")
            show_usage
            ;;
        *)
            print_error "Unknown command: $command"
            show_usage
            exit 1
            ;;
    esac
}

# Handle script interruption
trap cleanup EXIT

# Print banner
echo "=================================================="
echo "VibeCode WebGUI Multi-Architecture Build Script"
echo "=================================================="

# Check if running in correct directory
if [ ! -f "package.json" ]; then
    print_error "package.json not found. Please run this script from the project root."
    exit 1
fi

# Run main function
main "$@"