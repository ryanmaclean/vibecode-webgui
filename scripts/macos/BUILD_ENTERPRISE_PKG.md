# Building VibeCode Enterprise .pkg for macOS

**Version**: 1.0.0
**Last Updated**: 2025-10-02
**Status**: Implementation Guide

## Overview

This guide provides step-by-step instructions for building a production-ready .pkg installer for VibeCode Enterprise on macOS, suitable for MDM distribution.

## Prerequisites

### Development Environment

- macOS 13.0 (Ventura) or later
- Xcode 15.0+ with Command Line Tools
- Node.js 18.20.0 LTS
- Docker Desktop or Colima (for code-server features)
- Apple Developer Account (Team ID required for signing)

### Certificates Required

1. **Developer ID Application Certificate**
   - Used for code signing the .app bundle
   - Download from: https://developer.apple.com/account/resources/certificates

2. **Developer ID Installer Certificate**
   - Used for signing the .pkg installer
   - Download from: https://developer.apple.com/account/resources/certificates

3. **App-Specific Password**
   - For notarization with `xcrun notarytool`
   - Generate at: https://appleid.apple.com/account/manage

### Install Certificates

```bash
# Download certificates from Apple Developer portal
# Double-click to install in Keychain Access

# Verify installation
security find-identity -v -p codesigning
# Should show:
#   1) ABC123... "Developer ID Application: VibeCode Inc (TEAM_ID)"
#   2) XYZ789... "Developer ID Installer: VibeCode Inc (TEAM_ID)"
```

## Build Pipeline

### Step 1: Prepare Project

```bash
#!/bin/bash
# scripts/macos/01-prepare.sh

set -euo pipefail

echo "=== Step 1: Preparing VibeCode for macOS Build ==="

# Clean previous builds
echo "Cleaning build artifacts..."
rm -rf build/macos
rm -rf .next
rm -rf node_modules/.cache

# Install dependencies
echo "Installing dependencies..."
npm ci --legacy-peer-deps

# Type check
echo "Running type check..."
npm run type-check

# Lint
echo "Running lint..."
npm run lint

# Run tests
echo "Running tests..."
npm run test:unit

echo "✓ Project prepared successfully"
```

### Step 2: Build Next.js Application

```bash
#!/bin/bash
# scripts/macos/02-build-nextjs.sh

set -euo pipefail

echo "=== Step 2: Building Next.js Application ==="

# Set production environment
export NODE_ENV=production
export NEXT_TELEMETRY_DISABLED=1

# Build Next.js app
echo "Building Next.js production bundle..."
npm run build

# Verify build output
if [[ ! -d ".next/standalone" ]]; then
    echo "ERROR: Standalone build not found. Check next.config.mjs"
    exit 1
fi

# Copy public assets
echo "Copying static assets..."
mkdir -p build/macos/app
cp -R .next/standalone/* build/macos/app/
cp -R .next/static build/macos/app/.next/
cp -R public build/macos/app/

echo "✓ Next.js build complete"
echo "Build size: $(du -sh build/macos/app | cut -f1)"
```

### Step 3: Create Application Bundle

