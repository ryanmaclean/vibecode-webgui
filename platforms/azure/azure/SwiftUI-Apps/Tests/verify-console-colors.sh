#!/bin/bash
#
# verify-console-colors.sh
# CRITICAL TEST: Verify console colors are green on black
#
# This test MUST pass before any commit that touches UnifiedServicesVibeCodeApp.swift
# Console colors are a NON-NEGOTIABLE user requirement
#

set -e

SOURCE_FILE="../Apps/UnifiedServicesVibeCodeApp/UnifiedServicesVibeCodeApp.swift"

echo "========================================"
echo "  Console Color Verification Test"
echo "========================================"
echo ""
echo "Verifying: $SOURCE_FILE"
echo ""

# Check if file exists
if [ ! -f "$SOURCE_FILE" ]; then
    echo "❌ CRITICAL FAILURE: Source file not found!"
    echo "   Expected: $SOURCE_FILE"
    exit 1
fi

# Test 1: Verify green text color is present
echo "Test 1: Checking for green text color..."
if grep -q "foregroundColor(Color(red: 0, green: 1, blue: 0))" "$SOURCE_FILE"; then
    echo "✅ PASS: Green text color found (RGB: 0, 1, 0)"
else
    echo "❌ CRITICAL FAILURE: Green text color NOT found!"
    echo ""
    echo "Console MUST have green text: RGB(0, 1, 0) / #00FF00"
    echo "Expected: .foregroundColor(Color(red: 0, green: 1, blue: 0))"
    echo ""
    echo "This is a USER REQUIREMENT and must NEVER be reverted."
    echo "See: CONSOLE_COLOR_REQUIREMENT.md"
    exit 1
fi

# Test 2: Verify black background is present
echo "Test 2: Checking for black background..."
if grep -q ".background(Color.black)" "$SOURCE_FILE"; then
    echo "✅ PASS: Black background found"
else
    echo "❌ CRITICAL FAILURE: Black background NOT found!"
    echo ""
    echo "Console MUST have black background: RGB(0, 0, 0) / #000000"
    echo "Expected: .background(Color.black)"
    echo ""
    echo "This is a USER REQUIREMENT and must NEVER be reverted."
    echo "See: CONSOLE_COLOR_REQUIREMENT.md"
    exit 1
fi

# Test 3: Verify system colors are NOT being used for console
echo "Test 3: Checking that system colors are NOT used..."
if grep -A5 "// Console output" "$SOURCE_FILE" | grep -A10 "ScrollView {" | grep -q "NSColor.textBackgroundColor"; then
    echo "❌ CRITICAL FAILURE: System background color detected in console!"
    echo ""
    echo "Console must NOT use NSColor.textBackgroundColor (white)."
    echo "Console MUST use Color.black explicitly."
    echo ""
    echo "This is a USER REQUIREMENT and must NEVER be reverted."
    echo "See: CONSOLE_COLOR_REQUIREMENT.md"
    exit 1
else
    echo "✅ PASS: System colors not used for console"
fi

# Test 4: Verify documentation comments are present
echo "Test 4: Checking for warning comments..."
if grep -q "DO NOT CHANGE" "$SOURCE_FILE" && grep -q "CRITICAL" "$SOURCE_FILE"; then
    echo "✅ PASS: Warning comments present"
else
    echo "⚠️  WARNING: Missing warning comments in code"
    echo "   Consider adding comments to prevent accidental changes"
fi

echo ""
echo "========================================"
echo "  ✅ ALL TESTS PASSED"
echo "========================================"
echo ""
echo "Console colors correctly configured:"
echo "  • Green text: RGB(0, 1, 0) / #00FF00"
echo "  • Black background: RGB(0, 0, 0) / #000000"
echo ""
echo "DO NOT REVERT THESE COLORS"
echo ""
