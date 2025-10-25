#!/bin/bash

# ARM64 Native Build Script
echo "🏗️  Building ARM64 native version..."

# Set ARM64 environment
export ARCH=arm64
export TARGET=arm64-apple-darwin

# Build with ARM64 optimizations
npm run build -- --target=arm64-apple-darwin

# Optimize Node.js for ARM64
if command -v node >/dev/null 2>&1; then
    echo "🔧 Optimizing Node.js for ARM64..."
    
    # Use native ARM64 Node.js
    arch -arm64 node --version
    
    # Set Node.js optimizations
    export NODE_OPTIONS="--max-old-space-size=4096 --optimize-for-size"
    export NODE_ENV="production"
    
    echo "✅ Node.js optimized for ARM64"
fi

echo "✅ ARM64 build complete"
