#!/bin/bash
set -e

# Configuration
IMAGE_NAME="vibecode/code-server"
TAG="latest"
PLATFORM="linux/amd64,linux/arm64"

# Navigate to project root
cd "$(dirname "$0")/.."

echo "🚀 Building VibeCode custom code-server image..."

# Verify extension licenses before building
echo "🔍 Verifying extension licenses..."
if ./scripts/verify-extension-licenses.sh; then
  echo "✅ License verification passed!"
else
  echo "❌ License verification failed. Aborting build."
  exit 1
fi

echo ""

# Ensure Docker is running
if ! docker info > /dev/null 2>&1; then
  echo "❌ Docker is not running. Please start Docker and try again."
  exit 1
fi

# Build the image
if [ "$1" = "--push" ]; then
  echo "🔧 Building and pushing multi-architecture image..."
  docker buildx create --use --name=vibecode-builder 2>/dev/null || true
  docker buildx build --platform ${PLATFORM} \
    -t ${IMAGE_NAME}:${TAG} \
    -f docker/code-server/Dockerfile \
    --push \
    .
  docker buildx rm vibecode-builder 2>/dev/null || true
else
  echo "🔧 Building local image..."
  docker build \
    -t ${IMAGE_NAME}:${TAG} \
    -f docker/code-server/Dockerfile \
    .
  
  echo ""
  echo "✅ Build complete!"
  echo ""
  echo "🎯 Installed Extensions Summary:"
  echo "Official Microsoft Extensions (5 extensions)"
  echo "- TypeScript/JavaScript Language Features"
  echo "- JSON Language Features"
  echo "- ESLint Integration"
  echo "- CSS Language Features"
  echo "- HTML Language Features"
  echo "Total: 5 MIT licensed Microsoft extensions + VibeCode AI Assistant"
  echo ""
  echo "To run the container locally:"
  echo "  docker run -p 8080:8080 -v \$(pwd):/home/coder/workspace ${IMAGE_NAME}:${TAG}"
fi

echo "✨ Done!"
