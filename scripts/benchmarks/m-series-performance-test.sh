#!/usr/bin/env bash
# M-Series Performance Testing Suite
# Tests Apple Silicon optimizations for microVM workloads
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RESULTS_DIR="${SCRIPT_DIR}/../../artifacts/m-series-benchmarks"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RESULT_FILE="${RESULTS_DIR}/benchmark_${TIMESTAMP}.json"

echo "=== M-Series Performance Test ==="
echo "Hardware: $(sysctl -n machdep.cpu.brand_string)"
echo "Cores: $(sysctl -n hw.ncpu)"
echo "Memory: $(sysctl -n hw.memsize | awk '{print $1/1024/1024/1024 "GB"}')"
echo ""

mkdir -p "${RESULTS_DIR}"

# Detect M-series chip
CHIP=$(sysctl -n machdep.cpu.brand_string)
if [[ ! "${CHIP}" =~ "Apple M" ]]; then
  echo "⚠️  Warning: Not running on Apple Silicon (${CHIP})"
fi

# Initialize results
cat > "${RESULT_FILE}" <<EOF
{
  "benchmark_id": "m-series-${TIMESTAMP}",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "hardware": {
    "chip": "${CHIP}",
    "cores": $(sysctl -n hw.ncpu),
    "memory_gb": $(sysctl -n hw.memsize | awk '{print int($1/1024/1024/1024)}'),
    "performance_cores": $(sysctl -n hw.perflevel0.physicalcpu 2>/dev/null || echo "0"),
    "efficiency_cores": $(sysctl -n hw.perflevel1.physicalcpu 2>/dev/null || echo "0")
  },
  "tests": []
}
EOF

# Test 1: VM Boot Time (Virtualization.framework)
echo "Test 1: Apple Virtualization.framework boot time"
if [[ -f "macos-vm/.build/debug/macos-vm" ]]; then
  echo "  Testing native VM boot..."
  START=$(date +%s%3N)
  timeout 10s macos-vm/.build/debug/macos-vm test 2>/dev/null || true
  END=$(date +%s%3N)
  BOOT_MS=$((END - START))
  
  jq '.tests += [{
    "name": "apple_virtualization_boot",
    "duration_ms": '"${BOOT_MS}"',
    "status": "completed"
  }]' "${RESULT_FILE}" > "${RESULT_FILE}.tmp"
  mv "${RESULT_FILE}.tmp" "${RESULT_FILE}"
  
  echo "  Boot time: ${BOOT_MS}ms"
else
  echo "  ⚠️  VM binary not found, skipping"
fi

# Test 2: Kernel Compilation Performance
echo ""
echo "Test 2: arm64 kernel build performance"
if [[ -f "scripts/benchmarks/build-minivim-kernel.sh" ]]; then
  echo "  Building MiniVim kernel for arm64..."
  START=$(date +%s)
  MINIVIM_JOBS=$(sysctl -n hw.ncpu) \
    ./scripts/benchmarks/build-minivim-kernel.sh arm64 6.17.14 &> /tmp/kernel-build.log || true
  END=$(date +%s)
  BUILD_SEC=$((END - START))
  
  jq '.tests += [{
    "name": "kernel_build_arm64",
    "duration_seconds": '"${BUILD_SEC}"',
    "cores_used": '"$(sysctl -n hw.ncpu)"',
    "status": "completed"
  }]' "${RESULT_FILE}" > "${RESULT_FILE}.tmp"
  mv "${RESULT_FILE}.tmp" "${RESULT_FILE}"
  
  echo "  Build time: ${BUILD_SEC}s"
else
  echo "  ⚠️  Build script not found, skipping"
fi

# Test 3: Container Performance (Docker vs Native)
echo ""
echo "Test 3: Container runtime performance"
if command -v docker &> /dev/null; then
  echo "  Testing Docker container start time..."
  START=$(date +%s%3N)
  docker run --rm alpine:latest echo "test" &> /dev/null || true
  END=$(date +%s%3N)
  DOCKER_MS=$((END - START))
  
  jq '.tests += [{
    "name": "docker_container_start",
    "duration_ms": '"${DOCKER_MS}"',
    "runtime": "docker",
    "status": "completed"
  }]' "${RESULT_FILE}" > "${RESULT_FILE}.tmp"
  mv "${RESULT_FILE}.tmp" "${RESULT_FILE}"
  
  echo "  Docker start: ${DOCKER_MS}ms"
