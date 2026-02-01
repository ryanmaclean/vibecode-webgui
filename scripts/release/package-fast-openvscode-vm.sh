#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
TARGET_DIR=${1:-fast-openvscode-vm}
VM_DIR="$ROOT_DIR/$TARGET_DIR"
DIST_DIR="$ROOT_DIR/dist"
TIMESTAMP=$(date -u +%Y%m%dT%H%M%SZ)

# Handle nested paths in archive name (bench-images/apple-vf-fastboot -> apple-vf-fastboot)
ARCHIVE_NAME=$(basename "$TARGET_DIR")
OUTPUT="$DIST_DIR/${ARCHIVE_NAME}-$TIMESTAMP.tar.gz"
SHA_OUTPUT="$OUTPUT.sha256"

# Common excludes for all VM types
EXCLUDES=(
  "--exclude=${TARGET_DIR}/downloads/*.tar.gz"
  "--exclude=${TARGET_DIR}/downloads/*.zip"
  "--exclude=${TARGET_DIR}/openvscode-initramfs.cpio.gz.bak"
  "--exclude=${TARGET_DIR}/qemu.log"
  "--exclude=${TARGET_DIR}/qemu-console.log"
  "--exclude=${TARGET_DIR}/qemu-test.log"
  "--exclude=${TARGET_DIR}/.microvm.pid"
  # Apple VF specific excludes
  "--exclude=${TARGET_DIR}/console.log"
  "--exclude=${TARGET_DIR}/.vm.pid"
  "--exclude=${TARGET_DIR}/gvproxy.log"
  "--exclude=${TARGET_DIR}/gvproxy.sock"
  "--exclude=${TARGET_DIR}/gvproxy-api.sock"
  "--exclude=${TARGET_DIR}/gvproxy.pid"
  "--exclude=${TARGET_DIR}/linux-*.tar.xz"
  "--exclude=${TARGET_DIR}/linux-[0-9]*"
)

if [[ ! -d "$VM_DIR" ]]; then
  echo "error: directory '$TARGET_DIR' not found at $VM_DIR" >&2
  echo ""
  echo "Usage: $0 [target-dir]"
  echo ""
  echo "Supported targets:"
  echo "  fast-openvscode-vm           - x86_64 OpenVSCode VM"
  echo "  fast-openvscode-vm-arm64     - arm64 OpenVSCode VM"
  echo "  bench-images/apple-vf-fastboot - Apple VF fast boot artifacts"
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
