#!/usr/bin/env bash
# Quick validation test for musl builds
# Tests BusyBox binary functionality and Docker image builds

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "[$(date +'%H:%M:%S')] $*"; }
success() { echo -e "${GREEN}✓${NC} $*"; }
error() { echo -e "${RED}✗${NC} $*"; }
warn() { echo -e "${YELLOW}⚠${NC} $*"; }

TESTS_PASSED=0
TESTS_FAILED=0

run_test() {
    local test_name=$1
    shift
    log "Testing: $test_name"

    if "$@"; then
        success "$test_name"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        error "$test_name FAILED"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

cd "$PROJECT_ROOT"

log "═══════════════════════════════════════════════════════"
log "Musl Build Validation Tests"
log "═══════════════════════════════════════════════════════"
echo ""

# Test 1: Check if build scripts exist
run_test "Build scripts exist" test -f scripts/benchmarks/build-busybox-musl.sh
run_test "Docker comparison script exists" test -f scripts/benchmarks/docker-musl-vs-glibc.sh
run_test "Scripts are executable" test -x scripts/benchmarks/build-busybox-musl.sh

# Test 2: Check for BusyBox binary
if [ -d "bench-images/busybox" ]; then
    BUSYBOX_BIN=$(find bench-images/busybox -name "busybox-*-musl-*" -type f ! -name "*.json" ! -name "*.gz" 2>/dev/null | head -1)

    if [ -n "$BUSYBOX_BIN" ] && [ -f "$BUSYBOX_BIN" ]; then
        success "Found BusyBox binary: $BUSYBOX_BIN"

        # Test 3: Verify it's executable
        run_test "BusyBox is executable" test -x "$BUSYBOX_BIN"

        # Test 4: Test basic commands
        run_test "BusyBox --help" "$BUSYBOX_BIN" --help >/dev/null 2>&1
        run_test "BusyBox echo" bash -c "$BUSYBOX_BIN echo 'test' | grep -q 'test'"
        run_test "BusyBox ls" "$BUSYBOX_BIN" ls /tmp >/dev/null 2>&1

        # Test 5: Check static linking
        if file "$BUSYBOX_BIN" | grep -q "statically linked"; then
            success "BusyBox is statically linked"
            TESTS_PASSED=$((TESTS_PASSED + 1))
        else
            warn "BusyBox is NOT statically linked"
            file "$BUSYBOX_BIN"
            TESTS_FAILED=$((TESTS_FAILED + 1))
        fi

        # Test 6: Check size
        SIZE=$(stat -f%z "$BUSYBOX_BIN" 2>/dev/null || stat -c%s "$BUSYBOX_BIN")
        SIZE_MB=$(echo "scale=2; $SIZE / 1024 / 1024" | bc)

        if (( $(echo "$SIZE_MB < 3" | bc -l) )); then
            success "BusyBox size is optimal: ${SIZE_MB}MB"
            TESTS_PASSED=$((TESTS_PASSED + 1))
        else
            warn "BusyBox size is larger than expected: ${SIZE_MB}MB"
            TESTS_FAILED=$((TESTS_FAILED + 1))
        fi

        # Test 7: Check metadata
        METADATA=$(find bench-images/busybox -name "*.json" -type f | tail -1)
        if [ -n "$METADATA" ] && [ -f "$METADATA" ]; then
            run_test "Metadata JSON is valid" jq empty "$METADATA"
            success "Metadata found: $METADATA"
        else
            error "No metadata JSON found"
            TESTS_FAILED=$((TESTS_FAILED + 1))
        fi

        # Test 8: Check initramfs
        INITRAMFS=$(find bench-images/busybox -name "*initramfs*.cpio.gz" | tail -1)
        if [ -n "$INITRAMFS" ] && [ -f "$INITRAMFS" ]; then
            success "Initramfs found: $INITRAMFS"
            INITRAMFS_SIZE=$(stat -f%z "$INITRAMFS" 2>/dev/null || stat -c%s "$INITRAMFS")
            INITRAMFS_MB=$(echo "scale=2; $INITRAMFS_SIZE / 1024 / 1024" | bc)
            log "Initramfs size: ${INITRAMFS_MB}MB"

            # Verify it's a valid gzip archive
            run_test "Initramfs is valid gzip" gzip -t "$INITRAMFS"

            TESTS_PASSED=$((TESTS_PASSED + 1))
        else
            error "No initramfs found"
            TESTS_FAILED=$((TESTS_FAILED + 1))
        fi
    else
        error "No BusyBox binary found in bench-images/busybox"
        warn "Run: ./scripts/benchmarks/build-busybox-musl.sh"
        TESTS_FAILED=$((TESTS_FAILED + 5))
    fi
else
    error "bench-images/busybox directory not found"
    TESTS_FAILED=$((TESTS_FAILED + 5))
fi

# Test 9: Check Docker comparison results
if [ -d "performance-results/docker-builds" ]; then
    LATEST_RESULTS=$(find performance-results/docker-builds -name "musl-vs-glibc-*.json" | tail -1)

    if [ -n "$LATEST_RESULTS" ] && [ -f "$LATEST_RESULTS" ]; then
        success "Found Docker comparison results: $LATEST_RESULTS"

        run_test "Docker results JSON is valid" jq empty "$LATEST_RESULTS"

        # Check if both builds succeeded
        HAS_MUSL=$(jq -e '.builds.musl' "$LATEST_RESULTS" >/dev/null 2>&1 && echo "yes" || echo "no")
        HAS_GLIBC=$(jq -e '.builds.glibc' "$LATEST_RESULTS" >/dev/null 2>&1 && echo "yes" || echo "no")

        if [ "$HAS_MUSL" = "yes" ]; then
            success "musl build data present"
            TESTS_PASSED=$((TESTS_PASSED + 1))
        else
            warn "musl build data missing"
            TESTS_FAILED=$((TESTS_FAILED + 1))
        fi

        if [ "$HAS_GLIBC" = "yes" ]; then
            success "glibc build data present"
            TESTS_PASSED=$((TESTS_PASSED + 1))
        else
            warn "glibc build data missing (may be expected)"
        fi

        # Show comparison if available
        if [ "$HAS_MUSL" = "yes" ] && [ "$HAS_GLIBC" = "yes" ]; then
            echo ""
            log "Latest comparison results:"
            jq -r '.comparison' "$LATEST_RESULTS" 2>/dev/null || echo "No comparison data"
        fi
    else
        warn "No Docker comparison results found"
        warn "Run: ./scripts/benchmarks/docker-musl-vs-glibc.sh"
    fi
else
    warn "performance-results/docker-builds directory not found"
fi

# Summary
echo ""
log "═══════════════════════════════════════════════════════"
log "Test Summary"
log "═══════════════════════════════════════════════════════"
log "Tests passed: ${GREEN}${TESTS_PASSED}${NC}"
log "Tests failed: ${RED}${TESTS_FAILED}${NC}"

if [ $TESTS_FAILED -eq 0 ]; then
    echo ""
    success "All tests passed! 🎉"
    echo ""
    log "Next steps:"
    log "  1. Review build artifacts in bench-images/busybox/"
    log "  2. Run Docker comparison: ./scripts/benchmarks/docker-musl-vs-glibc.sh"
    log "  3. Push to trigger CI: git push origin main"
    log "  4. Check Datadog for metrics: https://app.datadoghq.com"
    exit 0
else
    echo ""
    error "${TESTS_FAILED} test(s) failed"
    echo ""
    log "To fix:"
    log "  1. Run BusyBox build: ./scripts/benchmarks/build-busybox-musl.sh"
    log "  2. Run Docker comparison: ./scripts/benchmarks/docker-musl-vs-glibc.sh"
    log "  3. Check build logs for errors"
    exit 1
fi
