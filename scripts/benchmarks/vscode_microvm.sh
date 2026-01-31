#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
ARCH=${MICROVM_ARCH:-x86_64}
RUNTIME=${MICROVM_RUNTIME:-qemu}

DEFAULT_CPUS=4
DEFAULT_MEMORY_MB=2048

case "$ARCH" in
  x86_64)
    VM_DIR="${MICROVM_DIR:-$ROOT_DIR/fast-openvscode-vm}"
    DEFAULT_KERNEL="$VM_DIR/vmlinux-fast"
    if [[ ! -f "$DEFAULT_KERNEL" ]]; then
      DEFAULT_KERNEL="$VM_DIR/vmlinuz-host"
    fi
    PORT=${MICROVM_PORT:-3600}
    HOST=${MICROVM_HOST:-127.0.0.1}
    QEMU_BIN=${QEMU_BIN:-qemu-system-x86_64}
    DEFAULT_CPUS=4
    DEFAULT_MEMORY_MB=2048
    MACHINE_OPTS=("-machine" "accel=hvf,type=pc" "-cpu" "max")
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
    HOST=${MICROVM_HOST:-127.0.0.1}
    QEMU_BIN=${QEMU_BIN:-qemu-system-aarch64}
    DEFAULT_CPUS=4
    DEFAULT_MEMORY_MB=2048
    MACHINE_OPTS=("-machine" "virt,virtualization=on,highmem=off" "-cpu" "cortex-a72")
    NET_OPTS=("-device" "virtio-net-pci,netdev=n0" "-netdev" "user,id=n0,hostfwd=tcp::${PORT}-:3000")
    APPEND="rdinit=/init console=ttyAMA0"
    ;;
  *)
    echo "error: unsupported MICROVM_ARCH '$ARCH'" >&2
    exit 1
    ;;
esac

if [[ -n ${MICROVM_CMDLINE_EXTRA:-} ]]; then
  APPEND+=" ${MICROVM_CMDLINE_EXTRA}"
fi

CPUS=${MICROVM_CPUS:-$DEFAULT_CPUS}
MEMORY_MB=${MICROVM_MEMORY_MB:-$DEFAULT_MEMORY_MB}

MACHINE_OPTS+=("-smp" "$CPUS" "-m" "$MEMORY_MB")

KERNEL="${MICROVM_KERNEL:-$DEFAULT_KERNEL}"
INITRD="${MICROVM_INITRD:-$VM_DIR/openvscode-initramfs.cpio.gz}"
PID_FILE="$VM_DIR/.microvm.pid"
SERIAL_LOG="$VM_DIR/qemu-console.log"
COMMON_OPTS=("-kernel" "$KERNEL" "-initrd" "$INITRD" "-append" "$APPEND" "-display" "none")
LAST_READY_MS=0
LAST_HEALTHZ_MS=0
READY_TIMEOUT=${MICROVM_READY_TIMEOUT:-60}
READY_POLL_INTERVAL=${MICROVM_READY_POLL_SEC:-0.1}

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

start_qemu() {
  "${QEMU_BIN}" "${MACHINE_OPTS[@]}" "${COMMON_OPTS[@]}" "${NET_OPTS[@]}" -pidfile "$PID_FILE" -serial "file:$SERIAL_LOG" -daemonize
}

resolve_applevf_launcher() {
  if [[ -n ${MICROVM_APPLEVF_CMD:-} ]]; then
    echo "$MICROVM_APPLEVF_CMD"
    return 0
  fi
  local repo_launcher="${ROOT_DIR}/scripts/benchmarks/applevf-vfkit-launcher.sh"
  if [[ -x "$repo_launcher" ]]; then
    echo "$repo_launcher"
    return 0
  fi
  local candidate
  for candidate in vz-run vzctl vz macvz vfkit; do
    if command -v "$candidate" >/dev/null 2>&1; then
      echo "$candidate"
      return 0
    fi
  done
  return 1
}