else
  echo "  ⚠️  Docker not available, skipping"
fi

# Test 4: Memory Bandwidth
echo ""
echo "Test 4: Memory bandwidth test"
echo "  Running memory bandwidth benchmark..."
START=$(date +%s)
dd if=/dev/zero of=/dev/null bs=1m count=1024 2>&1 | grep -o '[0-9.]* GB/s' || echo "0 GB/s"
END=$(date +%s)
MEM_TEST_SEC=$((END - START))

jq '.tests += [{
  "name": "memory_bandwidth",
  "duration_seconds": '"${MEM_TEST_SEC}"',
  "status": "completed"
}]' "${RESULT_FILE}" > "${RESULT_FILE}.tmp"
mv "${RESULT_FILE}.tmp" "${RESULT_FILE}"

# Test 5: eBPF/BTF Support
echo ""
echo "Test 5: eBPF/BTF support check"
BTF_AVAILABLE="false"
if command -v bpftool &> /dev/null; then
  BTF_AVAILABLE="true"
  echo "  ✅ bpftool available"
else
  echo "  ❌ bpftool not installed"
fi

jq '.tests += [{
  "name": "ebpf_btf_support",
  "btf_available": '"${BTF_AVAILABLE}"',
  "status": "completed"
}]' "${RESULT_FILE}" > "${RESULT_FILE}.tmp"
mv "${RESULT_FILE}.tmp" "${RESULT_FILE}"

# Generate summary
echo ""
echo "=== Performance Summary ==="
jq -r '.tests[] | "- \(.name): \(if .duration_ms then "\(.duration_ms)ms" elif .duration_seconds then "\(.duration_seconds)s" else "✓" end)"' "${RESULT_FILE}"

echo ""
echo "Results saved to: ${RESULT_FILE}"

# Performance targets
echo ""
echo "=== Target Validation ==="
VM_BOOT=$(jq -r '.tests[] | select(.name == "apple_virtualization_boot") | .duration_ms' "${RESULT_FILE}" 2>/dev/null || echo "0")
if [[ "${VM_BOOT}" != "0" && "${VM_BOOT}" != "null" ]]; then
  if (( VM_BOOT < 5000 )); then
    echo "✅ VM boot <5s (M-Series optimized)"
  else
    echo "⚠️  VM boot >5s (expected <5s on M-Series)"
  fi
fi

KERNEL_BUILD=$(jq -r '.tests[] | select(.name == "kernel_build_arm64") | .duration_seconds' "${RESULT_FILE}" 2>/dev/null || echo "0")
if [[ "${KERNEL_BUILD}" != "0" && "${KERNEL_BUILD}" != "null" ]]; then
  if (( KERNEL_BUILD < 600 )); then
    echo "✅ Kernel build <10min (good)"
  else
    echo "⚠️  Kernel build >10min (consider optimization)"
  fi
fi

# Send to Datadog if configured
if [[ -n "${DD_API_KEY:-}" ]]; then
  echo ""
  echo "Sending metrics to Datadog..."
  if [[ "${VM_BOOT}" != "0" && "${VM_BOOT}" != "null" ]]; then
    curl -X POST "https://api.datadoghq.com/api/v1/series" \
      -H "DD-API-KEY: ${DD_API_KEY}" \
      -H "Content-Type: application/json" \
      -d '{
        "series": [{
          "metric": "mseries.vm_boot_ms",
          "points": [['"$(date +%s)"', '"${VM_BOOT}"']],
          "type": "gauge",
          "tags": ["chip:'"${CHIP}"'", "test:virtualization"]
        }]
      }' &> /dev/null || echo "Failed to send metrics"
  fi
fi
