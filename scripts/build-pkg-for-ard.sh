#!/bin/bash

# VibeCode PKG Builder for Apple Remote Desktop (ARD)
# Creates proper .pkg installers for remote deployment

set -e

# Configuration
APP_NAME="VibeCode"
APP_VERSION="1.2.0"
PKG_ID="com.vibecode.app"
BUILD_DIR="pkg-build"
DIST_DIR="dist-pkg"

echo "🚀 Building VibeCode PKG installer for ARD deployment..."

# Clean and create directories
rm -rf "$BUILD_DIR" "$DIST_DIR"
mkdir -p "$BUILD_DIR" "$DIST_DIR"

# Copy the Universal2 app bundle
echo "📦 Copying Universal2 app bundle..."
cp -R "src-tauri/target/release/bundle/macos/VibeCode_universal.app" "$BUILD_DIR/VibeCode.app"

# Create package structure
echo "📁 Creating package structure..."
mkdir -p "$BUILD_DIR/Applications"
mv "$BUILD_DIR/VibeCode.app" "$BUILD_DIR/Applications/"

# Create component plist
echo "📋 Creating component plist..."
cat > "$BUILD_DIR/component.plist" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<array>
    <dict>
        <key>BundleHasStrictIdentifier</key>
        <true/>
        <key>BundleIsRelocatable</key>
        <false/>
        <key>BundleIsVersionChecked</key>
        <true/>
        <key>BundleOverwriteAction</key>
        <string>upgrade</string>
        <key>RootRelativeBundlePath</key>
        <string>Applications/VibeCode.app</string>
    </dict>
</array>
</plist>
EOF

# Create distribution plist
echo "📋 Creating distribution plist..."
cat > "$BUILD_DIR/distribution.plist" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>identifier</key>
    <string>$PKG_ID</string>
    <key>version</key>
    <string>$APP_VERSION</string>
    <key>title</key>
    <string>$APP_NAME</string>
    <key>description</key>
    <string>VibeCode - AI-Powered Development Environment</string>
    <key>install-location</key>
    <string>/Applications</string>
    <key>domains</key>
    <array>
        <string>system</string>
    </array>
    <key>options</key>
    <dict>
        <key>hostArchitecturePriority</key>
        <array>
            <string>arm64</string>
            <string>x86_64</string>
        </array>
    </dict>
</dict>
</plist>
EOF

# Build the component package
echo "🔨 Building component package..."
pkgbuild \
    --root "$BUILD_DIR" \
    --component-plist "$BUILD_DIR/component.plist" \
    --identifier "$PKG_ID" \
    --version "$APP_VERSION" \
    --install-location "/" \
    "$DIST_DIR/VibeCode-$APP_VERSION-component.pkg"

# Build the distribution package
echo "🔨 Building distribution package..."
productbuild \
    --distribution "$BUILD_DIR/distribution.plist" \
    --package-path "$DIST_DIR" \
    --resources "$BUILD_DIR" \
    "$DIST_DIR/VibeCode-$APP_VERSION.pkg"

# Create installer script for ARD
echo "📜 Creating ARD installer script..."
cat > "$DIST_DIR/install-vibecode.sh" << 'EOF'
#!/bin/bash

# VibeCode ARD Installation Script
# Run this script on remote Macs via Apple Remote Desktop

set -e

PKG_FILE="VibeCode-1.2.0.pkg"
LOG_FILE="/tmp/vibecode-install.log"

echo "🚀 Installing VibeCode on $(hostname)..." | tee "$LOG_FILE"
echo "Date: $(date)" | tee -a "$LOG_FILE"
echo "User: $(whoami)" | tee -a "$LOG_FILE"
echo "OS: $(sw_vers -productName) $(sw_vers -productVersion)" | tee -a "$LOG_FILE"

# Check if PKG file exists
if [ ! -f "$PKG_FILE" ]; then
    echo "❌ Error: $PKG_FILE not found!" | tee -a "$LOG_FILE"
    exit 1
fi

# Install the package
echo "📦 Installing VibeCode package..." | tee -a "$LOG_FILE"
sudo installer -pkg "$PKG_FILE" -target / | tee -a "$LOG_FILE"

