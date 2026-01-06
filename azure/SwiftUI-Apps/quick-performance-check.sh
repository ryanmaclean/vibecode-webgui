#!/bin/bash
# Quick Performance Check - Automated Metrics Collection
# Run this to get immediate baseline measurements

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo "=== VibeCode Quick Performance Check ==="
echo "Date: $(date)"
echo ""

# Check if apps exist
if [ ! -d "BasicVibeCode.app" ]; then
    echo "ERROR: BasicVibeCode.app not found. Run ./bundle-apps.sh first."
    exit 1
fi

echo "=== 1. Bundle Size Analysis ==="
echo ""
echo "BasicVibeCode.app:"
du -sh BasicVibeCode.app
echo ""
echo "LiquidGlassVibeCode.app:"
du -sh LiquidGlassVibeCode.app
echo ""

echo "=== 2. Executable Sizes ==="
echo ""
ls -lh BasicVibeCode.app/Contents/MacOS/* LiquidGlassVibeCode.app/Contents/MacOS/* | awk '{print $5, $9}'
echo ""

echo "=== 3. VM Resource Sizes ==="
echo ""
echo "BasicVibeCode.app resources:"
ls -lh BasicVibeCode.app/Contents/Resources/* | awk '{print $5, $9}'
echo ""
echo "LiquidGlassVibeCode.app resources:"
ls -lh LiquidGlassVibeCode.app/Contents/Resources/* | awk '{print $5, $9}'
echo ""

echo "=== 4. Code Signature Verification ==="
echo ""
echo "BasicVibeCode.app:"
codesign -dv BasicVibeCode.app 2>&1 | grep -E "(Authority|Identifier|Sealed)"
echo ""
echo "LiquidGlassVibeCode.app:"
codesign -dv LiquidGlassVibeCode.app 2>&1 | grep -E "(Authority|Identifier|Sealed)"
echo ""

echo "=== 5. Entitlements Check ==="
echo ""
echo "BasicVibeCode.app entitlements:"
codesign -d --entitlements - BasicVibeCode.app 2>/dev/null | grep -A 1 "com.apple.security" || echo "  Standard entitlements"
echo ""

echo "=== 6. Comparison with Archived Builds ==="
echo ""
if [ -f "BasicVibeCode.zip" ]; then
    echo "Archived BasicVibeCode.zip:"
    ls -lh BasicVibeCode.zip | awk '{print "Size:", $5, "Date:", $6, $7, $8}'
    echo ""
fi
if [ -f "LiquidGlassVibeCode.zip" ]; then
    echo "Archived LiquidGlassVibeCode.zip:"
    ls -lh LiquidGlassVibeCode.zip | awk '{print "Size:", $5, "Date:", $6, $7, $8}'
    echo ""
fi

echo "=== 7. File Count Analysis ==="
echo ""
echo "BasicVibeCode.app total files:"
find BasicVibeCode.app -type f | wc -l
echo ""
echo "LiquidGlassVibeCode.app total files:"
find LiquidGlassVibeCode.app -type f | wc -l
echo ""

echo "=== 8. Shared/ Infrastructure Check ==="
echo ""
if [ -d "Shared" ]; then
    echo "Shared/ directory contents:"
    ls -lh Shared/*.swift 2>/dev/null | awk '{print $5, $9}' || echo "  No Swift files found"
    echo ""
    echo "Shared infrastructure size:"
    du -sh Shared
    echo ""
else
    echo "  No Shared/ directory found"
    echo ""
fi

echo "=== 9. Build Timestamps ==="
echo ""
echo "BasicVibeCode.app last modified:"
stat -f "%Sm" -t "%Y-%m-%d %H:%M:%S" BasicVibeCode.app
echo ""
echo "LiquidGlassVibeCode.app last modified:"
stat -f "%Sm" -t "%Y-%m-%d %H:%M:%S" LiquidGlassVibeCode.app
echo ""

echo "=== 10. Memory Baseline (System) ==="
echo ""
echo "Available memory:"
vm_stat | grep "Pages free" | awk '{print "Free: " $3 * 4096 / 1024 / 1024 " MB"}'
vm_stat | grep "Pages active" | awk '{print "Active: " $3 * 4096 / 1024 / 1024 " MB"}'
echo ""

echo "=== Quick Performance Check Complete ==="
echo ""
echo "Next steps:"
echo "  1. Review PERFORMANCE-BENCHMARK-REPORT.md for full analysis"
echo "  2. Run manual VM startup tests (see report Section 2)"
echo "  3. Measure memory usage with Activity Monitor (see report Section 3)"
echo "  4. Test for memory leaks with 'leaks' command (see report Section 4)"
echo ""
