#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

# Build and test code-server image

# Initialize log aggregation
init_log_aggregation


set -e

echo "🏗️  Building Code-Server Image"
echo "=============================="

# Build the image
echo "Building docker image..."
docker build -t vibecode/code-server:latest -f docker/code-server/Dockerfile .

echo ""
echo "✅ Build complete!"
echo ""
echo "🧪 Running extension tests..."
echo ""

# Run the tests
./tests/docker/code-server-extensions.test.sh

echo ""
echo "🎉 All done! Image built and tested successfully."
