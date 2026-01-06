#!/bin/bash
set -e

# CI/CD Test Script
# Exit code 0 = all tests pass
# Exit code 1 = any test fails

echo "=== CI/CD Test Suite ==="
echo ""

FAILURES=0

# Build all VMs
echo "Building VMs..."
if bash ~/vibecode-webgui/scripts/build-all-vms.sh; then
    echo "✓ Builds successful"
else
    echo "✗ Builds failed"
    FAILURES=$((FAILURES + 1))
fi

# Test all VMs
echo ""
echo "Testing VMs..."
if bash ~/vibecode-webgui/scripts/test-specialized-vms.sh; then
    echo "✓ Tests successful"
else
    echo "✗ Tests failed"
    FAILURES=$((FAILURES + 1))
fi

# Exit status
echo ""
if [ $FAILURES -eq 0 ]; then
    echo "=== ALL CHECKS PASSED ==="
    exit 0
else
    echo "=== $FAILURES CHECK(S) FAILED ==="
    exit 1
fi
