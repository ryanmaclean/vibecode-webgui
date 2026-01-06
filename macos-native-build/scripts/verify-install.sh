#!/bin/bash
set -e

# Verification script for vibe-build installation
# Agent 23 - Native macOS Build System

echo "🔍 Verifying vibe-build installation..."
echo ""

# Check Swift version
echo "1. Checking Swift version..."
if command -v swift &> /dev/null; then
    SWIFT_VERSION=$(swift --version | head -1)
    echo "   ✅ $SWIFT_VERSION"
else
    echo "   ❌ Swift not found. Install Xcode or Swift toolchain."
    exit 1
fi

# Check Apple Container runtime
echo "2. Checking Apple Container runtime..."
if command -v container &> /dev/null; then
    CONTAINER_VERSION=$(container version 2>/dev/null || echo "installed")
    echo "   ✅ Apple Container: $CONTAINER_VERSION"
else
    echo "   ⚠️  Apple Container not found. Install with:"
    echo "      brew install --cask container"
    echo "      container system start"
fi

# Check build system
echo "3. Checking vibe-build..."
if command -v vibe-build &> /dev/null; then
    echo "   ✅ vibe-build installed"
    vibe-build info | head -5
else
    echo "   ❌ vibe-build not found. Run: make install"
    exit 1
fi

# Check launchd service
echo "4. Checking launchd service..."
if launchctl list | grep -q com.vibecode.builder; then
    echo "   ✅ Build daemon running"
else
    echo "   ⚠️  Build daemon not running"
    echo "      Start with: sudo launchctl load /Library/LaunchDaemons/com.vibecode.builder.plist"
fi

# Check cache directory
echo "5. Checking cache directories..."
CACHE_DIR="$HOME/Library/Caches/vibecode-build"
WORK_DIR="$HOME/Library/Application Support/vibecode-build"

if [ -d "$CACHE_DIR" ]; then
    CACHE_SIZE=$(du -sh "$CACHE_DIR" 2>/dev/null | cut -f1)
    echo "   ✅ Cache directory: $CACHE_SIZE"
else
    echo "   ℹ️  Cache directory will be created on first build"
fi

if [ -d "$WORK_DIR" ]; then
    WORK_SIZE=$(du -sh "$WORK_DIR" 2>/dev/null | cut -f1)
    echo "   ✅ Work directory: $WORK_SIZE"
else
    echo "   ℹ️  Work directory will be created on first build"
fi

# Check system resources
echo "6. Checking system resources..."
CORES=$(sysctl -n hw.ncpu)
MEMORY_GB=$(sysctl -n hw.memsize | awk '{print int($1/1024/1024/1024)}')
ARCH=$(uname -m)

echo "   ✅ CPU cores: $CORES"
echo "   ✅ Memory: ${MEMORY_GB}GB"
echo "   ✅ Architecture: $ARCH"

if [ "$MEMORY_GB" -lt 8 ]; then
    echo "   ⚠️  Warning: 8GB+ RAM recommended for optimal performance"
fi

echo ""
echo "==================================="
echo "✅ Installation verification complete!"
echo "==================================="
echo ""
echo "Next steps:"
echo "  1. Build your first image:"
echo "     vibe-build build -f Dockerfile -c . -t myapp:latest"
echo ""
echo "  2. Check cache statistics:"
echo "     vibe-build cache --operation list"
echo ""
echo "  3. View system info:"
echo "     vibe-build info"
echo ""
