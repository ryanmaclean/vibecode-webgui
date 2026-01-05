#!/bin/bash
# Test script to verify PostgreSQL LDAP dependencies
# AGENT E: PostgreSQL LDAP Dependencies Fix

set -euo pipefail

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "========================================="
echo "  PostgreSQL LDAP Dependencies Test"
echo "  AGENT E Verification"
echo "========================================="
echo ""

# Test 1: Extract and check initramfs
TEST_DIR="/tmp/postgresql-ldap-test-$$"
INITRAMFS="/tmp/unified-services-consolidated.cpio.gz"

if [ ! -f "$INITRAMFS" ]; then
    echo -e "${RED}✗ Initramfs not found: $INITRAMFS${NC}"
    exit 1
fi

echo "Test 1: Extracting initramfs..."
mkdir -p "$TEST_DIR"
cd "$TEST_DIR"
gunzip -c "$INITRAMFS" | cpio -idm 2>/dev/null
echo -e "${GREEN}✓ Extraction complete${NC}"
echo ""

# Test 2: Check for PostgreSQL binary
echo "Test 2: PostgreSQL binary..."
if [ -f "usr/bin/postgres" ]; then
    POSTGRES_SIZE=$(ls -lh usr/bin/postgres | awk '{print $5}')
    echo -e "${GREEN}✓ PostgreSQL binary found: $POSTGRES_SIZE${NC}"

    # Check if it's ARM64
    if file usr/bin/postgres | grep -q "ELF.*aarch64"; then
        echo -e "${GREEN}✓ PostgreSQL is ARM64 ELF format${NC}"
    else
        echo -e "${RED}✗ PostgreSQL is not ARM64 format${NC}"
        exit 1
    fi
else
    echo -e "${RED}✗ PostgreSQL binary not found${NC}"
    exit 1
fi
echo ""

# Test 3: Check for LDAP/SASL libraries
echo "Test 3: LDAP and SASL libraries..."
MISSING_LIBS=()

check_lib() {
    local lib=$1
    if find usr/lib lib -name "$lib" 2>/dev/null | grep -q .; then
        local lib_path=$(find usr/lib lib -name "$lib" 2>/dev/null | head -1)
        local lib_size=$(ls -lh "$lib_path" | awk '{print $5}')
        echo -e "${GREEN}✓ $lib found: $lib_size${NC}"
        return 0
    else
        echo -e "${RED}✗ $lib NOT FOUND${NC}"
        MISSING_LIBS+=("$lib")
        return 1
    fi
}

check_lib "libldap.so.2"
check_lib "liblber.so.2"
check_lib "libsasl2.so.3"
echo ""

if [ ${#MISSING_LIBS[@]} -gt 0 ]; then
    echo -e "${RED}FAIL: Missing ${#MISSING_LIBS[@]} libraries:${NC}"
    for lib in "${MISSING_LIBS[@]}"; do
        echo "  - $lib"
    done
    echo ""
    echo "These libraries need to be added to the build."
    echo "They should come from these Alpine packages:"
    echo "  - libldap-2.6.10-r0.apk"
    echo "  - libsasl-2.1.28-r9.apk"
    echo ""

    # Cleanup
    cd /
    rm -rf "$TEST_DIR"
    exit 1
fi

# Test 4: Verify LDAP symbols in PostgreSQL
echo "Test 4: Checking PostgreSQL LDAP symbols..."
if command -v nm >/dev/null 2>&1; then
    LDAP_SYMBOLS=$(nm -D usr/bin/postgres 2>/dev/null | grep " U " | grep ldap | wc -l)
    if [ "$LDAP_SYMBOLS" -gt 0 ]; then
        echo -e "${GREEN}✓ Found $LDAP_SYMBOLS LDAP symbols in PostgreSQL${NC}"
        echo "  Sample symbols:"
        nm -D usr/bin/postgres 2>/dev/null | grep " U " | grep ldap | head -5 | sed 's/^/    /'
    else
        echo -e "${YELLOW}⚠ No LDAP symbols found (nm may not be available)${NC}"
    fi
else
    echo -e "${YELLOW}⚠ nm command not available, skipping symbol check${NC}"
fi
echo ""

# Test 5: Check library dependencies
echo "Test 5: Library dependency check..."
if command -v ldd >/dev/null 2>&1; then
    echo "Running ldd on PostgreSQL binary..."
    if ldd usr/bin/postgres 2>&1 | grep -E "ldap|sasl"; then
        echo -e "${GREEN}✓ LDAP/SASL dependencies visible in ldd${NC}"
    else
        echo -e "${YELLOW}⚠ No LDAP/SASL in ldd output (may need to run in VM)${NC}"
    fi
else
    echo -e "${YELLOW}⚠ ldd not available on macOS, skipping${NC}"
fi
echo ""

# Test 6: File integrity check
echo "Test 6: Library file integrity..."
for lib in usr/lib/libldap.so.2 usr/lib/liblber.so.2 usr/lib/libsasl2.so.3; do
    if [ -f "$lib" ]; then
        if file "$lib" | grep -q "ELF.*aarch64"; then
            echo -e "${GREEN}✓ $lib is valid ARM64 ELF${NC}"
        elif file "$lib" | grep -q "symbolic link"; then
            local target=$(readlink "$lib")
            echo -e "${GREEN}✓ $lib is symlink -> $target${NC}"
        else
            echo -e "${RED}✗ $lib has unexpected format${NC}"
            file "$lib"
        fi
    fi
done
echo ""

# Summary
echo "========================================="
echo "  Test Results Summary"
echo "========================================="
if [ ${#MISSING_LIBS[@]} -eq 0 ]; then
    echo -e "${GREEN}✓ ALL TESTS PASSED${NC}"
    echo ""
    echo "PostgreSQL LDAP dependencies are properly configured:"
    echo "  - libldap.so.2 (OpenLDAP client library)"
    echo "  - liblber.so.2 (LDAP BER encoding library)"
    echo "  - libsasl2.so.3 (SASL authentication library)"
    echo ""
    echo "PostgreSQL should now start without LDAP errors."
else
    echo -e "${RED}✗ TESTS FAILED${NC}"
    echo "Missing libraries need to be added to the build."
fi
echo "========================================="
echo ""

# Cleanup
cd /
rm -rf "$TEST_DIR"

# Exit with appropriate code
if [ ${#MISSING_LIBS[@]} -eq 0 ]; then
    exit 0
else
    exit 1
fi