```bash
#!/bin/bash
# scripts/macos/03-create-app-bundle.sh

set -euo pipefail

APP_NAME="VibeCode"
VERSION="1.0.0"
BUNDLE_ID="com.vibecode.app"
BUILD_DIR="build/macos"
APP_PATH="$BUILD_DIR/$APP_NAME.app"

echo "=== Step 3: Creating Application Bundle ==="

# Create bundle structure
echo "Creating .app bundle structure..."
mkdir -p "$APP_PATH/Contents/"{MacOS,Resources,Frameworks,Library}

# Copy Next.js build
echo "Copying application files..."
cp -R "$BUILD_DIR/app/"* "$APP_PATH/Contents/MacOS/"

# Download and bundle Node.js runtime
echo "Bundling Node.js runtime..."
NODE_VERSION="18.20.0"
ARCH=$(uname -m)

if [[ "$ARCH" == "arm64" ]]; then
    NODE_ARCH="arm64"
elif [[ "$ARCH" == "x86_64" ]]; then
    NODE_ARCH="x64"
else
    echo "ERROR: Unsupported architecture: $ARCH"
    exit 1
fi

NODE_URL="https://nodejs.org/dist/v$NODE_VERSION/node-v$NODE_VERSION-darwin-$NODE_ARCH.tar.gz"
echo "Downloading Node.js from $NODE_URL..."

curl -L "$NODE_URL" | tar -xz -C /tmp/
cp -R "/tmp/node-v$NODE_VERSION-darwin-$NODE_ARCH/"* "$APP_PATH/Contents/Frameworks/"
rm -rf "/tmp/node-v$NODE_VERSION-darwin-$NODE_ARCH"

# Create launcher script
cat > "$APP_PATH/Contents/MacOS/VibeCode-launcher" <<'LAUNCHER'
#!/bin/bash
set -e

# Get app bundle path
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
BUNDLE_DIR="$DIR/.."

# Node runtime
NODE="$BUNDLE_DIR/Frameworks/bin/node"
APP_ENTRY="$DIR/server.js"

# Environment variables
export PORT=3000
export NODE_ENV=production
export HOSTNAME=localhost

# Load configuration from MDM (if present)
if [[ -f "/Library/Preferences/com.vibecode.enterprise.plist" ]]; then
    export VIBECODE_CONFIG_PATH="/Library/Preferences/com.vibecode.enterprise.plist"
fi

# Launch Next.js server
exec "$NODE" "$APP_ENTRY" "$@"
LAUNCHER

chmod +x "$APP_PATH/Contents/MacOS/VibeCode-launcher"

# Create Info.plist
cat > "$APP_PATH/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleDevelopmentRegion</key>
    <string>en</string>
    <key>CFBundleExecutable</key>
    <string>VibeCode-launcher</string>
    <key>CFBundleIdentifier</key>
    <string>$BUNDLE_ID</string>
    <key>CFBundleInfoDictionaryVersion</key>
    <string>6.0</string>
    <key>CFBundleName</key>
    <string>$APP_NAME</string>
    <key>CFBundleDisplayName</key>
    <string>$APP_NAME</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>$VERSION</string>
    <key>CFBundleVersion</key>
    <string>$VERSION</string>
    <key>LSMinimumSystemVersion</key>
    <string>13.0</string>
    <key>LSApplicationCategoryType</key>
    <string>public.app-category.developer-tools</string>
    <key>CFBundleIconFile</key>
    <string>AppIcon</string>
    <key>NSHighResolutionCapable</key>
    <true/>
    <key>NSSupportsAutomaticGraphicsSwitching</key>
    <true/>
    <key>NSRequiresAquaSystemAppearance</key>
    <false/>
    <key>LSUIElement</key>
    <false/>
    <key>NSHumanReadableCopyright</key>
    <string>Copyright © 2025 VibeCode Inc. All rights reserved.</string>
</dict>
</plist>
PLIST

# Create PkgInfo
echo "APPLvibe" > "$APP_PATH/Contents/PkgInfo"

# Copy app icon (if available)
if [[ -f "public/icon.icns" ]]; then
    echo "Copying app icon..."
    cp public/icon.icns "$APP_PATH/Contents/Resources/AppIcon.icns"
else
    echo "WARNING: No app icon found at public/icon.icns"
fi

echo "✓ Application bundle created: $APP_PATH"
echo "Bundle size: $(du -sh "$APP_PATH" | cut -f1)"
```

### Step 4: Code Signing

