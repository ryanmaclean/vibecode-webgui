#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/security/verify-binary-download.sh
source "$SCRIPT_DIR/verify-binary-download.sh"

: "${KUBECTX_VERSION:=v0.9.5}"

if [ $# -gt 0 ] && [ -n "$1" ]; then
    OUTPUT_PATH="$1"
fi

if [ -n "${OUTPUT_PATH:-}" ]; then
    log_info "Using OUTPUT_PATH: $OUTPUT_PATH"
fi

log_info "Starting kubectx verification for version $KUBECTX_VERSION"

ARCHIVE_NAME="kubectx_${KUBECTX_VERSION}_linux_x86_64.tar.gz"
BINARY_URL="https://github.com/ahmetb/kubectx/releases/download/${KUBECTX_VERSION}/${ARCHIVE_NAME}"
CHECKSUM_URL="https://artifacts.vibecode.dev/kubectx/${KUBECTX_VERSION}/${ARCHIVE_NAME}.sha256"
SIGNATURE_URL="https://artifacts.vibecode.dev/kubectx/${KUBECTX_VERSION}/${ARCHIVE_NAME}.sig"
IDENTITY="supply-chain@vibecode.dev"
ISSUER="https://accounts.google.com"

if ! verify_binary_download \
    "$ARCHIVE_NAME" \
    "$BINARY_URL" \
    "sha256" \
    "$CHECKSUM_URL" \
    "cosign" \
    "$SIGNATURE_URL" \
    "$IDENTITY" \
    "$ISSUER"; then
    log_error "kubectx ${KUBECTX_VERSION} verification failed"
    exit 1
fi

log_info "kubectx ${KUBECTX_VERSION} verification succeeded"
