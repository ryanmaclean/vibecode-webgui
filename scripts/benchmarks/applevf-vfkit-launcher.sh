#!/usr/bin/env bash
# applevf-vfkit-launcher.sh - Apple Virtualization Framework launcher using vfkit
# For use with vscode_microvm.sh MICROVM_RUNTIME=applevf
set -euo pipefail

VFKIT=${VFKIT_BIN:-/opt/homebrew/bin/vfkit}

if [[ ! -x "$VFKIT" ]]; then
  echo "error: vfkit not found at $VFKIT" >&2
  exit 1
fi

: "${MICROVM_KERNEL:?MICROVM_KERNEL required}"
: "${MICROVM_INITRD:?MICROVM_INITRD required}"
: "${MICROVM_CMDLINE:=rdinit=/init console=hvc0}"
: "${MICROVM_CPUS:=4}"
: "${MICROVM_MEMORY_MB:=2048}"
: "${MICROVM_HOST:=127.0.0.1}"
: "${MICROVM_PORT:=4600}"
: "${MICROVM_PID_FILE:=/tmp/applevf.pid}"
: "${MICROVM_SERIAL_LOG:=/tmp/applevf.log}"

VFKIT_ARGS=(
  --bootloader "linux,kernel=${MICROVM_KERNEL},initrd=${MICROVM_INITRD},cmdline=${MICROVM_CMDLINE}"
  --cpus "$MICROVM_CPUS"
  --memory "$MICROVM_MEMORY_MB"
  --pidfile "$MICROVM_PID_FILE"
  --device "virtio-net,nat,localPort=${MICROVM_PORT},guestPort=3000"
  --device "virtio-serial,logFilePath=${MICROVM_SERIAL_LOG}"
)

if [[ -n ${MICROVM_EXTRA_ARGS:-} ]]; then
  VFKIT_ARGS+=($MICROVM_EXTRA_ARGS)
fi

mkdir -p "$(dirname "$MICROVM_SERIAL_LOG")"

exec "$VFKIT" "${VFKIT_ARGS[@]}"