```bash
#!/bin/bash
# scripts/macos/04-sign-app.sh

set -euo pipefail

APP_PATH="build/macos/VibeCode.app"
TEAM_ID="${APPLE_TEAM_ID:-TEAM_ID}"  # From environment or default
DEVELOPER_ID="Developer ID Application: VibeCode Inc ($TEAM_ID)"
ENTITLEMENTS="scripts/macos/entitlements.plist"

echo "=== Step 4: Code Signing Application ==="

# Verify certificate exists
if ! security find-identity -v -p codesigning | grep -q "$DEVELOPER_ID"; then
    echo "ERROR: Certificate not found: $DEVELOPER_ID"
    echo "Install certificate from Apple Developer portal"
    exit 1
fi

echo "Using certificate: $DEVELOPER_ID"

# Sign all binaries in Frameworks (Node.js)
echo "Signing framework binaries..."
find "$APP_PATH/Contents/Frameworks" -type f -perm +111 | while read binary; do
    echo "  Signing: $(basename "$binary")"
    codesign --force \
        --timestamp \
        --options runtime \
        --entitlements "$ENTITLEMENTS" \
        --sign "$DEVELOPER_ID" \
        "$binary" 2>&1 | grep -v "is already signed"
done

# Sign dynamic libraries
echo "Signing dynamic libraries..."
find "$APP_PATH/Contents/Frameworks" -name "*.dylib" -o -name "*.so" | while read lib; do
    echo "  Signing: $(basename "$lib")"
    codesign --force \
        --timestamp \
        --options runtime \
        --sign "$DEVELOPER_ID" \
        "$lib" 2>&1 | grep -v "is already signed"
done

# Sign the main launcher
echo "Signing main executable..."
codesign --force \
    --timestamp \
    --options runtime \
    --entitlements "$ENTITLEMENTS" \
    --sign "$DEVELOPER_ID" \
    "$APP_PATH/Contents/MacOS/VibeCode-launcher"

# Sign the entire app bundle
echo "Signing application bundle..."
codesign --force \
    --deep \
    --timestamp \
    --options runtime \
    --entitlements "$ENTITLEMENTS" \
    --sign "$DEVELOPER_ID" \
    "$APP_PATH"

# Verify signature
echo "Verifying signature..."
codesign --verify --deep --strict --verbose=2 "$APP_PATH"

# Check Gatekeeper
echo "Checking Gatekeeper assessment..."
spctl --assess --type execute --verbose=2 "$APP_PATH"

echo "✓ Code signing complete"
```

**Entitlements** (`scripts/macos/entitlements.plist`):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <!-- Hardened Runtime -->
    <key>com.apple.security.cs.allow-jit</key>
    <true/>
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
    <true/>
    <key>com.apple.security.cs.disable-library-validation</key>
    <true/>

    <!-- Network Access -->
    <key>com.apple.security.network.client</key>
    <true/>
    <key>com.apple.security.network.server</key>
    <true/>

    <!-- File Access -->
    <key>com.apple.security.files.user-selected.read-write</key>
    <true/>
    <key>com.apple.security.files.downloads.read-write</key>
    <true/>

    <!-- Keychain -->
    <key>keychain-access-groups</key>
    <array>
        <string>$(AppIdentifierPrefix)com.vibecode.app</string>
    </array>

    <!-- Virtualization (for Docker) -->
    <key>com.apple.security.virtualization</key>
    <true/>

    <!-- No kernel extensions needed -->
</dict>
</plist>
```

### Step 5: Notarization

```bash
#!/bin/bash
# scripts/macos/05-notarize-app.sh

set -euo pipefail

APP_PATH="build/macos/VibeCode.app"
BUNDLE_ID="com.vibecode.app"
APPLE_ID="${APPLE_ID:-developer@vibecode.com}"
TEAM_ID="${APPLE_TEAM_ID:-TEAM_ID}"
APP_PASSWORD="${APPLE_APP_PASSWORD:-@keychain:AC_PASSWORD}"

echo "=== Step 5: Notarizing Application ==="

# Compress app for notarization
echo "Compressing application..."
ditto -c -k --keepParent "$APP_PATH" "build/macos/VibeCode.zip"

ZIP_SIZE=$(du -sh build/macos/VibeCode.zip | cut -f1)
echo "ZIP size: $ZIP_SIZE"

# Submit for notarization
echo "Submitting to Apple for notarization..."
echo "This may take 5-15 minutes..."

SUBMISSION_OUTPUT=$(xcrun notarytool submit "build/macos/VibeCode.zip" \
    --apple-id "$APPLE_ID" \
    --team-id "$TEAM_ID" \
    --password "$APP_PASSWORD" \
    --wait 2>&1)

echo "$SUBMISSION_OUTPUT"

# Extract submission ID
SUBMISSION_ID=$(echo "$SUBMISSION_OUTPUT" | grep "id:" | head -1 | awk '{print $2}')

if [[ -z "$SUBMISSION_ID" ]]; then
    echo "ERROR: Failed to get submission ID"
    echo "Check credentials and network connectivity"
    exit 1
fi

echo "Submission ID: $SUBMISSION_ID"

# Check status
echo "Checking notarization status..."
xcrun notarytool info "$SUBMISSION_ID" \
    --apple-id "$APPLE_ID" \
    --team-id "$TEAM_ID" \
    --password "$APP_PASSWORD"

