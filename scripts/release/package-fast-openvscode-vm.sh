#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
VM_DIR="$ROOT_DIR/fast-openvscode-vm"
DIST_DIR="$ROOT_DIR/dist"
TIMESTAMP=$(date -u +%Y%m%dT%H%M%SZ)
OUTPUT="$DIST_DIR/fast-openvscode-vm-$TIMESTAMP.tar.gz"
SHA_OUTPUT="$OUTPUT.sha256"

if [[ ! -d "$VM_DIR" ]]; then
  echo "error: fast-openvscode-vm directory not found" >&2
  exit 1
fi

mkdir -p "$DIST_DIR"

echo "Packaging fast-openvscode-vm into $OUTPUT"

tar -C "$ROOT_DIR" -czf "$OUTPUT" fast-openvscode-vm

sha256sum "$OUTPUT" > "$SHA_OUTPUT"

echo "Created archive: $OUTPUT"
echo "SHA256:"
cat "$SHA_OUTPUT"
