#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/security/verify-binary-download.sh
source "$SCRIPT_DIR/verify-binary-download.sh"

: "${KUBECTL_VERSION:=v1.31.0}"

if [ $# -gt 0 ] && [ -n "$1" ]; then
    OUTPUT_PATH="$1"
fi

if [ -n "${OUTPUT_PATH:-}" ]; then
    log_info "Using OUTPUT_PATH: $OUTPUT_PATH"
fi

log_info "Starting kubectl verification for version $KUBECTL_VERSION"

BINARY_URL="https://dl.k8s.io/release/${KUBECTL_VERSION}/bin/linux/amd64/kubectl"
CHECKSUM_URL="${BINARY_URL}.sha256"
SIGNATURE_URL="${BINARY_URL}.sig"
IDENTITY="krel-trusted-builder@k8s-releng-prod.iam.gserviceaccount.com"
ISSUER="https://accounts.google.com"

if ! verify_binary_download \
    "kubectl" \
    "$BINARY_URL" \
    "sha256" \
    "$CHECKSUM_URL" \
    "cosign" \
    "$SIGNATURE_URL" \
    "$IDENTITY" \
    "$ISSUER"; then
    log_error "kubectl ${KUBECTL_VERSION} verification failed"
    exit 1
fi

log_info "kubectl ${KUBECTL_VERSION} verification succeeded"