# Get log (if failed)
if echo "$SUBMISSION_OUTPUT" | grep -q "Invalid"; then
    echo "ERROR: Notarization failed. Fetching log..."
    xcrun notarytool log "$SUBMISSION_ID" \
        --apple-id "$APPLE_ID" \
        --team-id "$TEAM_ID" \
        --password "$APP_PASSWORD" \
        build/macos/notarization.log
    cat build/macos/notarization.log
    exit 1
fi

# Staple ticket to app
echo "Stapling notarization ticket..."
xcrun stapler staple "$APP_PATH"

# Verify staple
echo "Verifying stapled ticket..."
xcrun stapler validate "$APP_PATH"

echo "✓ Notarization complete and stapled"
```

### Step 6: Create Package Installer

```bash
#!/bin/bash
# scripts/macos/06-create-pkg.sh

set -euo pipefail

VERSION="1.0.0"
APP_PATH="build/macos/VibeCode.app"
PKG_BUILD_DIR="build/macos/pkg"
OUTPUT_PKG="build/macos/VibeCode-$VERSION.pkg"
TEAM_ID="${APPLE_TEAM_ID:-TEAM_ID}"
DEVELOPER_ID_INSTALLER="Developer ID Installer: VibeCode Inc ($TEAM_ID)"

echo "=== Step 6: Creating Package Installer ==="

# Clean previous builds
rm -rf "$PKG_BUILD_DIR"
mkdir -p "$PKG_BUILD_DIR"/{Applications,Library/{LaunchDaemons,LaunchAgents,Application\ Support/VibeCode},scripts}

# Copy application
echo "Copying application to package root..."
cp -R "$APP_PATH" "$PKG_BUILD_DIR/Applications/"

# Create launch daemon for updater
echo "Creating launch daemon..."
cat > "$PKG_BUILD_DIR/Library/LaunchDaemons/com.vibecode.updater.plist" <<'DAEMON'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.vibecode.updater</string>
    <key>ProgramArguments</key>
    <array>
        <string>/Applications/VibeCode.app/Contents/MacOS/VibeCode-launcher</string>
        <string>--check-updates</string>
    </array>
    <key>RunAtLoad</key>
    <false/>
    <key>StartInterval</key>
    <integer>86400</integer>
    <key>StandardOutPath</key>
    <string>/var/log/vibecode/updater.log</string>
    <key>StandardErrorPath</key>
    <string>/var/log/vibecode/updater.error.log</string>
</dict>
</plist>
DAEMON

# Create default configuration
echo "Creating default configuration..."
mkdir -p "$PKG_BUILD_DIR/Library/Application Support/VibeCode/config"
cat > "$PKG_BUILD_DIR/Library/Application Support/VibeCode/config/default.json" <<'CONFIG'
{
  "version": "1.0.0",
  "enterprise": true,
  "updateChannel": "stable",
  "telemetry": {
    "enabled": true,
    "anonymize": true
  },
  "features": {
    "aiCompletion": true,
    "codebaseChat": true,
    "collaboration": true,
    "codeServer": true
  }
}
CONFIG

# Preinstall script
cat > "$PKG_BUILD_DIR/scripts/preinstall" <<'PREINSTALL'
#!/bin/bash
set -e

echo "Running pre-installation checks..."

# Check macOS version
MACOS_VERSION=$(sw_vers -productVersion | cut -d '.' -f 1)
if [[ "$MACOS_VERSION" -lt 13 ]]; then
    echo "ERROR: VibeCode requires macOS 13.0 (Ventura) or later"
    echo "Current version: $(sw_vers -productVersion)"
    exit 1
fi

# Check architecture
ARCH=$(uname -m)
if [[ "$ARCH" != "arm64" && "$ARCH" != "x86_64" ]]; then
    echo "ERROR: Unsupported architecture: $ARCH"
    exit 1
fi

echo "Architecture: $ARCH"

# Check available disk space (need at least 1GB)
AVAILABLE_KB=$(df -k /Applications | tail -1 | awk '{print $4}')
AVAILABLE_GB=$((AVAILABLE_KB / 1024 / 1024))

if [[ "$AVAILABLE_GB" -lt 1 ]]; then
    echo "ERROR: Insufficient disk space. Need at least 1GB, have ${AVAILABLE_GB}GB"
    exit 1
fi

echo "Available disk space: ${AVAILABLE_GB}GB"

# Quit running instance
if pgrep -x "VibeCode" > /dev/null; then
    echo "Quitting running VibeCode instance..."
    osascript -e 'quit app "VibeCode"' 2>/dev/null || true
    sleep 2
