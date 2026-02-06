#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

# MIT License - Build and sign VibeCode application

# Initialize log aggregation
init_log_aggregation


set -e

cd "$(dirname "$0")/.."

echo "🔨 Building VibeCode..."
cd VibeCodeSwift
swift build -c release

echo ""
echo "🔐 Code signing with entitlements..."
codesign --force --sign - --entitlements VibeCode.entitlements .build/release/VibeCode

echo ""
echo "✅ Build complete!"
echo ""
echo "Run with: open VibeCodeSwift/.build/release/VibeCode.app"


