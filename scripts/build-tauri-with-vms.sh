#!/bin/bash
# MIT License - Build Tauri app with VM resources

set -e

echo "🚀 Building VibeCode.app with Native VM Support"
echo ""

# Check prerequisites
echo "📋 Checking prerequisites..."

if [ ! -f "dist/vibecode-vm" ]; then
    echo "❌ VM manager binary not found: dist/vibecode-vm"
    echo "Run: scripts/build-vm-manager.sh"
    exit 1
fi

if [ ! -d "src-tauri/binaries" ]; then
    echo "❌ Tauri binaries directory not found"
    exit 1
fi

if [ ! -d "src-tauri/vm-images" ]; then
    echo "❌ Tauri vm-images directory not found"
    exit 1
fi

echo "✅ Prerequisites OK"
echo ""

# Show what will be bundled
echo "📦 Bundling resources:"
echo ""
echo "Binaries:"
ls -lh src-tauri/binaries/
echo ""
echo "VM Images:"
ls -lh src-tauri/vm-images/ | head -5
echo ""

# Build Tauri app
echo "🔨 Building Tauri application..."
echo ""

cd src-tauri

# Use cargo tauri build for production
cargo tauri build --verbose

echo ""
echo "✅ Build complete!"
echo ""

# Show output
echo "📦 Output location:"
echo ""
ls -lh target/release/bundle/macos/*.dmg 2>/dev/null || echo "  DMG: target/release/bundle/macos/"
echo ""
ls -d target/release/bundle/macos/*.app 2>/dev/null || echo "  App: target/release/bundle/macos/VibeCode.app"
echo ""

echo "🎯 Next steps:"
echo "  1. Test: open target/release/bundle/macos/VibeCode.app"
echo "  2. Check VM manager is bundled in app"
echo "  3. Test VM start/stop functionality"
echo "  4. Verify PostgreSQL connectivity"
echo ""
echo "🎉 Done!"