fi

echo "Pre-installation checks passed"
exit 0
PREINSTALL

# Postinstall script
cat > "$PKG_BUILD_DIR/scripts/postinstall" <<'POSTINSTALL'
#!/bin/bash
set -e

APP_PATH="/Applications/VibeCode.app"
LOG_DIR="/var/log/vibecode"
SUPPORT_DIR="/Library/Application Support/VibeCode"

echo "Running post-installation setup..."

# Create directories
echo "Creating directories..."
mkdir -p "$LOG_DIR"
mkdir -p "$SUPPORT_DIR"/{config,workspace,extensions,backups}

# Set permissions
echo "Setting permissions..."
chmod 755 "$APP_PATH"
chmod -R 755 "$SUPPORT_DIR"
chmod 755 /Library/LaunchDaemons/com.vibecode.updater.plist

# Create symlink for CLI
echo "Creating CLI symlink..."
ln -sf "$APP_PATH/Contents/MacOS/VibeCode-launcher" /usr/local/bin/vibecode

# Load launch daemon (but don't start immediately)
echo "Loading launch daemon..."
launchctl load /Library/LaunchDaemons/com.vibecode.updater.plist 2>/dev/null || true

# Create first-run marker
touch "$SUPPORT_DIR/.first_run"

# Write installation receipt
echo "1.0.0" > "$SUPPORT_DIR/.installed"
date +%s > "$SUPPORT_DIR/.install_timestamp"

# Report to MDM (if available)
if command -v jamf &> /dev/null; then
    echo "Reporting installation to Jamf Pro..."
    jamf recon
fi

echo "Installation complete!"
echo ""
echo "VibeCode has been installed successfully."
echo "Launch from Applications folder or run 'vibecode' in Terminal."
exit 0
POSTINSTALL

chmod +x "$PKG_BUILD_DIR/scripts/"*

# Build component package
echo "Building component package..."
pkgbuild --root "$PKG_BUILD_DIR" \
    --identifier "com.vibecode.app" \
    --version "$VERSION" \
    --scripts "$PKG_BUILD_DIR/scripts" \
    --install-location "/" \
    "$PKG_BUILD_DIR/VibeCode-component.pkg"

# Create distribution XML
cat > "$PKG_BUILD_DIR/Distribution.xml" <<DISTRIBUTION
<?xml version="1.0" encoding="utf-8"?>
<installer-gui-script minSpecVersion="2">
    <title>VibeCode $VERSION</title>
    <organization>com.vibecode</organization>
    <domains enable_anywhere="false" enable_currentUserHome="false" enable_localSystem="true"/>
    <options customize="never" require-scripts="false" hostArchitectures="arm64,x86_64"/>

    <welcome file="Welcome.rtf" mime-type="text/rtf"/>
    <readme file="ReadMe.rtf" mime-type="text/rtf"/>
    <license file="License.rtf" mime-type="text/rtf"/>
    <conclusion file="Conclusion.rtf" mime-type="text/rtf"/>

    <volume-check>
        <allowed-os-versions>
            <os-version min="13.0"/>
        </allowed-os-versions>
    </volume-check>

    <installation-check script="installCheck()"/>
    <script>
    function installCheck() {
        var macOS = system.version.ProductVersion;
        if (system.compareVersions(macOS, '13.0') &lt; 0) {
            my.result.title = 'macOS Version Too Old';
            my.result.message = 'VibeCode requires macOS 13.0 (Ventura) or later. You have ' + macOS + '.';
            my.result.type = 'Fatal';
            return false;
        }
        return true;
    }
    </script>

    <choices-outline>
        <line choice="default">
            <line choice="com.vibecode.app"/>
        </line>
    </choices-outline>

    <choice id="default"/>
    <choice id="com.vibecode.app" visible="false">
        <pkg-ref id="com.vibecode.app"/>
    </choice>

    <pkg-ref id="com.vibecode.app" version="$VERSION" onConclusion="none">
        VibeCode-component.pkg
    </pkg-ref>
</installer-gui-script>
DISTRIBUTION

# Create resources (RTF files)
mkdir -p "$PKG_BUILD_DIR/Resources"

