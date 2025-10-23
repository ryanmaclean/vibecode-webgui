#!/usr/bin/env bash
# Test musl build with Datadog metrics using Alpine image

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

DD_API_KEY="${DD_API_KEY:-dummy-key-for-local-dev}"
DD_SITE="${DD_SITE:-datadoghq.com}"

echo "=== Testing musl Build with Datadog Metrics ==="
if [ "${MASK_DD_LOGS:-1}" -eq 1 ] 2>/dev/null; then
  echo "API Key: **** (masked)"
else
  echo "API Key: ${DD_API_KEY:0:8}..."
fi
echo "Site: ${DD_SITE}"
echo ""

# Run build in Alpine container with Datadog agent
docker run --rm \
  -v "${REPO_ROOT}:/work" \
  -w /work \
  -e DD_API_KEY="${DD_API_KEY}" \
  -e DD_SITE="${DD_SITE}" \
  datadog/docker-dd-agent:latest-alpine \
  sh -c '
    set -e
    
    # Install build tools
    apk add --no-cache build-base linux-headers python3 py3-pip bc curl
    
    echo "Building BusyBox with musl..."
    START_TIME=$(date +%s)
    
    mkdir -p /tmp/bb && cd /tmp/bb
    curl -sSL -o busybox-1.36.1.tar.gz https://github.com/mirror/busybox/archive/refs/tags/1_36_1.tar.gz
    tar xf busybox-1.36.1.tar.gz && cd busybox-1_36_1
    
    make defconfig
    sed -i "s/CONFIG_TC=y/# CONFIG_TC is not set/" .config
    sed -i "s/# CONFIG_STATIC is not set/CONFIG_STATIC=y/" .config
    sed -i "s/CONFIG_SEEDRNG=y/# CONFIG_SEEDRNG is not set/" .config || true
    yes '' | make oldconfig > /dev/null 2>&1
    make -j$(nproc)
    strip busybox
    
    END_TIME=$(date +%s)
    BUILD_DURATION=$((END_TIME - START_TIME))
    BINARY_SIZE=$(stat -c%s busybox)
    
    echo "Build complete:"
    echo "  Duration: ${BUILD_DURATION}s"
    echo "  Binary size: ${BINARY_SIZE} bytes ($(echo "scale=1; $BINARY_SIZE/1024/1024" | bc)MB)"
    
    # Send metrics to Datadog
    if [ "${DD_API_KEY}" != "dummy-key-for-local-dev" ]; then
      METRIC_OK=1
      python3 /work/scripts/benchmarks/emit_to_datadog.py \
        musl.busybox.build.duration \
        "$BUILD_DURATION" \
        "libc:musl,image:datadog-alpine" || { echo "Metric send failed (non-fatal)"; METRIC_OK=0; }

      python3 /work/scripts/benchmarks/emit_to_datadog.py \
        musl.busybox.binary.size \
        "$BINARY_SIZE" \
        "libc:musl,image:datadog-alpine" || { echo "Metric send failed (non-fatal)"; METRIC_OK=0; }

      if [ "$METRIC_OK" -eq 1 ]; then
        echo "✓ Metrics sent to Datadog"
      else
        echo "⚠ Metrics not confirmed (see errors above)"
      fi
    else
      echo "⚠ Skipping Datadog metrics (dummy key)"
    fi
    
    # Copy output
    cp busybox /work/bench-images/busybox/busybox-datadog-alpine
    echo "✓ Binary saved to bench-images/busybox/busybox-datadog-alpine"
  '

echo ""
echo "=== Test Complete ==="
ls -lh bench-images/busybox/busybox-datadog-alpine
file bench-images/busybox/busybox-datadog-alpine
