#!/bin/bash
# scripts/macos-vm/compare-performance.sh
# Compare performance between Docker Desktop and VibeCode VM

set -e

echo "📊 Performance Comparison: Docker Desktop vs VibeCode VM"
echo "=========================================================="
echo ""

# Check if we're on macOS
if [[ "$(uname)" != "Darwin" ]]; then
    echo "❌ This script must be run on macOS"
    exit 1
fi

RESULTS_FILE="$HOME/.vibecode/vm/performance-comparison.json"
mkdir -p "$(dirname "$RESULTS_FILE")"

# Test Docker Desktop (if installed)
DOCKER_BOOT="N/A"
DOCKER_MEM="N/A"

if [ -d "/Applications/Docker.app" ]; then
    echo "Testing Docker Desktop..."
    echo "-------------------------"
    
    # Stop Docker if running
    osascript -e 'quit app "Docker"' 2>/dev/null || true
    sleep 5
    
    echo "Starting Docker Desktop..."
    DOCKER_START=$(date +%s.%N)
    open -a Docker
    
    # Wait for Docker to be ready (max 60 seconds)
    TIMEOUT=60
    ELAPSED=0
    while ! docker info &>/dev/null; do
        sleep 1
        ELAPSED=$((ELAPSED + 1))
        if [ $ELAPSED -ge $TIMEOUT ]; then
            echo "⚠️  Docker Desktop timed out after ${TIMEOUT}s"
            break
        fi
    done
    
    if docker info &>/dev/null; then
        DOCKER_END=$(date +%s.%N)
        DOCKER_BOOT=$(echo "$DOCKER_END - $DOCKER_START" | bc)
        echo "✓ Docker Desktop boot time: ${DOCKER_BOOT}s"
        
        # Measure memory
        sleep 5
        DOCKER_MEM=$(ps aux | grep -i docker | grep -v grep | awk '{sum+=$6} END {print sum/1024}')
        echo "✓ Docker Desktop memory: ${DOCKER_MEM} MB"
    fi
    
    # Stop Docker
    osascript -e 'quit app "Docker"' 2>/dev/null || true
    sleep 5
else
    echo "⚠️  Docker Desktop not installed, skipping"
fi

echo ""
echo "Testing VibeCode VM..."
echo "----------------------"

# Check if binary exists
if [ ! -f "bin/vibecode-vm" ]; then
    echo "❌ VibeCode VM binary not found"
    echo "   Run: ./scripts/macos-vm/build.sh"
    exit 1
fi

# Test VibeCode VM
VIBECODE_START=$(date +%s.%N)
./bin/vibecode-vm > /tmp/vm-perf.log 2>&1 &
VM_PID=$!

# Wait for ready message
TIMEOUT=30
ELAPSED=0
while ! grep -q "VM started successfully" /tmp/vm-perf.log 2>/dev/null; do
    sleep 0.1
    ELAPSED=$(echo "$ELAPSED + 0.1" | bc)
    if (( $(echo "$ELAPSED > $TIMEOUT" | bc -l) )); then
        echo "⚠️  VibeCode VM timed out after ${TIMEOUT}s"
        kill $VM_PID 2>/dev/null || true
        break
    fi
done

if grep -q "VM started successfully" /tmp/vm-perf.log; then
    VIBECODE_END=$(date +%s.%N)
    VIBECODE_BOOT=$(echo "$VIBECODE_END - $VIBECODE_START" | bc)
    echo "✓ VibeCode VM boot time: ${VIBECODE_BOOT}s"
    
    # Measure memory
    sleep 2
    VIBECODE_MEM=$(ps -o rss= -p $VM_PID 2>/dev/null | awk '{print $1/1024}')
    echo "✓ VibeCode VM memory: ${VIBECODE_MEM} MB"
    
    kill $VM_PID 2>/dev/null || true
    wait $VM_PID 2>/dev/null || true
else
    echo "❌ VibeCode VM failed to start"
    VIBECODE_BOOT="N/A"
    VIBECODE_MEM="N/A"
fi

rm -f /tmp/vm-perf.log

# Calculate improvements
echo ""
echo "=========================================================="
echo "📊 Results Summary"
echo "=========================================================="
echo ""

# Boot time comparison
if [ "$DOCKER_BOOT" != "N/A" ] && [ "$VIBECODE_BOOT" != "N/A" ]; then
    BOOT_IMPROVEMENT=$(echo "scale=1; $DOCKER_BOOT / $VIBECODE_BOOT" | bc)
    printf "Boot Time:\n"
    printf "  Docker Desktop: %.2fs\n" "$DOCKER_BOOT"
    printf "  VibeCode VM:    %.2fs\n" "$VIBECODE_BOOT"
    printf "  Improvement:    %.1fx faster ⚡\n" "$BOOT_IMPROVEMENT"
else
    echo "Boot Time: Comparison not available"
fi

echo ""

# Memory comparison
if [ "$DOCKER_MEM" != "N/A" ] && [ "$VIBECODE_MEM" != "N/A" ]; then
    MEM_SAVINGS=$(echo "$DOCKER_MEM - $VIBECODE_MEM" | bc)
    MEM_PERCENT=$(echo "scale=0; ($DOCKER_MEM - $VIBECODE_MEM) / $DOCKER_MEM * 100" | bc)
    printf "Memory Usage:\n"
    printf "  Docker Desktop: %.0f MB\n" "$DOCKER_MEM"
    printf "  VibeCode VM:    %.0f MB\n" "$VIBECODE_MEM"
    printf "  Savings:        %.0f MB (%.0f%%) 💾\n" "$MEM_SAVINGS" "$MEM_PERCENT"
else
    echo "Memory Usage: Comparison not available"
fi

echo ""

# Binary size
VIBECODE_SIZE=$(stat -f%z bin/vibecode-vm 2>/dev/null || echo "0")
VIBECODE_SIZE_KB=$((VIBECODE_SIZE / 1024))
DOCKER_SIZE_MB=500  # Approximate

printf "Binary Size:\n"
printf "  Docker Desktop: ~%d MB\n" "$DOCKER_SIZE_MB"
printf "  VibeCode VM:    %d KB\n" "$VIBECODE_SIZE_KB"
printf "  Ratio:          %dx smaller 📦\n" $((DOCKER_SIZE_MB * 1024 / VIBECODE_SIZE_KB))

echo ""

# Export JSON
cat > "$RESULTS_FILE" << EOF
{
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "platform": "$(uname -m)",
  "os_version": "$(sw_vers -productVersion)",
  "docker": {
    "boot_time_seconds": $([ "$DOCKER_BOOT" != "N/A" ] && echo "$DOCKER_BOOT" || echo "null"),
    "memory_mb": $([ "$DOCKER_MEM" != "N/A" ] && echo "$DOCKER_MEM" || echo "null"),
    "binary_size_mb": $DOCKER_SIZE_MB
  },
  "vibecode": {
    "boot_time_seconds": $([ "$VIBECODE_BOOT" != "N/A" ] && echo "$VIBECODE_BOOT" || echo "null"),
    "memory_mb": $([ "$VIBECODE_MEM" != "N/A" ] && echo "$VIBECODE_MEM" || echo "null"),
    "binary_size_kb": $VIBECODE_SIZE_KB
  }
}
EOF

echo "Results saved to: $RESULTS_FILE"
echo ""
echo "✅ Comparison complete!"