# Welcome screen
cat > "$PKG_BUILD_DIR/Resources/Welcome.rtf" <<'WELCOME'
{\rtf1\ansi\ansicpg1252\cocoartf2709
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\fswiss\fcharset0 Helvetica-Bold;\f1\fswiss\fcharset0 Helvetica;}
{\colortbl;\red255\green255\blue255;\red0\green0\blue0;}
{\*\expandedcolortbl;;\cssrgb\c0\c0\c0;}
\paperw11900\paperh16840\margl1440\margr1440\vieww11520\viewh8400\viewkind0
\pard\tx720\tx1440\tx2160\tx2880\tx3600\tx4320\tx5040\tx5760\tx6480\tx7200\tx7920\tx8640\pardirnatural\partightenfactor0

\f0\b\fs36 \cf2 Welcome to VibeCode\
\pard\tx720\tx1440\tx2160\tx2880\tx3600\tx4320\tx5040\tx5760\tx6480\tx7200\tx7920\tx8640\pardirnatural\partightenfactor0

\f1\b0\fs28 \cf2 \
AI-powered development platform with Monaco editor, code-server workspaces, and enterprise-grade features.\
\
This installer will install VibeCode on your Mac.\
\
\
}
WELCOME

# ReadMe
cat > "$PKG_BUILD_DIR/Resources/ReadMe.rtf" <<'README'
{\rtf1\ansi\ansicpg1252\cocoartf2709
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\fswiss\fcharset0 Helvetica-Bold;\f1\fswiss\fcharset0 Helvetica;}
{\colortbl;\red255\green255\blue255;}
{\*\expandedcolortbl;;}
\paperw11900\paperh16840\margl1440\margr1440\vieww11520\viewh8400\viewkind0
\pard\tx720\tx1440\tx2160\tx2880\tx3600\tx4320\tx5040\tx5760\tx6480\tx7200\tx7920\tx8640\pardirnatural\partightenfactor0

\f0\b\fs28 \cf0 System Requirements\
\pard\tx720\tx1440\tx2160\tx2880\tx3600\tx4320\tx5040\tx5760\tx6480\tx7200\tx7920\tx8640\pardirnatural\partightenfactor0

\f1\b0 \cf0 \
- macOS 13.0 (Ventura) or later\
- Apple Silicon (M1/M2/M3) or Intel x86_64\
- 1GB available disk space\
- Docker Desktop or Colima (optional, for code-server)\
\

\f0\b \
Installation Details\
\pard\tx720\tx1440\tx2160\tx2880\tx3600\tx4320\tx5040\tx5760\tx6480\tx7200\tx7920\tx8640\pardirnatural\partightenfactor0

\f1\b0 \cf0 \
VibeCode will be installed to:\
  /Applications/VibeCode.app\
\
Configuration stored at:\
  /Library/Application Support/VibeCode/\
\
Command-line tool:\
  /usr/local/bin/vibecode\
}
README

# License (MIT)
cat > "$PKG_BUILD_DIR/Resources/License.rtf" <<'LICENSE'
{\rtf1\ansi\ansicpg1252\cocoartf2709
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\fswiss\fcharset0 Helvetica-Bold;\f1\fswiss\fcharset0 Helvetica;}
{\colortbl;\red255\green255\blue255;}
{\*\expandedcolortbl;;}
\paperw11900\paperh16840\margl1440\margr1440\vieww11520\viewh8400\viewkind0
\pard\tx720\tx1440\tx2160\tx2880\tx3600\tx4320\tx5040\tx5760\tx6480\tx7200\tx7920\tx8640\pardirnatural\partightenfactor0

\f0\b\fs28 \cf0 MIT License\
\pard\tx720\tx1440\tx2160\tx2880\tx3600\tx4320\tx5040\tx5760\tx6480\tx7200\tx7920\tx8640\pardirnatural\partightenfactor0

\f1\b0 \cf0 \
Copyright (c) 2025 VibeCode Inc.\
\
Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction...\
}
LICENSE

# Conclusion
cat > "$PKG_BUILD_DIR/Resources/Conclusion.rtf" <<'CONCLUSION'
{\rtf1\ansi\ansicpg1252\cocoartf2709
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\fswiss\fcharset0 Helvetica-Bold;\f1\fswiss\fcharset0 Helvetica;}
{\colortbl;\red255\green255\blue255;}
{\*\expandedcolortbl;;}
\paperw11900\paperh16840\margl1440\margr1440\vieww11520\viewh8400\viewkind0
\pard\tx720\tx1440\tx2160\tx2880\tx3600\tx4320\tx5040\tx5760\tx6480\tx7200\tx7920\tx8640\pardirnatural\partightenfactor0

