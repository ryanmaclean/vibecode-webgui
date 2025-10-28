#!/bin/bash
set -e

# VibeCode Code-Server Multi-Architecture Build Script
# Builds code-server with custom VibeCode extensions for both ARM64 and AMD64

echo "🚀 Building VibeCode Code-Server Multi-Architecture Images"
echo "============================================================"

# Configuration
IMAGE_NAME="${IMAGE_NAME:-vibecode-codeserver}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
DOCKERFILE="docker/code-server/Dockerfile"
BUILDX_ARGS=${BUILDX_ARGS:-}

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}📋 Build Configuration:${NC}"
echo "  Image: ${IMAGE_NAME}:${IMAGE_TAG}"
echo "  Dockerfile: ${DOCKERFILE}"
echo ""

# Create or use existing buildx builder
echo -e "${BLUE}🔧 Setting up Docker Buildx...${NC}"
if ! docker buildx ls | grep -q vibecode-multiarch; then
    docker buildx create --name vibecode-multiarch --use
    echo -e "${GREEN}✓ Created new builder: vibecode-multiarch${NC}"
else
    docker buildx use vibecode-multiarch
    echo -e "${GREEN}✓ Using existing builder: vibecode-multiarch${NC}"
fi

# Bootstrap the builder
docker buildx inspect --bootstrap

echo ""
echo -e "${BLUE}🏗️  Building for multiple architectures...${NC}"
echo "  Platforms: linux/amd64, linux/arm64"
echo ""

# Option 1: Build and load locally (single platform at a time)
if [ "$1" == "local" ]; then
    echo -e "${YELLOW}Building ARM64 version...${NC}"
    docker buildx build $BUILDX_ARGS \
        --platform linux/arm64 \
        -f "${DOCKERFILE}" \
        -t "${IMAGE_NAME}:${IMAGE_TAG}-arm64" \
        --load \
        .
    
    echo -e "${GREEN}✓ ARM64 build complete${NC}"
    echo ""
    
    echo -e "${YELLOW}Building AMD64 version...${NC}"
    docker buildx build $BUILDX_ARGS \
        --platform linux/amd64 \
        -f "${DOCKERFILE}" \
        -t "${IMAGE_NAME}:${IMAGE_TAG}-amd64" \
        --load \
        .
    
    echo -e "${GREEN}✓ AMD64 build complete${NC}"
    echo ""
    
    echo -e "${GREEN}✅ Multi-architecture builds complete!${NC}"
    echo ""
    echo "Available images:"
    docker images | grep "${IMAGE_NAME}"
    
# Option 2: Build and push to registry (supports multi-platform manifest)
elif [ "$1" == "push" ]; then
    REGISTRY="${2:-docker.io}"
    FULL_IMAGE="${REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}"
    
    echo -e "${YELLOW}Building and pushing to ${FULL_IMAGE}...${NC}"
    docker buildx build $BUILDX_ARGS \
        --platform linux/amd64,linux/arm64 \
        -f "${DOCKERFILE}" \
        -t "${FULL_IMAGE}" \
        --push \
        .
    
    echo -e "${GREEN}✅ Multi-architecture image pushed to registry!${NC}"
    echo ""
    echo "To pull: docker pull ${FULL_IMAGE}"
    
# Option 3: Build to tarball (for offline distribution)
elif [ "$1" == "export" ]; then
    OUTPUT_DIR="${2:-./build-output}"
    mkdir -p "${OUTPUT_DIR}"
    
    echo -e "${YELLOW}Building and exporting to ${OUTPUT_DIR}...${NC}"
    
    docker buildx build $BUILDX_ARGS \
        --platform linux/arm64 \
        -f "${DOCKERFILE}" \
        -t "${IMAGE_NAME}:${IMAGE_TAG}-arm64" \
        --output type=docker,dest="${OUTPUT_DIR}/${IMAGE_NAME}-arm64.tar" \
        .

    docker buildx build $BUILDX_ARGS \
        --platform linux/amd64 \
        -f "${DOCKERFILE}" \
        -t "${IMAGE_NAME}:${IMAGE_TAG}-amd64" \
        --output type=docker,dest="${OUTPUT_DIR}/${IMAGE_NAME}-amd64.tar" \
        .
    
    echo -e "${GREEN}✅ Images exported to ${OUTPUT_DIR}/${NC}"
    echo ""
    echo "To load:"
    echo "  docker load < ${OUTPUT_DIR}/${IMAGE_NAME}-arm64.tar"
    echo "  docker load < ${OUTPUT_DIR}/${IMAGE_NAME}-amd64.tar"
    
else
    echo -e "${YELLOW}Usage:${NC}"
    echo "  $0 local              # Build both architectures locally"
    echo "  $0 push [registry]    # Build and push multi-arch manifest to registry"
    echo "  $0 export [dir]       # Export images to tarballs"
    echo ""
    echo -e "${YELLOW}Examples:${NC}"
    echo "  $0 local"
    echo "  $0 push docker.io/myuser"
    echo "  $0 export ./dist"
    exit 1
fi

echo ""
echo -e "${GREEN}🎉 Build complete!${NC}"
echo ""
echo -e "${BLUE}📝 Next steps:${NC}"
echo "  1. Test locally: docker run -p 8765:8765 ${IMAGE_NAME}:${IMAGE_TAG}-arm64"
echo "  2. Access at: http://localhost:8765"
echo "  3. Default auth: none (set PASSWORD env var for security)"
