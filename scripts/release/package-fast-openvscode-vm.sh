#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
TARGET_DIR=${1:-fast-openvscode-vm}
VM_DIR="$ROOT_DIR/$TARGET_DIR"
DIST_DIR="$ROOT_DIR/dist"
TIMESTAMP=$(date -u +%Y%m%dT%H%M%SZ)
OUTPUT="$DIST_DIR/${TARGET_DIR}-$TIMESTAMP.tar.gz"
SHA_OUTPUT="$OUTPUT.sha256"
EXCLUDES=(
  "--exclude=${TARGET_DIR}/downloads/*.tar.gz"
  "--exclude=${TARGET_DIR}/downloads/*.zip"
  "--exclude=${TARGET_DIR}/openvscode-initramfs.cpio.gz.bak"
  "--exclude=${TARGET_DIR}/qemu.log"
  "--exclude=${TARGET_DIR}/qemu-console.log"
  "--exclude=${TARGET_DIR}/qemu-test.log"
  "--exclude=${TARGET_DIR}/.microvm.pid"
  "--exclude=${TARGET_DIR}/gvproxy.log"
  "--exclude=${TARGET_DIR}/gvproxy.pid"
  "--exclude=${TARGET_DIR}/gvproxy.sock"
  "--exclude=${TARGET_DIR}/gvproxy-api.sock"
)

if [[ ! -d "$VM_DIR" ]]; then
  echo "error: fast-openvscode-vm directory not found" >&2
  exit 1
fi

mkdir -p "$DIST_DIR"

echo "Packaging ${TARGET_DIR} into $OUTPUT"

tar -C "$ROOT_DIR" -czf "$OUTPUT" "${EXCLUDES[@]}" "$TARGET_DIR"

if command -v sha256sum >/dev/null 2>&1; then
  sha256sum "$OUTPUT" > "$SHA_OUTPUT"
else
  shasum -a 256 "$OUTPUT" > "$SHA_OUTPUT"
fi

echo "Created archive: $OUTPUT"
echo "SHA256:"
cat "$SHA_OUTPUT"
