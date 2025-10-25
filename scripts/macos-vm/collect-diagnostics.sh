#!/bin/bash
# scripts/macos-vm/collect-diagnostics.sh
# Collect diagnostic information for troubleshooting

set -e

DIAG_DIR="/tmp/vibecode-vm-diagnostics-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$DIAG_DIR"

echo "🔍 Collecting diagnostics to $DIAG_DIR..."
echo ""

# System info
echo "📋 System information..."
sw_vers > "$DIAG_DIR/system-info.txt"
uname -a >> "$DIAG_DIR/system-info.txt"
sysctl -n machdep.cpu.brand_string >> "$DIAG_DIR/system-info.txt"
echo "   ✓ System info collected"

# VM files
echo "📁 VM file structure..."
ls -lR ~/.vibecode/vm > "$DIAG_DIR/vm-files.txt" 2>&1
echo "   ✓ File structure collected"

# Logs
echo "📝 VM logs..."
cp ~/.vibecode/vm/*.log "$DIAG_DIR/" 2>/dev/null || true
echo "   ✓ Logs collected"

# Process info
echo "🔄 Process information..."
ps aux | grep vibecode > "$DIAG_DIR/processes.txt"
echo "   ✓ Process info collected"

# Network
echo "🌐 Network status..."
lsof -i:8080 > "$DIAG_DIR/network.txt" 2>&1 || echo "No process on port 8080" > "$DIAG_DIR/network.txt"
echo "   ✓ Network status collected"

# Build info
echo "🔨 Build information..."
if [ -f "bin/vibecode-vm" ]; then
    file bin/vibecode-vm > "$DIAG_DIR/binary-info.txt"
    lipo -info bin/vibecode-vm >> "$DIAG_DIR/binary-info.txt" 2>&1 || true
else
    echo "Binary not found" > "$DIAG_DIR/binary-info.txt"
fi
echo "   ✓ Build info collected"

# Package info
echo "📦 Package configuration..."
if [ -f "macos-vm/Package.swift" ]; then
    cp macos-vm/Package.swift "$DIAG_DIR/"
else
    echo "Package.swift not found" > "$DIAG_DIR/package-info.txt"
fi
echo "   ✓ Package info collected"

# Benchmark results
echo "📊 Benchmark results..."
if [ -f "$HOME/.vibecode/vm/benchmark-results.json" ]; then
    cp "$HOME/.vibecode/vm/benchmark-results.json" "$DIAG_DIR/"
    echo "   ✓ Benchmark results collected"
else
    echo "   ⚠️  No benchmark results found"
fi

# Health check results
echo "🏥 Running health check..."
if [ -x "scripts/macos-vm/test-vm.sh" ]; then
    ./scripts/macos-vm/test-vm.sh > "$DIAG_DIR/health-check.txt" 2>&1 || true
    echo "   ✓ Health check completed"
else
    echo "   ⚠️  Health check script not found"
fi

# Create archive
echo ""
echo "📦 Creating archive..."
tar czf "$DIAG_DIR.tar.gz" -C /tmp "$(basename "$DIAG_DIR")" 2>/dev/null

if [ -f "$DIAG_DIR.tar.gz" ]; then
    echo "✅ Diagnostics collected successfully!"
    echo ""
    echo "📍 Archive location: $DIAG_DIR.tar.gz"
    echo "📏 Archive size: $(du -h "$DIAG_DIR.tar.gz" | awk '{print $1}')"
    echo ""
    echo "Please attach this file when reporting issues at:"
    echo "https://github.com/ryanmaclean/vibecode-webgui/issues"
else
    echo "❌ Failed to create archive"
    exit 1
fi
