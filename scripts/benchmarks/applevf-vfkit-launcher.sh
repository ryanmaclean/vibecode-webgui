#!/usr/bin/env bash
set -euo pipefail

: "${MICROVM_KERNEL:?need MICROVM_KERNEL}"
: "${MICROVM_INITRD:?need MICROVM_INITRD}"
: "${MICROVM_CMDLINE:?need MICROVM_CMDLINE}"
: "${MICROVM_CPUS:?need MICROVM_CPUS}"
: "${MICROVM_MEMORY_MB:?need MICROVM_MEMORY_MB}"
: "${MICROVM_HOST:-}"
: "${MICROVM_PORT:?need MICROVM_PORT}"
: "${MICROVM_PID_FILE:-}"
: "${MICROVM_SERIAL_LOG:-}"

MAC=${MICROVM_VF_MAC:-"52:54:00:$(openssl rand -hex 3 | sed 's/../&:/g; s/:$//')"}

if ! command -v vfkit >/dev/null 2>&1; then
  echo "vfkit binary not found" >&2
  exit 1
fi

read -r CMDLINE_ESCAPED <<EOF_CMDLINE
${MICROVM_CMDLINE}
EOF_CMDLINE

set -- \
  vfkit \
  --cpus "${MICROVM_CPUS}" \
  --memory "${MICROVM_MEMORY_MB}" \
  --kernel "${MICROVM_KERNEL}" \
  --initrd "${MICROVM_INITRD}" \
  --kernel-cmdline "${CMDLINE_ESCAPED}" \
  --device "virtio-net,nat,mac=${MAC}" \
  --device "virtio-rng" \
  --device "virtio-serial,logFilePath=${MICROVM_SERIAL_LOG}" \
  --device "virtio-balloon"

if [[ -n ${MICROVM_EXTRA_ARGS:-} ]]; then
  # shellcheck disable=SC2206
  EXTRA=( ${MICROVM_EXTRA_ARGS} )
  set -- "$@" "${EXTRA[@]}"
fi

exec "$@"
