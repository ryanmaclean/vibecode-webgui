#!/bin/bash
set -e

# Configuration
IMAGE_NAME="vibecode/code-server"
TAG="latest"
PLATFORM="linux/amd64,linux/arm64"

# Navigate to project root
cd "$(dirname "$0")/.."

echo "🚀 Building VibeCode custom code-server image..."

# Ensure Docker is running
if ! docker info > /dev/null 2>&1; then
  echo "❌ Docker is not running. Please start Docker and try again."
  exit 1
fi

# Build the image
if [ "$1" = "--push" ]; then
  echo "🔧 Building and pushing multi-architecture image..."
  docker buildx create --use --name=vibecode-builder
  docker buildx build --platform ${PLATFORM} \
    -t ${IMAGE_NAME}:${TAG} \
    -f docker/code-server/Dockerfile \
    --push \
    .
  docker buildx rm vibecode-builder
else
  echo "🔧 Building local image..."
  docker build \
    -t ${IMAGE_NAME}:${TAG} \
    -f docker/code-server/Dockerfile \
    .
  
  echo "\n✅ Build complete!"
  echo "To run the container locally:"
  echo "  docker run -p 8080:8080 -v $(pwd):/home/coder/workspace ${IMAGE_NAME}:${TAG}"
fi

echo "✨ Done!"
