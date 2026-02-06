#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

set -e


# Initialize log aggregation
init_log_aggregation

echo "=== PostgreSQL VM Docker Rebuild ==="
echo ""

# Check Docker is available
if ! command -v docker &> /dev/null; then
    echo "ERROR: Docker not installed"
    echo ""
    echo "Install Docker Desktop:"
    echo "1. Download from: https://www.docker.com/products/docker-desktop"
    echo "2. Or install via Homebrew: brew install --cask docker"
    echo "3. Launch Docker Desktop application"
    exit 1
fi

# Check Docker daemon is running
if ! docker info &> /dev/null; then
    echo "ERROR: Docker daemon not running"
    echo ""
    echo "Please start Docker Desktop application"
    echo "You can find it in /Applications/Docker.app"
    exit 1
fi

SOURCE_DIR="/tmp/postgresql-vm-fixed"
OUTPUT_DIR="$HOME/vibecode-webgui/azure"
SCRIPT_DIR="$HOME/vibecode-webgui/scripts"

# Verify source directory exists
if [ ! -d "$SOURCE_DIR" ]; then
    echo "ERROR: Source directory not found: $SOURCE_DIR"
    echo "Run Agent D2 first to prepare the initramfs"
    exit 1
fi

echo "Source: $SOURCE_DIR"
echo "Output: $OUTPUT_DIR"
echo ""

# Build Docker image
echo "Building Docker image..."
cd "$SCRIPT_DIR"
docker build -f Dockerfile.initramfs-builder -t initramfs-builder:latest .

echo ""
echo "Running initramfs build in Docker container..."
docker run --rm \
    -v "$SOURCE_DIR:/build/source:ro" \
    -v "$OUTPUT_DIR:/build/output" \
    initramfs-builder:latest

echo ""
echo "=== Build Complete ==="
echo "Output: $OUTPUT_DIR/postgresql-standalone-complete.cpio.gz"
ls -lh "$OUTPUT_DIR/postgresql-standalone-complete.cpio.gz"
