#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
CERT_DIR="$ROOT_DIR/fast-openvscode-vm/certs"
CERT_FILE="$CERT_DIR/openvscode-local.pem"
KEY_FILE="$CERT_DIR/openvscode-local-key.pem"
TARGET_HOST=${TARGET_HOST:-127.0.0.1}
TARGET_PORT=${TARGET_PORT:-3600}
LISTEN_HOST=${LISTEN_HOST:-127.0.0.1}
LISTEN_PORT=${LISTEN_PORT:-3443}

mkdir -p "$CERT_DIR"

generate_with_mkcert() {
  if ! command -v mkcert >/dev/null 2>&1; then
    return 1
  fi
  if [[ ! -f "$CERT_FILE" || ! -f "$KEY_FILE" ]]; then
    echo "Generating certificates with mkcert"
    mkcert -cert-file "$CERT_FILE" -key-file "$KEY_FILE" localhost 127.0.0.1 ::1 "${LISTEN_HOST}"
  fi
  return 0
}

generate_with_openssl() {
  if command -v openssl >/dev/null 2>&1; then
    if [[ ! -f "$CERT_FILE" || ! -f "$KEY_FILE" ]]; then
      echo "Generating self-signed certificate with OpenSSL"
      openssl req -x509 -nodes -days 365 \
        -newkey rsa:2048 \
        -keyout "$KEY_FILE" \
        -out "$CERT_FILE" \
        -subj "/CN=localhost"
    fi
  else
    echo "error: neither mkcert nor openssl available to generate certificates" >&2
    exit 1
  fi
}

if ! generate_with_mkcert; then
  generate_with_openssl
fi

LISTEN_URL="https://${LISTEN_HOST}:${LISTEN_PORT}"
TARGET_URL="http://${TARGET_HOST}:${TARGET_PORT}"

node "$ROOT_DIR/scripts/dev/openvscode-https-proxy.js" \
  --cert "$CERT_FILE" \
  --key "$KEY_FILE" \
  --listen "$LISTEN_URL" \
  --target "$TARGET_URL" \
  --verbose
