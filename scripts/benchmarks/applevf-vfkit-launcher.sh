#!/usr/bin/env bash
set -euo pipefail

: "${MICROVM_KERNEL:?need MICROVM_KERNEL}"
: "${MICROVM_INITRD:?need MICROVM_INITRD}"
: "${MICROVM_CMDLINE:?need MICROVM_CMDLINE}"
: "${MICROVM_CPUS:?need MICROVM_CPUS}"
: "${MICROVM_MEMORY_MB:?need MICROVM_MEMORY_MB}"
: "${MICROVM_PORT:?need MICROVM_PORT}"
: "${MICROVM_RUNTIME_DIR:?need MICROVM_RUNTIME_DIR}"

USE_STDIO=0
if [[ -n ${MICROVM_APPLEVF_STDIO:-} ]]; then
  USE_STDIO=1
fi

if [[ ${USE_STDIO} -eq 0 ]]; then
  : "${MICROVM_SERIAL_LOG:?need MICROVM_SERIAL_LOG}"
fi

VFKIT_BIN=${MICROVM_VFKIT_BIN:-$(command -v vfkit || true)}
GVPROXY_BIN=${MICROVM_GVPROXY_BIN:-$(command -v gvproxy || true)}

if [[ -z ${GVPROXY_BIN} ]] && command -v go >/dev/null 2>&1; then
  GOPATH_BIN=$(go env GOPATH 2>/dev/null)/bin/gvproxy || true
  if [[ -x ${GOPATH_BIN} ]]; then
    GVPROXY_BIN=${GOPATH_BIN}
  fi
fi

if [[ -z ${VFKIT_BIN} ]]; then
  echo "error: vfkit not found (set MICROVM_VFKIT_BIN)" >&2
  exit 1
fi
if [[ -z ${GVPROXY_BIN} ]]; then
  echo "error: gvproxy not found (install via \"go install github.com/containers/gvisor-tap-vsock/cmd/gvproxy@latest\" or set MICROVM_GVPROXY_BIN)" >&2
  exit 1
fi

mkdir -p "${MICROVM_RUNTIME_DIR}"
RUNTIME_DIR=$(cd "${MICROVM_RUNTIME_DIR}" && pwd)

GVPROXY_SOCKET="${RUNTIME_DIR}/gvproxy.sock"
GVPROXY_API="${RUNTIME_DIR}/gvproxy-api.sock"
GVPROXY_PID_FILE="${RUNTIME_DIR}/gvproxy.pid"
GVPROXY_LOG="${RUNTIME_DIR}/gvproxy.log"

# gvproxy expects this MAC/IP mapping
STATIC_MAC="5a:94:ef:e4:0c:ee"
STATIC_IP="192.168.127.2/24"
STATIC_GATEWAY="192.168.127.1"
GUEST_HTTP_TARGET="192.168.127.2:3000"
HOST_FORWARD="127.0.0.1:${MICROVM_PORT}"

cleanup() {
  if [[ -n ${VFKIT_PID:-} ]]; then
    kill "$VFKIT_PID" 2>/dev/null || true
  fi
  if [[ -f ${GVPROXY_PID_FILE} ]]; then
    if read -r GVPID < "${GVPROXY_PID_FILE}"; then
      kill "$GVPID" 2>/dev/null || true
      wait "$GVPID" 2>/dev/null || true
    fi
    rm -f "${GVPROXY_PID_FILE}"
  fi
  rm -f "${GVPROXY_SOCKET}" "${GVPROXY_API}"
}
trap cleanup EXIT

start_gvproxy() {
  "${GVPROXY_BIN}" \
    --mtu 1500 \
    --ssh-port -1 \
    --listen-vfkit "unixgram://${GVPROXY_SOCKET}" \
    --listen "unix://${GVPROXY_API}" \
    --pid-file "${GVPROXY_PID_FILE}" \
    --log-file "${GVPROXY_LOG}" \
    >/dev/null 2>&1 &
  GVPROXY_SHIM_PID=$!
  # wait until pid file exists
  for _ in {1..200}; do
    if [[ -f ${GVPROXY_PID_FILE} && -S ${GVPROXY_API} && -S ${GVPROXY_SOCKET} ]]; then
      return 0
    fi
    sleep 0.1
  done
  echo "error: gvproxy failed to start" >&2
  kill "$GVPROXY_SHIM_PID" 2>/dev/null || true
  exit 1
}

wait_gvproxy_ready() {
  for _ in {1..200}; do
    if curl --silent --unix-socket "${GVPROXY_API}" http://d/services/forwarder/all >/dev/null 2>&1; then
      return 0
    fi
    sleep 0.1
  done
  echo "error: gvproxy API not responding" >&2
  exit 1
}

expose_port() {
  local payload
  payload=$(cat <<JSON
{"local":"${HOST_FORWARD}","remote":"${GUEST_HTTP_TARGET}","protocol":"tcp"}
JSON
)
  if ! curl --silent --unix-socket "${GVPROXY_API}" \
      -H 'Content-Type: application/json' \
      -X POST \
      -d "${payload}" \
      http://d/services/forwarder/expose >/dev/null; then
    echo "error: gvproxy failed to expose ${HOST_FORWARD} -> ${GUEST_HTTP_TARGET}" >&2
    exit 1
  fi
}

start_vfkit() {
  local cmdline
  cmdline="${MICROVM_CMDLINE} root=/dev/ram0 vf_static_ip=${STATIC_IP} vf_gateway=${STATIC_GATEWAY}"
  local foreground=0
  if [[ -n ${MICROVM_APPLEVF_FOREGROUND:-} ]]; then
    foreground=1
  fi

  local args=(
    "${VFKIT_BIN}"
    --cpus "${MICROVM_CPUS}"
    --memory "${MICROVM_MEMORY_MB}"
    --kernel "${MICROVM_KERNEL}"
    --initrd "${MICROVM_INITRD}"
    --kernel-cmdline "${cmdline}"
    --device "virtio-net,unixSocketPath=${GVPROXY_SOCKET},mac=${STATIC_MAC}"
    --device "virtio-rng"
  )
  if [[ ${USE_STDIO} -eq 1 ]]; then
    args+=(--device "virtio-serial,stdio")
  else
    args+=(--device "virtio-serial,logFilePath=${MICROVM_SERIAL_LOG}")
  fi
  args+=(--device "virtio-balloon")
  if [[ -n ${MICROVM_EXTRA_ARGS:-} ]]; then
    # shellcheck disable=SC2206
    EXTRA=( ${MICROVM_EXTRA_ARGS} )
    args+=("${EXTRA[@]}")
  fi

  if [[ ${foreground} -eq 1 ]]; then
    "${args[@]}"
  else
    if [[ ${USE_STDIO} -eq 1 ]]; then
      "${args[@]}" &
    else
      "${args[@]}" >/dev/null 2>&1 &
    fi
    VFKIT_PID=$!
    if [[ -n ${MICROVM_PID_FILE:-} ]]; then
      printf '%s' "$VFKIT_PID" > "${MICROVM_PID_FILE}"
    fi
    wait "$VFKIT_PID"
  fi
}

start_gvproxy
wait_gvproxy_ready
expose_port
start_vfkit
