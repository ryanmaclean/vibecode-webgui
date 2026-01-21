#!/bin/bash

# Native Node.js Build Script
echo "🏗️  Building native Node.js..."

# Download Node.js source
NODE_VERSION="20.10.0"
wget "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}.tar.gz"
tar -xzf "node-v${NODE_VERSION}.tar.gz"
cd "node-v${NODE_VERSION}"

# Configure with optimizations
./configure \
    --enable-static \
    --enable-optimizations \
    --without-snapshot \
    --dest-cpu=arm64 \
    --dest-os=darwin \
    --prefix=/usr/local

# Build with maximum optimizations
make -j$(nproc) CFLAGS="-O3 -march=native" CXXFLAGS="-O3 -march=native"

# Install
sudo make install

echo "✅ Native Node.js build complete"
