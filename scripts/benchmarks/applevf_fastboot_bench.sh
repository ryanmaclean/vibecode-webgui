#!/usr/bin/env bash
# Apple Virtualization Framework Fast Boot Benchmark
# Measures cold boot to /healthz for EFI-stub kernel + minimal initramfs
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
BENCH_DIR="${ROOT_DIR}/bench-images/apple-vf-fastboot"
RESULTS_DIR="${ROOT_DIR}/docs/reports/benchmarks"

# Configuration
KERNEL="${APPLEVF_KERNEL:-${BENCH_DIR}/vmlinux-efi-stub}"
INITRD="${APPLEVF_INITRD:-${BENCH_DIR}/initramfs-minimal.cpio.gz}"
CPUS=${APPLEVF_CPUS:-2}
MEMORY_MB=${APPLEVF_MEMORY_MB:-512}
PORT=${APPLEVF_PORT:-3000}
HOST=${APPLEVF_HOST:-127.0.0.1}
TIMEOUT=${APPLEVF_TIMEOUT:-30}
ITERATIONS=${1:-5}

# VF launcher (vfkit, macvz, or custom)
VF_LAUNCHER="${APPLEVF_LAUNCHER:-vfkit}"

PID_FILE="${BENCH_DIR}/.vm.pid"
SERIAL_LOG="${BENCH_DIR}/console.log"

echo "=== Apple VF Fast Boot Benchmark ==="
echo "Kernel: $KERNEL"
echo "Initrd: $INITRD"
echo "Iterations: $ITERATIONS"
echo ""

# Validate assets
if [[ ! -f "$KERNEL" ]]; then
  echo "Error: Kernel not found at $KERNEL"
  echo ""
  echo "Build it with:"
  echo "  lima kernel-builder -- ./scripts/benchmarks/build-efi-stub-kernel.sh arm64"
  exit 1
fi

if [[ ! -f "$INITRD" ]]; then
  echo "Error: Initramfs not found at $INITRD"
  echo ""
  echo "Build it with:"
  echo "  ./scripts/benchmarks/build-minimal-initramfs.sh arm64"
  exit 1
fi

ms_now() {
  python3 -c 'import time; print(int(time.time() * 1000))'
}

wait_for_healthz() {
  local timeout=$1
  local start
  start=$(ms_now)
  local deadline=$((start + timeout * 1000))

  while :; do
    if curl -sf "http://${HOST}:${PORT}/healthz" >/dev/null 2>&1; then
      local end
      end=$(ms_now)
      echo $((end - start))
      return 0
    fi
    if [[ $(ms_now) -ge $deadline ]]; then
      return 1
    fi
    sleep 0.05
  done
}

stop_vm() {
  if [[ -f "$PID_FILE" ]]; then
    local pid
    pid=$(cat "$PID_FILE")
    kill "$pid" 2>/dev/null || true
    sleep 0.5
    kill -9 "$pid" 2>/dev/null || true
    rm -f "$PID_FILE"
  fi
}

start_vm_vfkit() {
  # vfkit command for Apple VF
  vfkit \
    --cpus "$CPUS" \
    --memory "$MEMORY_MB" \
    --bootloader linux,kernel="$KERNEL",initrd="$INITRD",cmdline="console=hvc0 rdinit=/init quiet" \
    --device virtio-net,nat,localPort="${PORT}:3000" \
    --device virtio-serial,stdio \
    --device virtio-rng \
    >"$SERIAL_LOG" 2>&1 &
  echo $! > "$PID_FILE"
}

start_vm_custom() {
  # Custom launcher via environment
  env \
    MICROVM_KERNEL="$KERNEL" \
    MICROVM_INITRD="$INITRD" \
    MICROVM_CMDLINE="console=hvc0 rdinit=/init quiet" \
    MICROVM_CPUS="$CPUS" \
    MICROVM_MEMORY_MB="$MEMORY_MB" \
    MICROVM_HOST="$HOST" \
    MICROVM_PORT="$PORT" \
    MICROVM_PID_FILE="$PID_FILE" \
    MICROVM_SERIAL_LOG="$SERIAL_LOG" \
    "$VF_LAUNCHER" >"$SERIAL_LOG" 2>&1 &
  echo $! > "$PID_FILE"
}

