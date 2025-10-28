#!/usr/bin/env bash
set -euo pipefail

# CI helper: package microVM artifacts and capture readiness metrics for each arch.
# Usage:
#   scripts/ci/package_microvm.sh [iterations]
# Environment:
#   MICROVM_CI_ARCHES   comma-separated list of arches (default: x86_64,arm64)
#   MICROVM_CI_OUTPUT   directory for JSON metrics (default: reports/benchmarks)
#   MICROVM_DIR_X86     optional override for x86_64 tree (default: fast-openvscode-vm)
#   MICROVM_DIR_ARM64   optional override for arm64 tree (default: fast-openvscode-vm-arm64)
#   MICROVM_SKIP_MEASURE if set, packaging runs without benchmarks (useful for dry runs)

ITERATIONS=${1:-3}
ARCHES=${MICROVM_CI_ARCHES:-x86_64,arm64}
OUTPUT_ROOT=${MICROVM_CI_OUTPUT:-reports/benchmarks}
TIMESTAMP=$(date -u +%Y%m%dT%H%M%SZ)
mkdir -p "$OUTPUT_ROOT"

log() {
  printf '[microvm-ci] %s\n' "$*"
}

# helper to run benchmark and save JSON
measure_arch() {
  local arch=$1
  local outfile=$2

  if [[ -n ${MICROVM_SKIP_MEASURE:-} ]]; then
    log "Skipping benchmark for $arch (MICROVM_SKIP_MEASURE set)"
    return
  fi

  log "Benchmarking $arch (iterations=$ITERATIONS)"
  if ! MICROVM_ARCH="$arch" scripts/benchmarks/vscode_microvm.sh measure "$ITERATIONS" >"$outfile"; then
    log "Warning: benchmark for $arch failed; leaving empty JSON"
    echo '{}' >"$outfile"
  fi
}

# helper to package directory
package_dir() {
  local dir=$1
  log "Packaging $dir"
  scripts/release/package-fast-openvscode-vm.sh "$dir"
}

IFS=',' read -r -a arch_list <<<"$ARCHES"

for arch in "${arch_list[@]}"; do
  case "$arch" in
    x86_64)
      DIR=${MICROVM_DIR_X86:-fast-openvscode-vm}
      PORT=3600
      ;;
    arm64)
      DIR=${MICROVM_DIR_ARM64:-fast-openvscode-vm-arm64}
      PORT=4600
      ;;
    *)
      log "Unknown arch $arch – skipping"
      continue
      ;;
  esac

  if [[ ! -d "$DIR" ]]; then
    log "Directory $DIR not found; skipping $arch"
    continue
  fi

  measure_arch "$arch" "$OUTPUT_ROOT/microvm-${arch}-${TIMESTAMP}.json"
  package_dir "$DIR"

  log "Completed $arch (JSON + tarballs in dist/)"
  log "Endpoints: http://127.0.0.1:${PORT}/healthz during benchmark"

done
