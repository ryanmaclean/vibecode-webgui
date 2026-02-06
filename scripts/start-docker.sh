#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

# Docker Desktop Startup Helper

# Initialize log aggregation
init_log_aggregation

set -e

echo "🐳 Starting Docker Desktop"
echo "========================="

# Check if Docker is already running
if timeout 5s docker info > /dev/null 2>&1; then
    echo "✅ Docker is already running"
    docker --version
    exit 0
fi

echo "🚀 Starting Docker Desktop application..."

# Try to start Docker Desktop
if [ -f "/Applications/Docker.app/Contents/MacOS/Docker Desktop" ]; then
    echo "   Found Docker Desktop, launching..."
    open /Applications/Docker.app
elif [ -f "/usr/local/bin/docker" ]; then
    echo "   Docker CLI found, checking daemon..."
else
    echo "❌ Docker Desktop not found"
    echo "   Please install Docker Desktop: https://www.docker.com/products/docker-desktop/"
    exit 1
fi

# Wait for Docker to be ready
echo "⏳ Waiting for Docker daemon to start (timeout: 60s)..."
TIMEOUT=60
COUNTER=0

while [ $COUNTER -lt $TIMEOUT ]; do
    if timeout 5s docker info > /dev/null 2>&1; then
        echo "✅ Docker is ready!"
        echo "   Version: $(docker --version)"
        
        # Show basic Docker info
        echo ""
        echo "📊 Docker Status:"
        docker info --format "   Containers: {{.Containers}}"
        docker info --format "   Images: {{.Images}}"
        docker info --format "   Memory: {{.MemTotal | humanSize}}"
        
        exit 0
    fi
    
    echo "   Still waiting... ($((COUNTER + 5))s / ${TIMEOUT}s)"
    sleep 5
    COUNTER=$((COUNTER + 5))
done

echo "❌ Docker failed to start within ${TIMEOUT} seconds"
echo ""
echo "💡 Troubleshooting steps:"
echo "   1. Check Docker Desktop in system tray/menu bar"
echo "   2. Try restarting Docker Desktop manually"
echo "   3. Check system resources (Docker needs ~2GB RAM)"
echo "   4. Restart your computer if needed"
exit 1