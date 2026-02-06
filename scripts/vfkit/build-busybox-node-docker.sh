#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

# Build BusyBox + Node.js + VSCode Server + Claude Code Docker image

# Initialize log aggregation
init_log_aggregation


set -e

echo "🚀 Building BusyBox + Node.js Docker Image"
echo "========================================="
echo ""

# Configuration
IMAGE_NAME="vibecode-busybox-node"
IMAGE_TAG="latest"
DOCKERFILE="scripts/vfkit/Dockerfile.busybox-node"

echo "📋 Configuration:"
echo "• Image: $IMAGE_NAME:$IMAGE_TAG"
echo "• Dockerfile: $DOCKERFILE"
echo "• Platform: linux/arm64"
echo ""

# Check if Dockerfile exists
if [ ! -f "$DOCKERFILE" ]; then
    echo "❌ Dockerfile not found: $DOCKERFILE"
    exit 1
fi

# Build the image
echo "🔨 Building Docker image..."
docker build \
    --platform linux/arm64 \
    --file "$DOCKERFILE" \
    --tag "$IMAGE_NAME:$IMAGE_TAG" \
    .

echo ""
echo "✅ Docker image built successfully!"
echo ""
echo "📊 Image Details:"
docker images "$IMAGE_NAME:$IMAGE_TAG" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"

echo ""
echo "🚀 To run the container:"
echo "docker run -d -p 8080:8080 --name vibecode-busybox $IMAGE_NAME:$IMAGE_TAG"
echo ""
echo "🌐 Access VSCode Server: http://localhost:8080"
echo "🤖 AI Tools available in container CLI"
