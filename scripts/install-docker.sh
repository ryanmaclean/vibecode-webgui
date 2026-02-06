#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

set -e


# Initialize log aggregation
init_log_aggregation

echo "=== Docker Installation Helper ==="
echo ""

# Check if Docker is already installed
if command -v docker &> /dev/null; then
    echo "Docker is already installed!"
    docker --version

    if docker info &> /dev/null; then
        echo "Docker daemon is running"
        exit 0
    else
        echo ""
        echo "Docker is installed but daemon is not running"
        echo "Please start Docker Desktop from /Applications/Docker.app"
        exit 1
    fi
fi

echo "Docker is not installed. Installation options:"
echo ""
echo "Option 1: Install via Homebrew (recommended for macOS)"
echo "  brew install --cask docker"
echo ""
echo "Option 2: Manual download"
echo "  Download from: https://www.docker.com/products/docker-desktop"
echo ""
echo "After installation:"
echo "  1. Launch Docker Desktop from Applications"
echo "  2. Wait for Docker to start (whale icon in menu bar)"
echo "  3. Run this script again to verify"
echo ""

read -p "Install Docker via Homebrew now? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if command -v brew &> /dev/null; then
        echo "Installing Docker Desktop via Homebrew..."
        brew install --cask docker

        echo ""
        echo "Docker Desktop installed!"
        echo ""
        echo "IMPORTANT: You must now:"
        echo "  1. Open Docker Desktop from /Applications/Docker.app"
        echo "  2. Accept the terms and conditions"
        echo "  3. Wait for Docker to start (whale icon in menu bar)"
        echo "  4. Then run: bash ~/vibecode-webgui/scripts/rebuild-postgresql-docker.sh"
    else
        echo "ERROR: Homebrew not found"
        echo "Install Homebrew first from: https://brew.sh"
        echo "Or download Docker Desktop manually"
    fi
else
    echo "Installation cancelled"
    echo "Install Docker manually from: https://www.docker.com/products/docker-desktop"
fi