start_vm() {
  mkdir -p "$(dirname "$SERIAL_LOG")"
  : > "$SERIAL_LOG"

  case "$VF_LAUNCHER" in
    vfkit)
      start_vm_vfkit
      ;;
    *)
      start_vm_custom
      ;;
  esac
}

run_benchmark() {
  local samples=()

  for i in $(seq 1 "$ITERATIONS"); do
    stop_vm
    sleep 0.5

    echo -n "  Run $i/$ITERATIONS: "

    local start_time
    start_time=$(ms_now)
    start_vm

    local elapsed
    if elapsed=$(wait_for_healthz "$TIMEOUT"); then
      echo "${elapsed}ms"
      samples+=("$elapsed")
    else
      echo "TIMEOUT"
      stop_vm
      continue
    fi

    stop_vm
  done

  # Output JSON results
  local json_samples
  json_samples=$(IFS=,; echo "${samples[*]}")

  local avg=0
  local min=999999
  local max=0

  for s in "${samples[@]}"; do
    avg=$((avg + s))
    [[ $s -lt $min ]] && min=$s
    [[ $s -gt $max ]] && max=$s
  done
  avg=$((avg / ${#samples[@]}))

  echo ""
  echo "=== Results ==="
  echo "{"
  echo "  \"boot_to_healthz_ms\": [$json_samples],"
  echo "  \"avg_ms\": $avg,"
  echo "  \"min_ms\": $min,"
  echo "  \"max_ms\": $max,"
  echo "  \"config\": {"
  echo "    \"cpus\": $CPUS,"
  echo "    \"memory_mb\": $MEMORY_MB,"
  echo "    \"kernel\": \"$(basename "$KERNEL")\","
  echo "    \"initrd\": \"$(basename "$INITRD")\","
  echo "    \"launcher\": \"$VF_LAUNCHER\""
  echo "  }"
  echo "}"

  # Save results
  mkdir -p "$RESULTS_DIR"
  local timestamp
  timestamp=$(date +%Y%m%dT%H%M%SZ)
  local results_file="${RESULTS_DIR}/applevf-fastboot-${timestamp}.json"

  cat > "$results_file" << EOF
{
  "timestamp": "$timestamp",
  "boot_to_healthz_ms": [$json_samples],
  "avg_ms": $avg,
  "min_ms": $min,
  "max_ms": $max,
  "config": {
    "cpus": $CPUS,
    "memory_mb": $MEMORY_MB,
    "kernel": "$(basename "$KERNEL")",
    "initrd": "$(basename "$INITRD")",
    "initrd_size_bytes": $(stat -f%z "$INITRD" 2>/dev/null || stat -c%s "$INITRD"),
    "kernel_size_bytes": $(stat -f%z "$KERNEL" 2>/dev/null || stat -c%s "$KERNEL"),
    "launcher": "$VF_LAUNCHER",
    "host": "$(uname -m)"
  }
}
EOF

  echo ""
  echo "Results saved to: $results_file"
}

# Main
case ${1:-bench} in
  bench|measure)
    ITERATIONS=${2:-5}
    run_benchmark
    ;;
  start)
    stop_vm
    start_vm
    if elapsed=$(wait_for_healthz "$TIMEOUT"); then
      echo "VM started in ${elapsed}ms"
      echo "PID: $(cat "$PID_FILE")"
      echo "Health: http://${HOST}:${PORT}/healthz"
    else
      echo "VM failed to start"
      stop_vm
      exit 1
    fi
    ;;
  stop)
    stop_vm
    echo "VM stopped"
    ;;
  status)
    if [[ -f "$PID_FILE" ]] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
      echo "VM running (PID $(cat "$PID_FILE"))"
    else
      echo "VM stopped"
    fi
    ;;
  *)
    echo "Usage: $0 {bench|start|stop|status} [iterations]"
    echo ""
    echo "Environment variables:"
    echo "  APPLEVF_KERNEL   - Path to kernel"
    echo "  APPLEVF_INITRD   - Path to initramfs"
    echo "  APPLEVF_CPUS     - Number of CPUs (default: 2)"
    echo "  APPLEVF_MEMORY_MB - Memory in MB (default: 512)"
    echo "  APPLEVF_LAUNCHER - vfkit or custom launcher path"
    ;;
esac
