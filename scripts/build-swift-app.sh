#!/bin/bash
# MIT License - Build VibeCode Swift App

set -e

echo "🚀 Building VibeCode Native Swift App"
echo ""

cd /Users/ryan.maclean/vibecode-webgui/VibeCodeSwift

# Check Swift version
echo "📋 Checking Swift version..."
swift --version
echo ""

# Create Resources directory if needed
echo "📦 Setting up VM resources..."
mkdir -p Resources/vms

# Check if VM images exist
if [ ! -f "../dist/vm-images/vibecode-postgresql.img" ]; then
    echo "❌ VM images not found in dist/vm-images/"
    echo "Run: scripts/create_vm_disk_images.py first"
    exit 1
fi

# Symlink VM images (if not already present)
echo "🔗 Symlinking VM disk images..."
ln -sf ../../dist/vm-images/vibecode-postgresql.img Resources/vms/ 2>/dev/null || true
ln -sf ../../dist/vm-images/vibecode-postgresql-efi.nvram Resources/vms/ 2>/dev/null || true
ln -sf ../../dist/vm-images/vibecode-valkey.img Resources/vms/ 2>/dev/null || true
ln -sf ../../dist/vm-images/vibecode-valkey-efi.nvram Resources/vms/ 2>/dev/null || true
ln -sf ../../dist/vm-images/vibecode-nodejs.img Resources/vms/ 2>/dev/null || true
ln -sf ../../dist/vm-images/vibecode-nodejs-efi.nvram Resources/vms/ 2>/dev/null || true

echo "✅ VM resources linked"
ls -lh Resources/vms/ | head -10
echo ""

# Build
echo "🔨 Building Swift app..."
swift build -c release

echo ""
echo "✅ Build complete!"
echo ""

# Show binary
echo "📦 Binary location:"
ls -lh .build/release/VibeCode
echo ""

echo "🎯 To run:"
echo "  cd VibeCodeSwift"
echo "  swift run"
echo ""
echo "Or:"
echo "  .build/release/VibeCode"
echo ""

echo "🎉 Next: Code sign and create app bundle!"

