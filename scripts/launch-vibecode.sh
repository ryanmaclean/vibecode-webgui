#!/bin/bash
# Launch VibeCode native macOS app

set -e

cd "$(dirname "$0")/../VibeCodeSwift"

echo "🔨 Building VibeCode..."
swift build -c debug

echo "📦 Creating app bundle..."
rm -rf .build/debug/VibeCode.app

mkdir -p .build/debug/VibeCode.app/Contents/MacOS
mkdir -p .build/debug/VibeCode.app/Contents/Resources

cp .build/debug/VibeCode .build/debug/VibeCode.app/Contents/MacOS/VibeCode

cat > .build/debug/VibeCode.app/Contents/Info.plist << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>VibeCode</string>
    <key>CFBundleIdentifier</key>
    <string>com.vibecode.app</string>
    <key>CFBundleName</key>
    <string>VibeCode</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0</string>
    <key>CFBundleVersion</key>
    <string>1</string>
    <key>LSMinimumSystemVersion</key>
    <string>13.0</string>
    <key>NSHighResolutionCapable</key>
    <true/>
</dict>
</plist>
EOF

echo "Signing app with entitlements..."
codesign --force --sign - --entitlements VibeCode.entitlements .build/debug/VibeCode.app/Contents/MacOS/VibeCode

echo "Verifying signature..."
codesign -d --entitlements - .build/debug/VibeCode.app 2>&1 | grep "com.apple.security.virtualization" > /dev/null
if [ $? -eq 0 ]; then
    echo "Entitlements verified"
else
    echo "ERROR: Entitlements not applied"
    exit 1
fi

echo "Launching VibeCode..."
open .build/debug/VibeCode.app

echo ""
echo "✅ VibeCode launched successfully!"
echo ""
echo "📋 Features:"
echo "  - 6 VMs loaded from: dist/vm-images/"
echo "  - Nodejs-Codeserver VM auto-starts in ~5 seconds"
echo "  - Click any VM to see details and start/stop"
echo ""
echo "📊 Logs: /Users/ryan.maclean/vibecode-webgui/logs/vibecode.log"