# Verify installation
if [ -d "/Applications/VibeCode.app" ]; then
    echo "✅ VibeCode installed successfully!" | tee -a "$LOG_FILE"
    echo "📍 Location: /Applications/VibeCode.app" | tee -a "$LOG_FILE"
    
    # Get app info
    APP_VERSION=$(defaults read /Applications/VibeCode.app/Contents/Info.plist CFBundleShortVersionString 2>/dev/null || echo "Unknown")
    echo "📋 Version: $APP_VERSION" | tee -a "$LOG_FILE"
    
    # Check architectures
    ARCHS=$(lipo -info /Applications/VibeCode.app/Contents/MacOS/vibecode 2>/dev/null || echo "Unknown")
    echo "🏗️  Architectures: $ARCHS" | tee -a "$LOG_FILE"
    
else
    echo "❌ Installation failed!" | tee -a "$LOG_FILE"
    exit 1
fi

echo "🎉 Installation complete!" | tee -a "$LOG_FILE"
EOF

chmod +x "$DIST_DIR/install-vibecode.sh"

# Create ARD deployment guide
echo "📖 Creating ARD deployment guide..."
cat > "$DIST_DIR/ARD-DEPLOYMENT-GUIDE.md" << 'EOF'
# VibeCode ARD Deployment Guide

## Overview
This guide explains how to deploy VibeCode to remote Macs using Apple Remote Desktop (ARD).

## Files Included
- `VibeCode-1.2.0.pkg` - Universal2 installer package
- `install-vibecode.sh` - Automated installation script
- `ARD-DEPLOYMENT-GUIDE.md` - This guide

## Deployment Methods

### Method 1: Direct PKG Installation
1. Copy `VibeCode-1.2.0.pkg` to remote Mac
2. Double-click to install, or run:
   ```bash
   sudo installer -pkg VibeCode-1.2.0.pkg -target /
   ```

### Method 2: Automated Script Installation
1. Copy both `VibeCode-1.2.0.pkg` and `install-vibecode.sh` to remote Mac
2. Run the installation script:
   ```bash
   chmod +x install-vibecode.sh
   ./install-vibecode.sh
   ```

### Method 3: ARD Package Distribution
1. In ARD, select target Macs
2. Choose "Send Items" → "Packages"
3. Select `VibeCode-1.2.0.pkg`
4. Choose "Install" as the action
5. Execute the task

## Verification
After installation, verify VibeCode is installed:
```bash
# Check if app exists
ls -la /Applications/VibeCode.app

# Check architectures
lipo -info /Applications/VibeCode.app/Contents/MacOS/vibecode

# Launch VibeCode
open /Applications/VibeCode.app
```

## Requirements
- macOS 10.13 or later
- Admin privileges for installation
- Universal2 binary supports both Intel and Apple Silicon

## Troubleshooting
- Check installation log: `/tmp/vibecode-install.log`
- Verify package integrity: `pkgutil --check-signature VibeCode-1.2.0.pkg`
- Reinstall if needed: `sudo installer -pkg VibeCode-1.2.0.pkg -target / -allowUntrusted`
EOF

# Get package info
echo "📊 Package information:"
PKG_SIZE=$(du -h "$DIST_DIR/VibeCode-$APP_VERSION.pkg" | cut -f1)
echo "📦 Package size: $PKG_SIZE"
echo "📁 Package location: $DIST_DIR/VibeCode-$APP_VERSION.pkg"

# Verify package
echo "🔍 Verifying package..."
pkgutil --check-signature "$DIST_DIR/VibeCode-$APP_VERSION.pkg" || echo "⚠️  Package not signed (expected for development)"

echo "✅ PKG build complete!"
echo "📁 Output directory: $DIST_DIR"
echo "📦 Main package: $DIST_DIR/VibeCode-$APP_VERSION.pkg"
echo "📜 Install script: $DIST_DIR/install-vibecode.sh"
echo "📖 Guide: $DIST_DIR/ARD-DEPLOYMENT-GUIDE.md"