start_applevf() {
  local launcher
  if ! launcher=$(resolve_applevf_launcher); then
    cat <<'EOF' >&2
error: Apple Virtualization runtime not configured.

Set MICROVM_APPLEVF_CMD to a launcher script/binary that knows how to boot the
kernel via Virtualization.framework, or install a supported CLI (e.g. vz-run,
macvz, vfkit) and ensure it is on PATH. See docs/virtualization/openvscode-microvm.md
for wiring examples.
EOF
    exit 1
  fi

  if [[ ! -x "$launcher" ]] && ! command -v "$launcher" >/dev/null 2>&1; then
    echo "error: MICROVM_APPLEVF_CMD '$launcher' not executable" >&2
    exit 1
  fi

  mkdir -p "$(dirname "$SERIAL_LOG")"
  : >"$SERIAL_LOG"

  local env_vars=(
    "MICROVM_KERNEL=$KERNEL"
    "MICROVM_INITRD=$INITRD"
    "MICROVM_CMDLINE=$APPEND"
    "MICROVM_CPUS=$CPUS"
    "MICROVM_MEMORY_MB=$MEMORY_MB"
    "MICROVM_HOST=$HOST"
    "MICROVM_PORT=$PORT"
    "MICROVM_PID_FILE=$PID_FILE"
    "MICROVM_SERIAL_LOG=$SERIAL_LOG"
    "MICROVM_RUNTIME_DIR=$VM_DIR"
    "MICROVM_EXTRA_ARGS=${MICROVM_EXTRA_APPLEVF_ARGS:-}"
  )

  if [[ -n ${MICROVM_APPLEVF_FOREGROUND:-} ]]; then
    env "${env_vars[@]}" "$launcher"
    return $?
  fi

  env "${env_vars[@]}" "$launcher" >>"$SERIAL_LOG" 2>&1 &
  local pid=$!
  echo "$pid" >"$PID_FILE"
  disown "$pid" 2>/dev/null || true
}

start_vm() {
  if vm_running; then
    echo "microVM already running (pid $(cat "$PID_FILE"))"
    return 0
  fi
  require_vm_assets
  rm -f "$SERIAL_LOG"
  if [[ "$ARCH" == "arm64" && ("$RUNTIME" == "applevf" || "$RUNTIME" == "vf") ]]; then
    APPEND="console=hvc0 rdinit=/init quiet"
    if [[ -n ${MICROVM_CMDLINE_EXTRA:-} ]]; then
      APPEND+=" ${MICROVM_CMDLINE_EXTRA}"
    fi
  fi
  case "$RUNTIME" in
    qemu)
      start_qemu
      ;;
    applevf|vf)
      start_applevf
      ;;
    *)
      echo "error: unsupported MICROVM_RUNTIME '$RUNTIME'" >&2
      exit 1
      ;;
  esac
  local elapsed
  elapsed=$(wait_for_ready "$READY_TIMEOUT") || {
    echo "error: microVM failed readiness check" >&2
    stop_vm
    exit 1
  }
  LAST_READY_MS=$elapsed
  LAST_HEALTHZ_MS=$elapsed
  echo "$elapsed" > "${VM_DIR}/healthz-ready-ms"
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
  local timeout=${1:-$READY_TIMEOUT}
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
    sleep "$READY_POLL_INTERVAL"
  done
  return 1
}

measure_latency() {
  local iterations=${1:-5}
  local samples=()
  for _ in $(seq 1 "$iterations"); do
    stop_vm >/dev/null 2>&1 || true
    LAST_READY_MS=0
    LAST_HEALTHZ_MS=0
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
  printf '], "healthz_ready_ms": ['
  first=1
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
  help|*)
    echo "usage: $0 {start|stop|status|measure [n]}"
    echo "environment variables: MICROVM_ARCH, MICROVM_RUNTIME (qemu|applevf), MICROVM_DIR, MICROVM_KERNEL, MICROVM_PORT, MICROVM_APPLEVF_CMD"
    ;;
esac
