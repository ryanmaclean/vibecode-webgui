#!/bin/bash
# Build UnifiedServicesVibeCode app with port 8080 forwarding support

set -e

echo "Building UnifiedServicesVibeCode app..."

cd ~/vibecode-webgui/azure/SwiftUI-Apps

# Compile the app
swiftc \
    -o UnifiedServicesVibeCodeApp \
    -sdk /Applications/Xcode.app/Contents/Developer/Platforms/MacOSX.platform/Developer/SDKs/MacOSX.sdk \
    -target arm64-apple-macosx13.0 \
    -framework SwiftUI \
    -framework Virtualization \
    -framework Network \
    Apps/UnifiedServicesVibeCodeApp/UnifiedServicesVibeCodeApp.swift \
    Apps/UnifiedServicesVibeCodeApp/UnifiedServicesVMManager.swift \
    Shared/Core/BaseVMManager.swift \
    Shared/Core/VMLogger.swift \
    Shared/Core/PTYManager.swift \
    Shared/Networking/NetworkingStrategy.swift \
    Shared/Networking/NATNetworkStrategy.swift \
    Shared/Networking/VsockProxyServer.swift \
    Shared/Networking/ProxyConnection.swift \
    Shared/Networking/DHCPLeaseMonitor.swift \
    DHCPLeaseParser.swift

echo "Creating app bundle..."

# Create app bundle structure
APP_NAME="UnifiedServicesVibeCode"
APP_DIR="$APP_NAME.app/Contents"
rm -rf "$APP_NAME.app"
mkdir -p "$APP_DIR/MacOS"
mkdir -p "$APP_DIR/Resources"

# Move binary
mv UnifiedServicesVibeCodeApp "$APP_DIR/MacOS/$APP_NAME"

# Create Info.plist
cat > "$APP_DIR/Info.plist" << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>UnifiedServicesVibeCode</string>
    <key>CFBundleIdentifier</key>
    <string>com.vibecode.unified</string>
    <key>CFBundleName</key>
    <string>UnifiedServicesVibeCode</string>
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

# Copy VM resources
echo "Copying VM resources..."
cp /tmp/vmlinux-raw "$APP_DIR/Resources/" || echo "Warning: vmlinux-raw not found"
cp /tmp/unified-vm-initramfs.cpio.gz "$APP_DIR/Resources/" || echo "Warning: unified-vm-initramfs.cpio.gz not found"

echo "App bundle created: $APP_NAME.app"
echo "Launch with: open $APP_NAME.app"
