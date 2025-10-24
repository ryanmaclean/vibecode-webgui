#!/usr/bin/env bash
# Automated boot time comparison between vfkit Alpine and Lima vibecode-minimal

set -euo pipefail

echo "╔════════════════════════════════════════════════════════╗"
echo "║   Boot Time Comparison: vfkit vs Lima                 ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

# Check dependencies
if ! command -v bc &> /dev/null; then
    echo "❌ bc not found. Install: brew install bc"
    exit 1
fi

if ! command -v limactl &> /dev/null; then
    echo "❌ limactl not found. Install: brew install lima"
    exit 1
fi

if ! command -v vfkit &> /dev/null; then
    echo "❌ vfkit not found. Install: brew install vfkit"
    exit 1
fi

# Test 1: Lima vibecode-minimal
echo "═══════════════════════════════════════════════════════"
echo "Test 1: Lima vibecode-minimal"
echo "═══════════════════════════════════════════════════════"
echo "Configuration: Full Debian/Ubuntu with AI tools"
echo "  - 4 CPUs, 4GB RAM, 100GB disk"
echo "  - Includes: Claude, Codex, Gemini, Aider"
echo "  - Full systemd init system"
echo ""

# Stop if running
if limactl list 2>/dev/null | grep vibecode-minimal | grep -q Running; then
    echo "⏸️  Stopping vibecode-minimal..."
    limactl stop vibecode-minimal > /dev/null 2>&1
    sleep 3
    echo "✅ Stopped"
    echo ""
fi

echo "🚀 Starting vibecode-minimal..."
START_MINIMAL=$(date +%s.%N)
limactl start vibecode-minimal > /tmp/minimal-boot.log 2>&1
END_MINIMAL=$(date +%s.%N)
BOOT_TIME_MINIMAL=$(echo "$END_MINIMAL - $START_MINIMAL" | bc)

echo "✅ Boot completed!"
echo "⏱️  Time: ${BOOT_TIME_MINIMAL} seconds"
echo ""

# Test 2: vfkit Alpine
echo "═══════════════════════════════════════════════════════"
echo "Test 2: vfkit Alpine"
echo "═══════════════════════════════════════════════════════"
echo "Configuration: Minimal Alpine Linux"
echo "  - 4 CPUs, 4GB RAM, 20GB disk"
echo "  - Includes: Node.js 20.11.1, npm"
echo "  - Single /init script (no systemd)"
echo ""

# Clear console log
CONSOLE_LOG="/Users/studio/.vfkit/vms/vibecode-alpine/logs/console.log"
: > "$CONSOLE_LOG"

echo "🚀 Starting vfkit Alpine..."

# Start vfkit in background
START_VFKIT=$(date +%s.%N)

timeout 30s /Users/studio/Documents/vibecode-webgui/scripts/vfkit/04-launch-alpine-vm.sh > /tmp/vfkit-boot.log 2>&1 &
VFKIT_PID=$!

# Wait for shell prompt in console log
BOOT_DETECTED=false
for i in {1..100}; do
    if [[ -f "$CONSOLE_LOG" ]] && tail -10 "$CONSOLE_LOG" 2>/dev/null | grep -q "can't access tty\|/bin/sh"; then
        END_VFKIT=$(date +%s.%N)
        BOOT_DETECTED=true
        break
    fi
    sleep 0.1
done

# Kill vfkit
kill $VFKIT_PID 2>/dev/null || true
wait $VFKIT_PID 2>/dev/null || true

if [[ "$BOOT_DETECTED" == "false" ]]; then
    echo "❌ Boot detection failed"
    echo "Check console log: tail -f $CONSOLE_LOG"
    exit 1
fi

BOOT_TIME_VFKIT=$(echo "$END_VFKIT - $START_VFKIT" | bc)

echo "✅ Boot completed!"
echo "⏱️  Time: ${BOOT_TIME_VFKIT} seconds"
echo ""

# Summary
echo "╔════════════════════════════════════════════════════════╗"
echo "║                     RESULTS                            ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

printf "%-25s %10.2f seconds\n" "Lima vibecode-minimal:" "$BOOT_TIME_MINIMAL"
printf "%-25s %10.2f seconds\n" "vfkit Alpine:" "$BOOT_TIME_VFKIT"
echo ""

# Calculate difference
if (( $(echo "$BOOT_TIME_VFKIT < $BOOT_TIME_MINIMAL" | bc -l) )); then
    DIFF=$(echo "$BOOT_TIME_MINIMAL - $BOOT_TIME_VFKIT" | bc)
    PERCENT=$(echo "scale=1; ($DIFF / $BOOT_TIME_MINIMAL) * 100" | bc)
    echo "🏆 Winner: vfkit Alpine"
    echo "   Faster by: ${DIFF} seconds (${PERCENT}% improvement)"
else
    DIFF=$(echo "$BOOT_TIME_VFKIT - $BOOT_TIME_MINIMAL" | bc)
    PERCENT=$(echo "scale=1; ($DIFF / $BOOT_TIME_VFKIT) * 100" | bc)
    echo "🏆 Winner: Lima vibecode-minimal"
    echo "   Faster by: ${DIFF} seconds (${PERCENT}% improvement)"
fi

echo ""

# Feature comparison
echo "╔════════════════════════════════════════════════════════╗"
echo "║              FEATURE COMPARISON                        ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

printf "%-25s %-15s %-15s\n" "Feature" "vfkit Alpine" "Lima minimal"
echo "───────────────────────────────────────────────────────"
printf "%-25s %-15s %-15s\n" "Boot Speed" "✅ Fast" "⚠️  Slower"
printf "%-25s %-15s %-15s\n" "File Sharing" "❌ No" "✅ Yes"
printf "%-25s %-15s %-15s\n" "SSH Access" "❌ No" "✅ Yes"
printf "%-25s %-15s %-15s\n" "AI Tools" "❌ No" "✅ Yes"
printf "%-25s %-15s %-15s\n" "Disk Usage" "✅ ~500MB" "⚠️  ~5GB"
printf "%-25s %-15s %-15s\n" "Memory Usage" "✅ ~700MB" "⚠️  ~1.4GB"

echo ""
echo "═══════════════════════════════════════════════════════"
echo "Full comparison: scripts/vfkit/BOOT_TIME_COMPARISON.md"
echo "═══════════════════════════════════════════════════════"
echo ""
