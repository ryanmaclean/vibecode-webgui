#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
DIST_DIR="$ROOT_DIR/dist"
ASSET_DIR="$ROOT_DIR/vm-assets"
TIMESTAMP=$(date -u +%Y%m%dT%H%M%SZ)
ARCHIVE="$DIST_DIR/ide-benchmarks-$TIMESTAMP.tar.gz"
SHA="$ARCHIVE.sha256"

mkdir -p "$DIST_DIR"
TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

mkdir -p "$TMPDIR/config" "$TMPDIR/results"

# Copy Lima config and sample seed files if present
cp "$ASSET_DIR/ide-lima.yaml" "$TMPDIR/config/"
if [[ -f "$ASSET_DIR/aegis/user-data" ]]; then
  mkdir -p "$TMPDIR/config/aegis"
  cp "$ASSET_DIR/aegis/user-data" "$ASSET_DIR/aegis/meta-data" "$TMPDIR/config/aegis/" || true
fi

# Copy recent benchmark outputs if they exist
if [[ -f /tmp/vim-lima.json ]]; then
  cp /tmp/vim-lima.json "$TMPDIR/results/vim-lima.json"
fi
if [[ -f /tmp/vim-bench.json ]]; then
  cp /tmp/vim-bench.json "$TMPDIR/results/vim-bench.json"
fi

cat > "$TMPDIR/README.md" <<'DOC'
# IDE Virtualization Benchmarks

This package contains configuration and measurement artifacts for the Lima and Colima fast-IDE experiments on Intel macOS (October 2, 2025).

## Contents

- `config/ide-lima.yaml` – Lima instance definition (Alpine, no containerd, vim preinstalled).
- `config/aegis/` – (optional) cloud-init user/meta-data used by the secure QEMU prototype.
- `results/vim-lima.json` – Vim launch timings (native vs. Lima variants) from `scripts/benchmarks/vim_hypervisor_bench.py`.
- `results/vim-bench.json` – Previous QEMU timings (if available).

## Reproduction Notes

1. `limactl create --name ide-lima config/ide-lima.yaml`
2. `limactl start ide-lima`
3. `scripts/benchmarks/vim_hypervisor_bench.py --runs 3 --output results.json`
4. `colima start --cpu 2 --memory 4 --disk 20`
5. `docker run -d -p 127.0.0.1:24444:8080 codercom/code-server:latest --auth none --disable-telemetry`

Adjust DNS to Quad9 (`9.9.9.9`) for best performance.
DOC

# Create archive and checksum
tar -C "$TMPDIR" -czf "$ARCHIVE" .
shasum -a 256 "$ARCHIVE" > "$SHA"

echo "Created $ARCHIVE"
cat "$SHA"
