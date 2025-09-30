#!/bin/bash

# CI Assertion Script: Prevent accidental reintroduction of stubs
# This script checks that production code doesn't contain stub implementations

set -e

echo "🔍 Checking for accidental stub reintroduction..."

FAILED=0

# Check if workspace-provisioning-simple.ts is imported in production code
echo "Checking for workspace-provisioning-simple imports..."
if grep -r "workspace-provisioning-simple" src/ --exclude-dir=__tests__ --include="*.ts" --include="*.tsx" 2>/dev/null; then
    echo "❌ Found workspace-provisioning-simple imports in production code!"
    FAILED=1
else
    echo "✅ No workspace-provisioning-simple imports found in production code"
fi

# Check if stub collaboration manager patterns exist in production code
echo "Checking for stub collaboration manager patterns..."
if grep -r "Improved stub" src/ --exclude-dir=__tests__ --include="*.ts" --include="*.tsx" 2>/dev/null; then
    echo "❌ Found stub collaboration manager patterns in production code!"
    FAILED=1
else
    echo "✅ No stub collaboration manager patterns found in production code"
fi

# Check if mock implementations are imported/instantiated in production code (not just mentioned in error messages)
echo "Checking for mock implementations in production imports..."
if grep -r "new MockWorkspaceProvisioningService\|import.*MockWorkspaceProvisioningService\|new MockCollaborationManager\|import.*MockCollaborationManager" src/ --exclude-dir=__tests__ --include="*.ts" --include="*.tsx" 2>/dev/null; then
    echo "❌ Found mock implementations imported in production code!"
    FAILED=1
else
    echo "✅ No mock implementations found in production imports"
fi

# Check that real implementations exist and are imported correctly
echo "Checking for real implementation imports..."
if ! grep -r "from.*workspace-provisioning'" src/ --include="*.ts" --include="*.tsx" 2>/dev/null; then
    echo "❌ Real workspace provisioning service not imported in production code!"
    FAILED=1
else
    echo "✅ Real workspace provisioning service imports found"
fi

if ! grep -r "from.*collaboration-manager'" src/ --include="*.ts" --include="*.tsx" 2>/dev/null; then
    echo "❌ Real collaboration manager not imported in production code!"
    FAILED=1
else
    echo "✅ Real collaboration manager imports found"
fi

# Check that stub files exist only in appropriate test locations
echo "Checking stub file locations..."
if find src/ -name "*-simple.ts" -type f | grep -v __tests__ | grep -v __mocks__; then
    echo "❌ Found stub files in production source locations!"
    FAILED=1
else
    echo "✅ No stub files found in production source locations"
fi

# Verify test mock files exist
echo "Checking test mock files exist..."
if [ ! -f "tests/__mocks__/workspace-provisioning.ts" ]; then
    echo "❌ Workspace provisioning mock not found!"
    FAILED=1
else
    echo "✅ Workspace provisioning mock exists"
fi

if [ ! -f "tests/__mocks__/collaboration-manager.ts" ]; then
    echo "❌ Collaboration manager mock not found!"
    FAILED=1
else
    echo "✅ Collaboration manager mock exists"
fi

if [ $FAILED -eq 1 ]; then
    echo ""
    echo "💥 CI Assertion Failed: Stub implementations detected in production code!"
    echo ""
    echo "To fix this issue:"
    echo "1. Remove any imports of workspace-provisioning-simple in production code"
    echo "2. Remove any embedded stub collaboration managers in production code"
    echo "3. Ensure only real implementations are imported in src/"
    echo "4. Use mock implementations only in tests/__mocks__/"
    echo ""
    echo "For testing, use the mock implementations:"
    echo "- tests/__mocks__/workspace-provisioning.ts"
    echo "- tests/__mocks__/collaboration-manager.ts"
    echo ""
    exit 1
else
    echo ""
    echo "✅ All CI assertions passed! No stub implementations found in production code."
    echo ""
fi