\f0\b\fs36 \cf0 Installation Complete!\
\pard\tx720\tx1440\tx2160\tx2880\tx3600\tx4320\tx5040\tx5760\tx6480\tx7200\tx7920\tx8640\pardirnatural\partightenfactor0

\f1\b0\fs28 \cf0 \
VibeCode has been successfully installed.\
\

\f0\b Next Steps:\
\pard\tx720\tx1440\tx2160\tx2880\tx3600\tx4320\tx5040\tx5760\tx6480\tx7200\tx7920\tx8640\pardirnatural\partightenfactor0

\f1\b0 \cf0 \
1. Launch VibeCode from Applications folder\
2. Complete first-run setup\
3. Sign in with your enterprise credentials\
\
Documentation: https://docs.vibecode.com\
Support: enterprise@vibecode.com\
}
CONCLUSION

# Build product archive
echo "Building product archive..."
productbuild --distribution "$PKG_BUILD_DIR/Distribution.xml" \
    --package-path "$PKG_BUILD_DIR" \
    --resources "$PKG_BUILD_DIR/Resources" \
    --version "$VERSION" \
    "$OUTPUT_PKG.unsigned"

# Sign the package
echo "Signing package..."
productsign --sign "$DEVELOPER_ID_INSTALLER" \
    "$OUTPUT_PKG.unsigned" \
    "$OUTPUT_PKG"

rm "$OUTPUT_PKG.unsigned"

# Verify package
echo "Verifying package signature..."
pkgutil --check-signature "$OUTPUT_PKG"

echo "✓ Package created: $OUTPUT_PKG"
echo "Package size: $(du -sh "$OUTPUT_PKG" | cut -f1)"
```

### Step 7: Notarize Package

```bash
#!/bin/bash
# scripts/macos/07-notarize-pkg.sh

set -euo pipefail

OUTPUT_PKG="build/macos/VibeCode-1.0.0.pkg"
APPLE_ID="${APPLE_ID:-developer@vibecode.com}"
TEAM_ID="${APPLE_TEAM_ID:-TEAM_ID}"
APP_PASSWORD="${APPLE_APP_PASSWORD:-@keychain:AC_PASSWORD}"

echo "=== Step 7: Notarizing Package ==="

# Submit for notarization
echo "Submitting package to Apple..."
xcrun notarytool submit "$OUTPUT_PKG" \
    --apple-id "$APPLE_ID" \
    --team-id "$TEAM_ID" \
    --password "$APP_PASSWORD" \
    --wait

# Staple ticket
echo "Stapling notarization ticket..."
xcrun stapler staple "$OUTPUT_PKG"

echo "✓ Package notarized and stapled"
echo "Ready for distribution!"
```

## Complete Build Script

```bash
#!/bin/bash
# scripts/macos/build-enterprise-pkg.sh

set -euo pipefail

echo "======================================"
echo "  VibeCode Enterprise .pkg Builder   "
echo "======================================"
echo ""

# Check prerequisites
if [[ "$(uname)" != "Darwin" ]]; then
    echo "ERROR: This script must run on macOS"
    exit 1
fi

if [[ "$(sw_vers -productVersion | cut -d '.' -f 1)" -lt 13 ]]; then
    echo "ERROR: Requires macOS 13.0 (Ventura) or later"
    exit 1
fi

# Run all steps
./scripts/macos/01-prepare.sh
./scripts/macos/02-build-nextjs.sh
./scripts/macos/03-create-app-bundle.sh
./scripts/macos/04-sign-app.sh
./scripts/macos/05-notarize-app.sh
./scripts/macos/06-create-pkg.sh
./scripts/macos/07-notarize-pkg.sh

echo ""
echo "======================================"
echo "  Build Complete!                    "
echo "======================================"
echo ""
echo "Package: build/macos/VibeCode-1.0.0.pkg"
echo "Size: $(du -sh build/macos/VibeCode-1.0.0.pkg | cut -f1)"
echo ""
echo "Next steps:"
echo "  1. Test installation on clean macOS"
echo "  2. Upload to MDM (Jamf, Intune, etc.)"
echo "  3. Deploy to pilot users"
```

## Testing Checklist

### Pre-Release Testing

```bash
# Test on clean macOS installation
# 1. Create VM or use separate Mac
# 2. Install package
sudo installer -pkg build/macos/VibeCode-1.0.0.pkg -target /

