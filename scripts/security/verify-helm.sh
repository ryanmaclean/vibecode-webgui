#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/security/verify-binary-download.sh
source "$SCRIPT_DIR/verify-binary-download.sh"

: "${HELM_VERSION:=v3.16.0}"

if [ $# -gt 0 ] && [ -n "$1" ]; then
    OUTPUT_PATH="$1"
fi

if [ -n "${OUTPUT_PATH:-}" ]; then
    log_info "Using OUTPUT_PATH: $OUTPUT_PATH"
fi

log_info "Starting Helm verification for version $HELM_VERSION"

ARCHIVE_NAME="helm-${HELM_VERSION}-linux-amd64.tar.gz"
BINARY_URL="https://get.helm.sh/${ARCHIVE_NAME}"
CHECKSUM_URL="${BINARY_URL}.sha256sum"
SIGNATURE_URL="${BINARY_URL}.sig"
IDENTITY="https://github.com/helm/helm/.github/workflows/release.yml@refs/tags/${HELM_VERSION}"
ISSUER="https://token.actions.githubusercontent.com"

if ! verify_binary_download \
    "$ARCHIVE_NAME" \
    "$BINARY_URL" \
    "sha256" \
    "$CHECKSUM_URL" \
    "cosign" \
    "$SIGNATURE_URL" \
    "$IDENTITY" \
    "$ISSUER"; then
    log_error "Helm ${HELM_VERSION} verification failed"
    exit 1
fi

log_info "Helm ${HELM_VERSION} verification succeeded"
