#!/bin/bash
# Push multi-architecture code-server image to registry
set -e

# Configuration
REGISTRY="${REGISTRY:-ghcr.io/ryanmaclean}"
IMAGE_NAME="${IMAGE_NAME:-vibecode-codeserver}"
VERSION="${VERSION:-latest}"
DATE_TAG="$(date +%Y%m%d)"
GIT_SHA="$(git rev-parse --short HEAD 2>/dev/null || echo 'local')"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}🚀 Pushing multi-arch image to ${REGISTRY}/${IMAGE_NAME}${NC}"
echo ""
echo -e "${BLUE}Configuration:${NC}"
echo "  Registry: ${REGISTRY}"
echo "  Image: ${IMAGE_NAME}"
echo "  Version: ${VERSION}"
echo "  Date Tag: ${DATE_TAG}"
echo "  Git SHA: ${GIT_SHA}"
echo ""

# Check if logged in
if ! docker info > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Docker daemon not running${NC}"
    exit 1
fi

# Create and use buildx builder
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
echo -e "${BLUE}🏗️  Building and pushing multi-arch image...${NC}"
echo "  Platforms: linux/amd64, linux/arm64"
echo ""

# Build and push multi-arch image
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -f docker/code-server/Dockerfile \
  -t "${REGISTRY}/${IMAGE_NAME}:${VERSION}" \
  -t "${REGISTRY}/${IMAGE_NAME}:${DATE_TAG}" \
  -t "${REGISTRY}/${IMAGE_NAME}:${GIT_SHA}" \
  --push \
  .

echo ""
echo -e "${GREEN}✅ Multi-arch image pushed successfully!${NC}"
echo ""
echo -e "${BLUE}📋 Available tags:${NC}"
echo "  ${REGISTRY}/${IMAGE_NAME}:${VERSION}"
echo "  ${REGISTRY}/${IMAGE_NAME}:${DATE_TAG}"
echo "  ${REGISTRY}/${IMAGE_NAME}:${GIT_SHA}"
echo ""
echo -e "${BLUE}📥 To pull:${NC}"
echo "  docker pull ${REGISTRY}/${IMAGE_NAME}:${VERSION}"
echo "  (Platform will be auto-detected)"
echo ""
echo -e "${BLUE}🚀 To deploy:${NC}"
echo "  docker run -d -p 8765:8765 ${REGISTRY}/${IMAGE_NAME}:${VERSION}"
echo ""
