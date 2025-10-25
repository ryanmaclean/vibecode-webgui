#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
ARCH=${MICROVM_ARCH:-x86_64}

case "$ARCH" in
  x86_64)
    VM_DIR="${MICROVM_DIR:-$ROOT_DIR/fast-openvscode-vm}"
    DEFAULT_KERNEL="$VM_DIR/vmlinux-fast"
    if [[ ! -f "$DEFAULT_KERNEL" ]]; then
      DEFAULT_KERNEL="$VM_DIR/vmlinuz-host"
    fi
    PORT=${MICROVM_PORT:-3600}
    HOST=127.0.0.1
    QEMU_BIN=${QEMU_BIN:-qemu-system-x86_64}
    MACHINE_OPTS=("-machine" "accel=hvf,type=pc" "-cpu" "max" "-smp" "4" "-m" "2048")
    NET_OPTS=("-device" "virtio-net,netdev=n0" "-netdev" "user,id=n0,hostfwd=tcp::${PORT}-:3000")
    APPEND="rdinit=/init console=ttyS0 quiet"
    ;;
  arm64)
    VM_DIR="${MICROVM_DIR:-$ROOT_DIR/fast-openvscode-vm-arm64}"
    DEFAULT_KERNEL="$VM_DIR/vmlinux-fast"
    if [[ ! -f "$DEFAULT_KERNEL" ]]; then
      DEFAULT_KERNEL="$VM_DIR"/vmlinuz-6.1.0-40-arm64
    fi
    PORT=${MICROVM_PORT:-4600}
    HOST=127.0.0.1
    QEMU_BIN=${QEMU_BIN:-qemu-system-aarch64}
    MACHINE_OPTS=("-machine" "virt,virtualization=on,highmem=off" "-cpu" "cortex-a72" "-smp" "4" "-m" "2048")
    NET_OPTS=("-device" "virtio-net-pci,netdev=n0" "-netdev" "user,id=n0,hostfwd=tcp::${PORT}-:3000")
    APPEND="rdinit=/init console=ttyAMA0"
    ;;
  *)
    echo "error: unsupported MICROVM_ARCH '$ARCH'" >&2
    exit 1
    ;;
esac

KERNEL="${MICROVM_KERNEL:-$DEFAULT_KERNEL}"
INITRD="$VM_DIR/openvscode-initramfs.cpio.gz"
PID_FILE="$VM_DIR/.microvm.pid"
SERIAL_LOG="$VM_DIR/qemu-console.log"
COMMON_OPTS=("-kernel" "$KERNEL" "-initrd" "$INITRD" "-append" "$APPEND" "-display" "none")
LAST_READY_MS=0

ms_now() {
  python3 -c 'import time; print(int(time.time() * 1000))'
}

require_vm_assets() {
  if [[ ! -f "$KERNEL" || ! -f "$INITRD" ]]; then
    echo "error: kernel/initramfs missing in $VM_DIR" >&2
    exit 1
  fi
}

vm_running() {
  [[ -f "$PID_FILE" ]] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null
}

start_vm() {
  if vm_running; then
    echo "microVM already running (pid $(cat "$PID_FILE"))"
    return 0
  fi
  require_vm_assets
  rm -f "$SERIAL_LOG"
  "${QEMU_BIN}" "${MACHINE_OPTS[@]}" "${COMMON_OPTS[@]}" "${NET_OPTS[@]}" -pidfile "$PID_FILE" -serial "file:$SERIAL_LOG" -daemonize
  local elapsed
  elapsed=$(wait_for_ready 20) || {
    echo "error: microVM failed readiness check" >&2
    stop_vm
    exit 1
  }
  LAST_READY_MS=$elapsed
  echo "microVM started (pid $(cat "$PID_FILE"), ready ${elapsed}ms)"
}

stop_vm() {
  if ! vm_running; then
    rm -f "$PID_FILE"
    return 0
  fi
  kill "$(cat "$PID_FILE")" 2>/dev/null || true
  sleep 1
  if vm_running; then
    kill -9 "$(cat "$PID_FILE")" 2>/dev/null || true
  fi
  rm -f "$PID_FILE"
  echo "microVM stopped"
}

wait_for_ready() {
  local timeout=${1:-15}
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
      break
    fi
    sleep 0.01
  done
  return 1
}

measure_latency() {
  local iterations=${1:-5}
  local samples=()
  for _ in $(seq 1 "$iterations"); do
    stop_vm >/dev/null 2>&1 || true
    LAST_READY_MS=0
    start_vm >/dev/null
    if [[ ${LAST_READY_MS:-0} -eq 0 ]]; then
      echo "error: failed to capture readiness metric" >&2
      exit 1
    fi
    samples+=("$LAST_READY_MS")
  done
  printf '{"port_ready_ms": ['
  local first=1
  for sample in "${samples[@]}"; do
    if [[ $first -eq 0 ]]; then
      printf ', '
    fi
    printf '%s' "$sample"
    first=0
  done
  printf ']}'
  stop_vm >/dev/null 2>&1 || true
}

status_vm() {
  if vm_running; then
    echo "microVM running (pid $(cat "$PID_FILE"))"
  else
    echo "microVM stopped"
  fi
}

case ${1:-help} in
  start)
    start_vm
    ;;
  stop)
    stop_vm
    ;;
  status)
    status_vm
    ;;
  measure)
    iterations=${2:-5}
    measure_latency "$iterations"
    ;;
  restart)
    stop_vm >/dev/null 2>&1 || true
    start_vm
    ;;
  *)
    cat <<USAGE
Usage: $0 <command>
Commands:
  start            Launch the OpenVSCode microVM and wait for readiness
  stop             Terminate the running microVM (if any)
  restart          Restart the microVM
  status           Print whether the microVM is running
  measure [n]      Measure readiness latency over n iterations (default 5) and emit JSON
USAGE
    exit 1
    ;;
esac
