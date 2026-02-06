#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

set -e


# Initialize log aggregation
init_log_aggregation

echo "🔨 Building VibeCode VM for macOS..."

cd "$(dirname "$0")/../.."

# Build the Swift package
swift build --package-path macos-vm -c release

# Copy binary to convenient location
mkdir -p bin
cp macos-vm/.build/release/vibecode-vm bin/

echo "✅ Build complete!"
echo "📦 Binary: bin/vibecode-vm"
echo ""
echo "🚀 Quick start:"
echo "   1. ./scripts/macos-vm/download-kernel.sh"
echo "   2. ./bin/vibecode-vm"
