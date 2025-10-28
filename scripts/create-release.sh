#!/bin/bash

# VibeCode Release Script
# Creates a GitHub release with DMG and App bundle

set -e

# Configuration
REPO_OWNER="studio"
REPO_NAME="vibecode-webgui"
VERSION=${1:-"v1.0.0"}
RELEASE_NAME="VibeCode $VERSION"

echo "🚀 Creating release: $RELEASE_NAME"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Run this script from the project root directory"
    exit 1
fi

# Check if DMG exists
DMG_PATH="src-tauri/target/release/bundle/dmg/VibeCode_0.1.0_aarch64.dmg"
APP_PATH="src-tauri/target/release/bundle/macos/VibeCode.app"

if [ ! -f "$DMG_PATH" ]; then
    echo "❌ Error: DMG not found at $DMG_PATH"
    echo "Run 'npm run tauri:build' first"
    exit 1
fi

if [ ! -d "$APP_PATH" ]; then
    echo "❌ Error: App bundle not found at $APP_PATH"
    echo "Run 'npm run tauri:build' first"
    exit 1
fi

# Create release directory
RELEASE_DIR="release-artifacts"
mkdir -p "$RELEASE_DIR"

# Copy artifacts
echo "📦 Copying artifacts..."
cp "$DMG_PATH" "$RELEASE_DIR/VibeCode-$VERSION.dmg"
cp -R "$APP_PATH" "$RELEASE_DIR/VibeCode-$VERSION.app"

# Create release notes
cat > "$RELEASE_DIR/RELEASE_NOTES.md" << EOF
# VibeCode $VERSION

## 🚀 What's New
- Professional VS Code development environment
- Cross-platform desktop application  
- Automatic code-server integration
- Clean Dark+ theme with no welcome screens

## 📦 Downloads

### macOS
- **DMG Installer**: \`VibeCode-$VERSION.dmg\` - Drag and drop installation
- **App Bundle**: \`VibeCode-$VERSION.app\` - Direct application bundle

## 🛠️ Installation

### macOS DMG Installation
1. Download \`VibeCode-$VERSION.dmg\`
2. Double-click to mount the disk image
3. Drag VibeCode to your Applications folder
4. Launch from Applications or Spotlight search

### macOS App Bundle Installation
1. Download \`VibeCode-$VERSION.app\`
2. Move to Applications folder
3. Launch directly

## ✨ Features
- 🎨 Professional VS Code interface
- 🌙 Dark theme optimized for coding
- 🚀 Instant startup with pre-configured workspace
- 🔧 Full VS Code extension support
- 📁 Automatic workspace loading
- 🖥️ Native desktop application experience

## 🐛 Bug Reports
Please report issues on our GitHub Issues page.

## 📄 License
This project is licensed under the MIT License.
EOF

echo "✅ Release artifacts created in $RELEASE_DIR/"
echo ""
echo "📋 Next steps:"
echo "1. Test the DMG installer: open $RELEASE_DIR/VibeCode-$VERSION.dmg"
echo "2. Test the App bundle: open $RELEASE_DIR/VibeCode-$VERSION.app"
echo "3. Create GitHub release manually or push a tag to trigger automated release"
echo ""
echo "🔗 To create a GitHub release:"
echo "gh release create $VERSION \\"
echo "  --title \"$RELEASE_NAME\" \\"
echo "  --notes-file $RELEASE_DIR/RELEASE_NOTES.md \\"
echo "  $RELEASE_DIR/VibeCode-$VERSION.dmg \\"
echo "  $RELEASE_DIR/VibeCode-$VERSION.app"
