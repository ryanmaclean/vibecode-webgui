#!/bin/bash
# Agent 5: Create Security Configuration Files
set -e

echo "=== Agent 5: Creating Security Configurations ==="

# Check for entitlements file
ENTITLEMENTS="platforms/macos/vz-swift/entitlements.plist"
if [ ! -f "$ENTITLEMENTS" ]; then
    echo "Creating entitlements.plist..."
    cat > "$ENTITLEMENTS" << 'PLISTEOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.virtualization</key>
    <true/>
    <key>com.apple.security.cs.allow-jit</key>
    <true/>
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
    <true/>
    <key>com.apple.security.cs.disable-library-validation</key>
    <true/>
    <key>com.apple.security.network.client</key>
    <true/>
    <key>com.apple.security.network.server</key>
    <true/>
</dict>
</plist>
PLISTEOF
    echo "✅ Entitlements created"
else
    echo "✅ Entitlements already exist"
fi

# Create privacy manifest
PRIVACY="platforms/macos/vz-swift/PrivacyInfo.xcprivacy"
if [ ! -f "$PRIVACY" ]; then
    echo "Creating PrivacyInfo.xcprivacy..."
    cat > "$PRIVACY" << 'PRIVACYEOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>NSPrivacyTracking</key>
    <false/>
    <key>NSPrivacyTrackingDomains</key>
    <array/>
    <key>NSPrivacyCollectedDataTypes</key>
    <array/>
    <key>NSPrivacyAccessedAPITypes</key>
    <array>
        <dict>
            <key>NSPrivacyAccessedAPIType</key>
            <string>NSPrivacyAccessedAPICategoryFileTimestamp</string>
            <key>NSPrivacyAccessedAPITypeReasons</key>
            <array>
                <string>C617.1</string>
            </array>
        </dict>
    </array>
</dict>
</plist>
PRIVACYEOF
    echo "✅ Privacy manifest created"
else
    echo "✅ Privacy manifest already exists"
fi

echo ""
echo "✅ Security configurations created"
echo "Files:"
echo "  - $ENTITLEMENTS"
echo "  - $PRIVACY"
