#!/bin/bash
echo "========================================="
echo "  Timed Build - Both Applications"
echo "========================================="
echo ""
echo "Starting at: $(date +%H:%M:%S)"
echo ""

START=$(date +%s)

# Clean previous builds
rm -f BasicVibeCodeApp LiquidGlassVibeCodeApp

# Build executables
echo "Step 1: Compiling Swift source..."
./build-apps.sh

echo ""
echo "Step 2: Creating signed bundles..."
./bundle-apps.sh > /tmp/bundle-output.log 2>&1

END=$(date +%s)
ELAPSED=$((END - START))

echo ""
echo "========================================="
echo "  Build Complete"
echo "========================================="
echo ""
echo "Finished at: $(date +%H:%M:%S)"
echo "Total time:  ${ELAPSED} seconds"
echo ""
echo "Artifacts created:"
echo ""
ls -lh BasicVibeCodeApp LiquidGlassVibeCodeApp 2>/dev/null | awk '{printf "  Executable: %-30s %8s\n", $9, $5}'
echo ""
du -sh BasicVibeCode.app LiquidGlassVibeCode.app 2>/dev/null | awk '{printf "  Bundle:     %-30s %8s\n", $2, $1}'
echo ""
