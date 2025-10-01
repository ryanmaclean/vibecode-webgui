#!/usr/bin/env bash
#
# verify-tool-download.sh - Shared helper for checksum/signature verification of CLI tool downloads
# Usage: verify-tool-download.sh <tool-name> <url> <output-path> <checksum-url> [sig-url]
#
# Validates downloaded binaries/archives against official checksums before installation.
# Exits non-zero if verification fails to ensure Docker builds fail closed.
#

set -euo pipefail

TOOL_NAME="${1:-}"
DOWNLOAD_URL="${2:-}"
OUTPUT_PATH="${3:-}"
CHECKSUM_URL="${4:-}"
SIG_URL="${5:-}"

if [[ -z "$TOOL_NAME" ]] || [[ -z "$DOWNLOAD_URL" ]] || [[ -z "$OUTPUT_PATH" ]] || [[ -z "$CHECKSUM_URL" ]]; then
  echo "ERROR: Missing required parameters"
  echo "Usage: verify-tool-download.sh <tool-name> <url> <output-path> <checksum-url> [sig-url]"
  exit 1
fi

echo "🔒 Verifying ${TOOL_NAME} download..."

# Download the tool to a temporary location first
TEMP_DIR=$(mktemp -d)
trap 'rm -rf "${TEMP_DIR}"' EXIT

TEMP_FILE="${TEMP_DIR}/$(basename "${OUTPUT_PATH}")"
CHECKSUM_FILE="${TEMP_DIR}/checksum"

# Download binary/archive
echo "  📥 Downloading ${TOOL_NAME} from ${DOWNLOAD_URL}..."
curl -fsSL "${DOWNLOAD_URL}" -o "${TEMP_FILE}"

# Download checksum
echo "  📥 Downloading checksum from ${CHECKSUM_URL}..."
curl -fsSL "${CHECKSUM_URL}" -o "${CHECKSUM_FILE}"

# Verify checksum
echo "  🔍 Verifying checksum..."
(
  cd "${TEMP_DIR}"
  # Handle different checksum file formats
  if grep -q "$(basename "${OUTPUT_PATH}")" "${CHECKSUM_FILE}"; then
    # Checksum file contains filename, use sha256sum -c
    grep "$(basename "${OUTPUT_PATH}")" "${CHECKSUM_FILE}" | sha256sum -c -
  else
    # Checksum file is just the hash, verify manually
    EXPECTED_HASH=$(cat "${CHECKSUM_FILE}" | tr -d '[:space:]')
    ACTUAL_HASH=$(sha256sum "$(basename "${OUTPUT_PATH}")" | awk '{print $1}')
    if [[ "${EXPECTED_HASH}" != "${ACTUAL_HASH}" ]]; then
      echo "ERROR: Checksum mismatch for ${TOOL_NAME}"
      echo "  Expected: ${EXPECTED_HASH}"
      echo "  Actual:   ${ACTUAL_HASH}"
      exit 1
    fi
    echo "$(basename "${OUTPUT_PATH}"): OK"
  fi
)

# Optional: Verify signature if provided
if [[ -n "${SIG_URL}" ]]; then
  echo "  🔐 Signature verification URL provided: ${SIG_URL}"
  echo "  ⚠️  Signature verification not yet implemented (requires cosign setup)"
  # TODO: Implement cosign verification when available
  # curl -fsSL "${SIG_URL}" -o "${TEMP_DIR}/signature"
  # cosign verify-blob --signature "${TEMP_DIR}/signature" --certificate-identity "..." "${TEMP_FILE}"
fi

# Copy verified file to final destination
echo "  ✅ Checksum verified! Installing to ${OUTPUT_PATH}..."
cp "${TEMP_FILE}" "${OUTPUT_PATH}"

echo "✅ ${TOOL_NAME} verification complete"
