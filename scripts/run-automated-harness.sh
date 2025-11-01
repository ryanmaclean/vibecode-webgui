#!/bin/bash
# Run the Swift-based automated VM test harness
# This compiles and executes the standalone test program

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "Compiling automated test harness..."
swiftc \
    -framework Virtualization \
    -o /tmp/vm-test-harness \
    "$PROJECT_ROOT/VibeCodeSwift/Tests/AutomatedVMHarness.swift"

echo "Running harness..."
echo ""

/tmp/vm-test-harness

echo ""
echo "Cleaning up..."
rm -f /tmp/vm-test-harness

