#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
VM_DIR="$ROOT_DIR/fast-openvscode-vm"
VERSION=${1:-5.10.201}
FIRECRACKER_RELEASE=${FIRECRACKER_RELEASE:-v1.7.0}
OUTPUT="$VM_DIR/vmlinux-fast"
TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

URL="https://github.com/firecracker-microvm/firecracker/releases/download/${FIRECRACKER_RELEASE}/vmlinux-${VERSION}"

mkdir -p "$VM_DIR"

echo "Downloading Firecracker kernel ${VERSION} from ${URL}" >&2
if ! curl -L --fail --silent --show-error "$URL" -o "$TMPDIR/vmlinux"; then
  cat <<MSG >&2
error: unable to download vmlinux from Firecracker release ${FIRECRACKER_RELEASE}.
Firecracker stopped publishing prebuilt kernels; run their resources/kernel
build scripts or update FIRECRACKER_RELEASE/URL to a mirror that hosts the
desired artefact. The OpenVSCode microVM will continue using vmlinuz-host.
MSG
  exit 1
fi

chmod +x "$TMPDIR/vmlinux"
mv "$TMPDIR/vmlinux" "$OUTPUT"

echo "Kernel written to $OUTPUT"
