#!/bin/bash

# Master Specialized VM Test Script
# Tests all specialized VMs (Valkey, PostgreSQL, Unified) and generates comprehensive report

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=== Testing All Specialized VMs ==="
echo ""

# Test Valkey
echo "1. Testing Valkey VM..."
if [ -f "$SCRIPT_DIR/test-valkey-vm.sh" ]; then
    bash "$SCRIPT_DIR/test-valkey-vm.sh"
    VALKEY_RESULT=$?
else
    echo "WARNING: test-valkey-vm.sh not found"
    VALKEY_RESULT=1
fi

# Test PostgreSQL
echo ""
echo "2. Testing PostgreSQL VM..."
if [ -f "$SCRIPT_DIR/test-postgresql-vm.sh" ]; then
    bash "$SCRIPT_DIR/test-postgresql-vm.sh"
    PG_RESULT=$?
else
    echo "WARNING: test-postgresql-vm.sh not found"
    PG_RESULT=1
fi

# Test Unified
echo ""
echo "3. Testing Unified VM..."
if [ -f "$SCRIPT_DIR/test-unified-vm.sh" ]; then
    bash "$SCRIPT_DIR/test-unified-vm.sh"
    UNIFIED_RESULT=$?
else
    echo "WARNING: test-unified-vm.sh not found"
    UNIFIED_RESULT=1
fi

# Summary
echo ""
echo "=== Test Summary ==="
if [ $VALKEY_RESULT -eq 0 ]; then
    echo "Valkey: PASS"
else
    echo "Valkey: FAIL"
fi

if [ $PG_RESULT -eq 0 ]; then
    echo "PostgreSQL: PASS"
else
    echo "PostgreSQL: FAIL"
fi

if [ $UNIFIED_RESULT -eq 0 ]; then
    echo "Unified: PASS"
else
    echo "Unified: FAIL"
fi

exit 0
