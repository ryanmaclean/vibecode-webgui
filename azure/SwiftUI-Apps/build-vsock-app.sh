#!/bin/bash
# Build script for Vsock-enabled VibeCode SwiftUI app

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AZURE_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_NAME="VsockVibeCode"

echo "=== Building Vsock VibeCode App ==="
echo "Script dir: $SCRIPT_DIR"
echo "Azure dir: $AZURE_DIR"
echo ""

# Step 1: Build the vsock initramfs
echo "Step 1: Building vsock initramfs..."
cd "$AZURE_DIR"

if [ ! -f "bun-openvscode.cpio.gz" ]; then
    echo "ERROR: Original initramfs bun-openvscode.cpio.gz not found!"
    echo "Please ensure it exists in $AZURE_DIR"
    exit 1
fi

# Extract original initramfs
echo "Extracting original initramfs..."
rm -rf vsock-initramfs-build
mkdir -p vsock-initramfs-build
cd vsock-initramfs-build

gzip -dc ../bun-openvscode.cpio.gz | cpio -idmv 2>&1 | head -20
echo "..."

# Replace init script with vsock version
echo ""
echo "Replacing init script with vsock version..."
cp "$SCRIPT_DIR/vm-init-vsock.sh" ./init
chmod +x ./init

echo "Verifying init script..."
ls -la ./init
head -5 ./init

# Rebuild initramfs
echo ""
echo "Rebuilding initramfs with vsock init..."
find . | cpio -o -H newc 2>/dev/null | gzip -9 > ../bun-openvscode-vsock.cpio.gz

cd "$AZURE_DIR"
rm -rf vsock-initramfs-build

echo "Vsock initramfs created:"
ls -lh bun-openvscode-vsock.cpio.gz

# Step 2: Create Xcode project structure
echo ""
echo "Step 2: Setting up Xcode project..."
cd "$SCRIPT_DIR"

# Create project directory
PROJECT_DIR="$SCRIPT_DIR/$PROJECT_NAME"
mkdir -p "$PROJECT_DIR"

# Copy Swift file
echo "Copying Swift source..."
cp VsockVibeCodeApp.swift "$PROJECT_DIR/main.swift"

# Create Info.plist
echo "Creating Info.plist..."
cat > "$PROJECT_DIR/Info.plist" << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleDevelopmentRegion</key>
    <string>en</string>
    <key>CFBundleExecutable</key>
    <string>$(EXECUTABLE_NAME)</string>
    <key>CFBundleIdentifier</key>
    <string>com.vibecode.vsock</string>
    <key>CFBundleInfoDictionaryVersion</key>
    <string>6.0</string>
    <key>CFBundleName</key>
    <string>$(PRODUCT_NAME)</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0</string>
    <key>CFBundleVersion</key>
    <string>1</string>
    <key>LSMinimumSystemVersion</key>
    <string>11.0</string>
    <key>NSPrincipalClass</key>
    <string>NSApplication</string>
    <key>NSMainStoryboardFile</key>
    <string>Main</string>
</dict>
</plist>
EOF

# Step 3: Create Resources directory and copy files
echo ""
echo "Step 3: Preparing resources..."
mkdir -p "$PROJECT_DIR/Resources"

if [ -f "$AZURE_DIR/vmlinux-raw" ]; then
    echo "Copying kernel (vmlinux-raw)..."
    cp "$AZURE_DIR/vmlinux-raw" "$PROJECT_DIR/Resources/"
else
    echo "WARNING: vmlinux-raw not found in $AZURE_DIR"
fi

if [ -f "$AZURE_DIR/bun-openvscode-vsock.cpio.gz" ]; then
    echo "Copying vsock initramfs..."
    cp "$AZURE_DIR/bun-openvscode-vsock.cpio.gz" "$PROJECT_DIR/Resources/"
else
    echo "ERROR: bun-openvscode-vsock.cpio.gz not found!"
    exit 1
fi

echo "Resources:"
ls -lh "$PROJECT_DIR/Resources/"

# Step 4: Compile Swift app
echo ""
echo "Step 4: Compiling Swift application..."
cd "$PROJECT_DIR"

# Compile
swiftc -o "$PROJECT_NAME" \
    -framework SwiftUI \
    -framework Virtualization \
    -framework Network \
    -target arm64-apple-macos11.0 \
    main.swift

if [ $? -eq 0 ]; then
    echo "Compilation successful!"
    ls -lh "$PROJECT_NAME"
else
    echo "ERROR: Compilation failed!"
    exit 1
fi

# Step 5: Create app bundle
echo ""
echo "Step 5: Creating application bundle..."
cd "$SCRIPT_DIR"

APP_NAME="$PROJECT_NAME.app"
APP_DIR="$SCRIPT_DIR/$APP_NAME"

# Remove old bundle
rm -rf "$APP_DIR"

# Create bundle structure
mkdir -p "$APP_DIR/Contents/MacOS"
mkdir -p "$APP_DIR/Contents/Resources"

# Copy executable
cp "$PROJECT_DIR/$PROJECT_NAME" "$APP_DIR/Contents/MacOS/"

# Copy resources
cp "$PROJECT_DIR/Resources/"* "$APP_DIR/Contents/Resources/"

# Copy Info.plist
cp "$PROJECT_DIR/Info.plist" "$APP_DIR/Contents/"

# Make executable
chmod +x "$APP_DIR/Contents/MacOS/$PROJECT_NAME"

echo ""
echo "=== Build Complete ==="
echo ""
echo "Application bundle: $APP_DIR"
echo "Size:"
ls -lh "$APP_DIR/Contents/MacOS/$PROJECT_NAME"
echo ""
echo "Resources:"
ls -lh "$APP_DIR/Contents/Resources/"
echo ""
echo "To run the app:"
echo "  open \"$APP_DIR\""
echo ""
echo "Or run directly:"
echo "  \"$APP_DIR/Contents/MacOS/$PROJECT_NAME\""
echo ""
echo "Test connection:"
echo "  1. Click 'Start' in the app"
echo "  2. Wait for 'Proxy active' status"
echo "  3. curl http://localhost:3000"
echo "  4. Open http://localhost:3000 in browser"
echo ""
