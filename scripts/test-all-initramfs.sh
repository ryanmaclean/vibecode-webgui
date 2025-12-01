#!/bin/bash
# Test all initramfs files with the CLI tool
# Usage: bash scripts/test-all-initramfs.sh [timeout-seconds]

set -e

cd "$(dirname "$0")/.."

TIMEOUT=${1:-60}
SCRIPT="scripts/test-initramfs-cli.swift"

echo "=== Testing All Initramfs Files ==="
echo "Timeout: ${TIMEOUT}s"
echo ""

# Find all initramfs files
INITRAMFS_FILES=(
    "azure/valkey-standalone-complete.cpio.gz"
    "azure/postgresql-standalone-final.cpio.gz"
    "azure/unified-services-restored.cpio.gz"
    "azure/nodejs-complete.cpio.gz"
    "azure/valkey-standalone-v2.cpio.gz"
    "azure/postgresql-standalone-complete.cpio.gz"
    "azure/postgresql-standalone.cpio.gz"
)

# Results
PASSED=()
FAILED=()
SKIPPED=()

for initramfs in "${INITRAMFS_FILES[@]}"; do
    if [ ! -f "$initramfs" ]; then
        echo "⏭️  SKIP: $initramfs (not found)"
        SKIPPED+=("$initramfs")
        continue
    fi
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Testing: $initramfs"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    if swift "$SCRIPT" "$initramfs" "" "$TIMEOUT"; then
        echo "✅ PASSED: $initramfs"
        PASSED+=("$initramfs")
    else
        echo "❌ FAILED: $initramfs"
        FAILED+=("$initramfs")
    fi
    
    # Clean up any running VMs
    sleep 2
done

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Test Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ Passed: ${#PASSED[@]}"
for file in "${PASSED[@]}"; do
    echo "   - $file"
done

echo ""
echo "❌ Failed: ${#FAILED[@]}"
for file in "${FAILED[@]}"; do
    echo "   - $file"
done

echo ""
echo "⏭️  Skipped: ${#SKIPPED[@]}"
for file in "${SKIPPED[@]}"; do
    echo "   - $file"
done

echo ""
if [ ${#FAILED[@]} -eq 0 ] && [ ${#PASSED[@]} -gt 0 ]; then
    echo "🎉 All tests passed!"
    exit 0
else
    echo "⚠️  Some tests failed"
    exit 1
fi

