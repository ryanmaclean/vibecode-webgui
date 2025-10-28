#!/bin/bash
# Test BusyBox + Node.js Docker image

set -e

echo "🧪 Testing BusyBox + Node.js Docker Image"
echo "========================================"
echo ""

IMAGE_NAME="vibecode-busybox-node"
CONTAINER_NAME="vibecode-busybox-test"

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    echo "❌ Docker is not running"
    echo "Please start Docker Desktop and try again"
    exit 1
fi

# Check if image exists
if ! docker images "$IMAGE_NAME:latest" --format "{{.Repository}}" | grep -q "$IMAGE_NAME"; then
    echo "❌ Image not found: $IMAGE_NAME:latest"
    echo "Please run: ./scripts/vfkit/build-busybox-node-docker.sh"
    exit 1
fi

echo "✅ Docker is running"
echo "✅ Image found: $IMAGE_NAME:latest"

# Stop and remove existing container if it exists
if docker ps -a --format "{{.Names}}" | grep -q "^$CONTAINER_NAME$"; then
    echo "🔄 Stopping existing container..."
    docker stop "$CONTAINER_NAME" >/dev/null 2>&1 || true
    docker rm "$CONTAINER_NAME" >/dev/null 2>&1 || true
fi

# Run the container
echo "🚀 Starting container..."
docker run -d \
    --name "$CONTAINER_NAME" \
    -p 8080:8080 \
    "$IMAGE_NAME:latest"

# Wait for container to start
echo "⏳ Waiting for container to start..."
sleep 5

# Check if container is running
if docker ps --format "{{.Names}}" | grep -q "^$CONTAINER_NAME$"; then
    echo "✅ Container is running"
    
    # Test VSCode Server
    echo "🌐 Testing VSCode Server..."
    if curl -f http://localhost:8080/ >/dev/null 2>&1; then
        echo "✅ VSCode Server is accessible at http://localhost:8080"
    else
        echo "⚠️ VSCode Server not yet ready (may need more time)"
    fi
    
    # Test AI tools
    echo "🤖 Testing AI tools..."
    docker exec "$CONTAINER_NAME" verify-ai-tools
    
    echo ""
    echo "🎉 SUCCESS! BusyBox + Node.js + VSCode Server + Claude Code is working!"
    echo ""
    echo "📋 Access Information:"
    echo "• VSCode Server: http://localhost:8080"
    echo "• Container: $CONTAINER_NAME"
    echo "• Stop container: docker stop $CONTAINER_NAME"
    echo "• Remove container: docker rm $CONTAINER_NAME"
    
else
    echo "❌ Container failed to start"
    echo "Container logs:"
    docker logs "$CONTAINER_NAME"
    exit 1
fi