# 3. Verify installation
ls -la /Applications/VibeCode.app
ls -la "/Library/Application Support/VibeCode"
launchctl list | grep vibecode

# 4. Launch application
open /Applications/VibeCode.app

# 5. Check logs
tail -f /var/log/vibecode/updater.log

# 6. Test CLI
vibecode --version
vibecode --help

# 7. Verify Gatekeeper
spctl --assess --type execute /Applications/VibeCode.app

# 8. Check code signature
codesign --verify --deep --strict /Applications/VibeCode.app
codesign -dvvv /Applications/VibeCode.app

# 9. Verify notarization staple
stapler validate /Applications/VibeCode.app
stapler validate build/macos/VibeCode-1.0.0.pkg
```

## Troubleshooting

### Issue: Code signing fails

```bash
# Check available certificates
security find-identity -v -p codesigning

# Import certificate if missing
# Download from Apple Developer portal, then:
security import DeveloperIDApplication.p12 -k ~/Library/Keychains/login.keychain

# Verify certificate chain
security find-certificate -c "Developer ID Application" -p | openssl x509 -text
```

### Issue: Notarization rejected

```bash
# Get detailed log
xcrun notarytool log <SUBMISSION_ID> \
    --apple-id developer@vibecode.com \
    --team-id TEAM_ID \
    --password @keychain:AC_PASSWORD

# Common issues:
# - Unsigned binaries in Frameworks
# - Invalid entitlements
# - Missing hardened runtime flag
```

### Issue: Package installation fails

```bash
# Check installer log
tail -f /var/log/install.log

# Manually run scripts
bash -x /path/to/pkg/scripts/preinstall
bash -x /path/to/pkg/scripts/postinstall

# Extract package contents
pkgutil --expand VibeCode-1.0.0.pkg /tmp/pkg-contents
```

## CI/CD Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/build-macos-pkg.yml
name: Build macOS Package

on:
  push:
    tags:
      - 'v*'
  workflow_dispatch:

jobs:
  build:
    runs-on: macos-13
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18.20.0'

      - name: Import certificates
        env:
          CERTIFICATE_BASE64: ${{ secrets.MACOS_CERTIFICATE }}
          CERTIFICATE_PASSWORD: ${{ secrets.MACOS_CERTIFICATE_PASSWORD }}
        run: |
          echo "$CERTIFICATE_BASE64" | base64 --decode > certificate.p12
          security create-keychain -p "$CERTIFICATE_PASSWORD" build.keychain
          security default-keychain -s build.keychain
          security unlock-keychain -p "$CERTIFICATE_PASSWORD" build.keychain
          security import certificate.p12 -k build.keychain -P "$CERTIFICATE_PASSWORD" -T /usr/bin/codesign
          security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k "$CERTIFICATE_PASSWORD" build.keychain

      - name: Build package
        env:
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
          APPLE_APP_PASSWORD: ${{ secrets.APPLE_APP_PASSWORD }}
        run: |
          chmod +x scripts/macos/*.sh
          ./scripts/macos/build-enterprise-pkg.sh

      - name: Upload artifact
        uses: actions/upload-artifact@v4
        with:
          name: VibeCode-macOS-Package
          path: build/macos/VibeCode-*.pkg
```

## Security Hardening

### Restrict Permissions

```bash
# Set restrictive permissions on app bundle
chmod 755 /Applications/VibeCode.app
chmod -R 755 /Applications/VibeCode.app/Contents

# Protect configuration directory
chmod 755 "/Library/Application Support/VibeCode"
chmod 644 "/Library/Application Support/VibeCode/config/"*
```

### Enable App Sandbox (Optional)

For maximum security, enable App Sandbox in entitlements:

```xml
<key>com.apple.security.app-sandbox</key>
<true/>
<key>com.apple.security.network.client</key>
<true/>
<key>com.apple.security.network.server</key>
<true/>
<key>com.apple.security.files.user-selected.read-write</key>
<true/>
```

**Note**: Sandboxing may limit Docker integration. Test thoroughly.

---

**Document Version**: 1.0.0
**Last Updated**: 2025-10-02
**Maintained By**: Agent 30 (Staff Solutions Architect)
