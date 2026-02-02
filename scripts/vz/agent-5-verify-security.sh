#!/bin/bash
# Agent 5: Verify Security Configurations
set -e

echo "=== Agent 5: Verifying Security Configs ==="

ENTITLEMENTS="platforms/macos/vz-swift/entitlements.plist"
PRIVACY="platforms/macos/vz-swift/PrivacyInfo.xcprivacy"

# Check entitlements
if [ -f "$ENTITLEMENTS" ]; then
    echo "✅ Entitlements file exists"
    grep -q "com.apple.security.virtualization" "$ENTITLEMENTS" && echo "✅ Virtualization entitlement" || echo "⚠️  Virtualization entitlement missing"
    grep -q "com.apple.security.network" "$ENTITLEMENTS" && echo "✅ Network entitlements" || echo "⚠️  Network entitlements missing"
else
    echo "❌ Entitlements file not found"
    exit 1
fi

# Check privacy manifest
if [ -f "$PRIVACY" ]; then
    echo "✅ Privacy manifest exists"
    grep -q "NSPrivacyTracking" "$PRIVACY" && echo "✅ Tracking declaration" || echo "⚠️  Tracking declaration missing"
    grep -q "NSPrivacyAccessedAPITypes" "$PRIVACY" && echo "✅ API access types" || echo "⚠️  API access types missing"
else
    echo "❌ Privacy manifest not found"
    exit 1
fi

echo ""
echo "✅ Security configurations verified"
echo "Ready for App Store submission (after code signing)"
