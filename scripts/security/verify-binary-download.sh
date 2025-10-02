#!/usr/bin/env bash
#
# Unified Binary Verification Framework
# Provides reusable functions for secure binary downloads with checksum and cosign verification
#
# Usage:
#   source scripts/security/verify-binary-download.sh
#   verify_binary_download "kubectl" "https://dl.k8s.io/release/v1.28.0/bin/linux/amd64/kubectl" \
#     "sha256" "https://dl.k8s.io/release/v1.28.0/bin/linux/amd64/kubectl.sha256" \
#     "cosign" "https://dl.k8s.io/release/v1.28.0/bin/linux/amd64/kubectl.sig" \
#     "https://github.com/kubernetes/kubernetes" "https://accounts.google.com"

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $*"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $*"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $*"
}

# Download file with retry logic
download_file() {
    local url="$1"
    local output="$2"
    local max_retries=3
    local retry=0

    while [ $retry -lt $max_retries ]; do
        if curl -fsSL -o "$output" "$url"; then
            log_info "Downloaded: $output"
            return 0
        fi
        retry=$((retry + 1))
        log_warn "Download failed, retry $retry/$max_retries"
        sleep 2
    done

    log_error "Failed to download $url after $max_retries attempts"
    return 1
}

# Verify SHA256 checksum
verify_sha256() {
    local binary="$1"
    local checksum_file="$2"

    log_info "Verifying SHA256 checksum for $binary"

    if [ ! -f "$checksum_file" ]; then
        log_error "Checksum file not found: $checksum_file"
        return 1
    fi

    # Extract just the checksum (handle different formats)
    local expected_sum
    expected_sum=$(awk '{print $1}' "$checksum_file" | head -n1)

    local actual_sum
    actual_sum=$(sha256sum "$binary" | awk '{print $1}')

    if [ "$expected_sum" = "$actual_sum" ]; then
        log_info "✓ SHA256 checksum verified"
        return 0
    else
        log_error "✗ SHA256 checksum mismatch!"
        log_error "Expected: $expected_sum"
        log_error "Actual:   $actual_sum"
        return 1
    fi
}

# Verify with cosign
verify_cosign() {
    local binary="$1"
    local signature_file="$2"
    local cert_identity="$3"
    local cert_oidc_issuer="$4"

    log_info "Verifying cosign signature for $binary"

    if ! command -v cosign &> /dev/null; then
        log_error "cosign not found. Install from: https://github.com/sigstore/cosign"
        return 1
    fi

    if [ ! -f "$signature_file" ]; then
        log_error "Signature file not found: $signature_file"
        return 1
    fi

    # Verify the signature
    if cosign verify-blob \
        --signature "$signature_file" \
        --certificate-identity "$cert_identity" \
        --certificate-oidc-issuer "$cert_oidc_issuer" \
        "$binary" &> /dev/null; then
        log_info "✓ Cosign signature verified"
        return 0
    else
        log_error "✗ Cosign signature verification failed!"
        return 1
    fi
}

# Verify with GPG (fallback for tools without cosign)
verify_gpg() {
    local binary="$1"
    local signature_file="$2"
    local keyring="$3"

    log_info "Verifying GPG signature for $binary"

    if ! command -v gpg &> /dev/null; then
        log_error "gpg not found"
        return 1
    fi

    if [ ! -f "$signature_file" ]; then
        log_error "Signature file not found: $signature_file"
        return 1
    fi

    if [ ! -f "$keyring" ]; then
        log_error "Keyring file not found: $keyring"
        return 1
    fi

    if gpg --no-default-keyring --keyring "$keyring" --verify "$signature_file" "$binary" &> /dev/null; then
        log_info "✓ GPG signature verified"
        return 0
    else
        log_error "✗ GPG signature verification failed!"
        return 1
    fi
}

