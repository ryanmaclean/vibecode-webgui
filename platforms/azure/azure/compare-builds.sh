#!/bin/bash
# Compare original vs optimized build sizes

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${GREEN}[INFO]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ANALYSIS_DIR="/tmp/openvscode-comparison-$$"

log "=== OpenVSCode Build Size Comparison ==="
log ""

# Create analysis directory
mkdir -p "$ANALYSIS_DIR"

# Check if original exists
ORIGINAL="$SCRIPT_DIR/bun-openvscode.cpio.gz"
OPTIMIZED="$SCRIPT_DIR/slim-openvscode.cpio.xz"

if [ ! -f "$ORIGINAL" ]; then
    warn "Original build not found: $ORIGINAL"
    exit 1
fi

log "Original build: $ORIGINAL"
ORIGINAL_SIZE=$(du -h "$ORIGINAL" | cut -f1)
ORIGINAL_BYTES=$(stat -f%z "$ORIGINAL" 2>/dev/null || stat -c%s "$ORIGINAL")

log "Size: $ORIGINAL_SIZE ($ORIGINAL_BYTES bytes)"
log ""

# Extract and analyze original
log "Analyzing original build..."
cd "$ANALYSIS_DIR"
mkdir -p original
cd original
gunzip -c "$ORIGINAL" | cpio -idm 2>/dev/null

log "Directory sizes:"
du -sh * 2>/dev/null | sort -h

log ""
log "Library analysis:"
if [ -d "lib" ]; then
    echo "  Total libs: $(find lib -type f | wc -l)"
    echo "  glibc: $(find lib -name "*glibc*" -o -name "libc.so*" | wc -l)"
    echo "  musl: $(find lib -name "*musl*" | wc -l)"
    echo "  x86-64: $(find lib -name "*x86-64*" | wc -l)"
    echo "  apt: $(find lib -name "*apt*" | wc -l)"
    echo "  krb5: $(find lib -name "*krb5*" | wc -l)"
    echo "  gconv: $(du -sh lib/gconv 2>/dev/null || echo "  gconv: not found")"
fi

log ""
log "OpenVSCode analysis:"
if [ -d "opt/openvscode" ]; then
    echo "  Total size: $(du -sh opt/openvscode | cut -f1)"
    echo "  Node.js: $(du -sh opt/openvscode/node 2>/dev/null || echo "N/A")"
    echo "  Extensions: $(du -sh opt/openvscode/extensions 2>/dev/null | cut -f1)"
    echo "  node_modules: $(du -sh opt/openvscode/node_modules 2>/dev/null | cut -f1)"
    echo "  Source maps: $(find opt/openvscode -name "*.map" | wc -l)"
    echo "  Type defs: $(find opt/openvscode -name "*.d.ts" | wc -l)"
fi

log ""
log "Bun analysis:"
if [ -d "opt/bun-linux-aarch64" ]; then
    BUN_SIZE=$(du -sh opt/bun-linux-aarch64/bun 2>/dev/null | cut -f1)
    echo "  Bun binary: $BUN_SIZE"
    file opt/bun-linux-aarch64/bun | grep -q "not stripped" && echo "  Status: NOT stripped" || echo "  Status: stripped"
fi

# Check if optimized exists
if [ -f "$OPTIMIZED" ]; then
    log ""
    log "=== COMPARISON ==="
    OPTIMIZED_SIZE=$(du -h "$OPTIMIZED" | cut -f1)
    OPTIMIZED_BYTES=$(stat -f%z "$OPTIMIZED" 2>/dev/null || stat -c%s "$OPTIMIZED")

    echo ""
    echo "Original:  $ORIGINAL_SIZE ($ORIGINAL_BYTES bytes)"
    echo "Optimized: $OPTIMIZED_SIZE ($OPTIMIZED_BYTES bytes)"

    REDUCTION=$((ORIGINAL_BYTES - OPTIMIZED_BYTES))
    REDUCTION_MB=$((REDUCTION / 1024 / 1024))
    REDUCTION_PCT=$((REDUCTION * 100 / ORIGINAL_BYTES))

    echo ""
    echo -e "${GREEN}Reduction: ${REDUCTION_MB} MB (${REDUCTION_PCT}%)${NC}"
else
    log ""
    warn "Optimized build not found: $OPTIMIZED"
    warn "Run ./build-slim-openvscode.py to create it"
fi

# Cleanup
log ""
log "Cleaning up..."
rm -rf "$ANALYSIS_DIR"

log "Done!"
