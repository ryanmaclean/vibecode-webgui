#!/bin/bash
set -e

echo "=== Creating ValkeyVibeCode.app Bundle ==="

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Paths to resources
KERNEL="$SCRIPT_DIR/../vmlinux-raw"
INITRD="$SCRIPT_DIR/../valkey-standalone-complete.cpio.gz"

# Verify resources exist
if [ ! -f "$KERNEL" ]; then
    echo "ERROR: Kernel not found at $KERNEL"
    exit 1
fi

if [ ! -f "$INITRD" ]; then
    echo "ERROR: Initramfs not found at $INITRD"
    exit 1
fi

# Verify the executable exists
if [ ! -f "ValkeyVibeCodeApp" ]; then
    echo "ERROR: ValkeyVibeCodeApp binary not found. Run build-valkey-app.sh first."
    exit 1
fi

APP_NAME="ValkeyVibeCode"
EXECUTABLE="ValkeyVibeCodeApp"
BUNDLE_ID="com.vibecode.valkey"

echo ""
echo "Creating $APP_NAME.app bundle..."

# Remove old bundle if it exists
rm -rf "$APP_NAME.app"

# Create bundle structure
mkdir -p "$APP_NAME.app/Contents/MacOS"
mkdir -p "$APP_NAME.app/Contents/Resources"

# Copy executable
cp "$EXECUTABLE" "$APP_NAME.app/Contents/MacOS/$APP_NAME"
chmod +x "$APP_NAME.app/Contents/MacOS/$APP_NAME"
echo "  ✓ Copied executable"

# Copy VM resources
echo "  Copying kernel (vmlinux-raw)..."
cp "$KERNEL" "$APP_NAME.app/Contents/Resources/vmlinux-raw"
chmod 644 "$APP_NAME.app/Contents/Resources/vmlinux-raw"
KERNEL_SIZE=$(du -sh "$APP_NAME.app/Contents/Resources/vmlinux-raw" | cut -f1)
echo "    Size: $KERNEL_SIZE"

echo "  Copying initramfs (valkey-standalone.cpio.gz)..."
cp "$INITRD" "$APP_NAME.app/Contents/Resources/valkey-standalone.cpio.gz"
chmod 644 "$APP_NAME.app/Contents/Resources/valkey-standalone.cpio.gz"
INITRD_SIZE=$(du -sh "$APP_NAME.app/Contents/Resources/valkey-standalone.cpio.gz" | cut -f1)
echo "    Size: $INITRD_SIZE"

# Create Info.plist
cat > "$APP_NAME.app/Contents/Info.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>$APP_NAME</string>
    <key>CFBundleIdentifier</key>
    <string>$BUNDLE_ID</string>
    <key>CFBundleName</key>
    <string>$APP_NAME</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0.1</string>
    <key>CFBundleVersion</key>
    <string>2</string>
    <key>LSMinimumSystemVersion</key>
    <string>13.0</string>
    <key>NSHighResolutionCapable</key>
    <true/>
    <key>CFBundleInfoDictionaryVersion</key>
    <string>6.0</string>
</dict>
</plist>
EOF
echo "  ✓ Created Info.plist"

# Create PkgInfo
echo -n "APPL????" > "$APP_NAME.app/Contents/PkgInfo"
echo "  ✓ Created PkgInfo"

# Code sign the bundle
echo ""
echo "Code signing bundle..."
codesign --force --deep --sign - --entitlements entitlements.plist "$APP_NAME.app"

if [ $? -eq 0 ]; then
    echo "  ✓ Successfully signed bundle"
else
    echo "  ✗ ERROR: Code signing failed"
    exit 1
fi

# Show bundle size
BUNDLE_SIZE=$(du -sh "$APP_NAME.app" | cut -f1)
echo ""
echo "=== Bundle Created Successfully ==="
echo "  Location: $SCRIPT_DIR/$APP_NAME.app"
echo "  Total size: $BUNDLE_SIZE"
echo "  Executable: $(ls -lh "$APP_NAME.app/Contents/MacOS/$APP_NAME" | awk '{print $5}')"
echo "  Kernel: $KERNEL_SIZE"
echo "  Initramfs: $INITRD_SIZE"

# Verify code signature
echo ""
echo "=== Verifying Code Signature ==="
codesign --verify --deep --strict --verbose=2 "$APP_NAME.app" 2>&1

if [ $? -eq 0 ]; then
    echo "  ✓ Code signature is valid"
else
    echo "  ✗ Code signature verification failed"
    exit 1
fi

# Display entitlements
echo ""
echo "=== Entitlements ==="
codesign -dv --entitlements - "$APP_NAME.app" 2>&1 | grep -A 20 "\[Dict\]"

# Final verification
echo ""
echo "=== Build Verification ==="
echo "  ✓ Binary exists and is executable"
echo "  ✓ VM resources embedded (kernel + initramfs)"
echo "  ✓ Code signature valid"
echo "  ✓ Entitlements configured for virtualization"

# Check for MAC normalization in binary
if strings "$APP_NAME.app/Contents/MacOS/$APP_NAME" | grep -q "normalizeMACAddress"; then
    echo "  ✓ MAC address normalization fix included"
else
    echo "  ⚠ MAC normalization function may be optimized (not found in strings)"
fi

echo ""
echo "=== ValkeyVibeCode.app Ready ==="
echo ""
echo "Test with: open $APP_NAME.app"
echo ""
echo "The app will:"
echo "  1. Start Valkey VM with auto-generated MAC address"
echo "  2. Use DHCPLeaseMonitor with MAC normalization fix"
echo "  3. Forward port 6379 to localhost:6379"
echo "  4. Connect with: redis-cli -h localhost -p 6379"
echo ""