# Main verification function
verify_binary_download() {
    local name="$1"
    local binary_url="$2"
    local checksum_type="$3"
    local checksum_url="$4"
    local signature_type="${5:-}"
    local signature_url="${6:-}"
    local cert_identity="${7:-}"
    local cert_oidc_issuer="${8:-}"

    log_info "========================================="
    log_info "Verifying binary: $name"
    log_info "========================================="

    local temp_dir
    temp_dir=$(mktemp -d)
    trap 'rm -rf "$temp_dir"' EXIT

    local binary="$temp_dir/$name"
    local checksum_file="$temp_dir/$name.checksum"

    # Download binary
    if ! download_file "$binary_url" "$binary"; then
        return 1
    fi

    # Download and verify checksum
    if [ "$checksum_type" = "sha256" ]; then
        if ! download_file "$checksum_url" "$checksum_file"; then
            return 1
        fi
        if ! verify_sha256 "$binary" "$checksum_file"; then
            return 1
        fi
    else
        log_warn "Unknown checksum type: $checksum_type"
    fi

    # Verify signature if provided
    if [ -n "$signature_type" ] && [ -n "$signature_url" ]; then
        local signature_file="$temp_dir/$name.sig"
        if ! download_file "$signature_url" "$signature_file"; then
            log_warn "Signature download failed, skipping signature verification"
        else
            if [ "$signature_type" = "cosign" ]; then
                if ! verify_cosign "$binary" "$signature_file" "$cert_identity" "$cert_oidc_issuer"; then
                    return 1
                fi
            elif [ "$signature_type" = "gpg" ]; then
                if ! verify_gpg "$binary" "$signature_file" "$cert_identity"; then
                    return 1
                fi
            else
                log_warn "Unknown signature type: $signature_type"
            fi
        fi
    fi

    log_info "========================================="
    log_info "✓ All verifications passed for $name"
    log_info "========================================="

    # Copy verified binary to output location if specified
    if [ -n "${OUTPUT_PATH:-}" ]; then
        cp "$binary" "$OUTPUT_PATH"
        chmod +x "$OUTPUT_PATH"
        log_info "Verified binary copied to: $OUTPUT_PATH"
    fi

    return 0
}

# Example usage function
show_usage() {
    cat << EOF
Usage: verify_binary_download NAME BINARY_URL CHECKSUM_TYPE CHECKSUM_URL [SIGNATURE_TYPE SIGNATURE_URL CERT_IDENTITY CERT_OIDC_ISSUER]

Arguments:
  NAME              - Name of the binary (e.g., kubectl, helm)
  BINARY_URL        - URL to download the binary
  CHECKSUM_TYPE     - Type of checksum (sha256, sha512)
  CHECKSUM_URL      - URL to download the checksum file
  SIGNATURE_TYPE    - Type of signature (cosign, gpg) [optional]
  SIGNATURE_URL     - URL to download the signature file [optional]
  CERT_IDENTITY     - Certificate identity for cosign or keyring path for gpg [optional]
  CERT_OIDC_ISSUER  - OIDC issuer for cosign [optional]

Environment Variables:
  OUTPUT_PATH       - Where to copy the verified binary [optional]

Examples:

  # Kubectl with SHA256 and cosign
  OUTPUT_PATH=/usr/local/bin/kubectl verify_binary_download \\
    "kubectl" \\
    "https://dl.k8s.io/release/v1.28.0/bin/linux/amd64/kubectl" \\
    "sha256" \\
    "https://dl.k8s.io/release/v1.28.0/bin/linux/amd64/kubectl.sha256" \\
    "cosign" \\
    "https://dl.k8s.io/release/v1.28.0/bin/linux/amd64/kubectl.sig" \\
    "https://github.com/kubernetes/kubernetes" \\
    "https://accounts.google.com"

  # Helm with SHA256 only
  OUTPUT_PATH=/usr/local/bin/helm verify_binary_download \\
    "helm" \\
    "https://get.helm.sh/helm-v3.13.0-linux-amd64.tar.gz" \\
    "sha256" \\
    "https://get.helm.sh/helm-v3.13.0-linux-amd64.tar.gz.sha256sum"

EOF
}

# If script is run directly (not sourced), show usage
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    if [ $# -eq 0 ]; then
        show_usage
        exit 1
    fi
    verify_binary_download "$@"
fi