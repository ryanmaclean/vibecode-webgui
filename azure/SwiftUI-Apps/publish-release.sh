#!/bin/bash
#
# publish-release.sh - Publish DMG to GitHub Release
#
# Usage: ./publish-release.sh <version>
# Example: ./publish-release.sh 4.1.1
#

set -e

if [ -z "$1" ]; then
    echo "Usage: $0 <version>"
    echo "Example: $0 4.1.1"
    exit 1
fi

VERSION="$1"
DMG_FILE="VibeCode-Unified-v${VERSION}.dmg"
DMG_PATH="/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/${DMG_FILE}"

cd "$(dirname "$0")"

echo "========================================"
echo "  Publishing v${VERSION} to GitHub"
echo "========================================"
echo ""

# Verify DMG exists
if [ ! -f "$DMG_PATH" ]; then
    echo "❌ Error: DMG not found at $DMG_PATH"
    echo ""
    echo "Build the DMG first:"
    echo "  ./build-release.sh $VERSION"
    exit 1
fi

echo "📦 DMG Details:"
ls -lh "$DMG_PATH"
echo ""
echo "🔐 SHA256: $(shasum -a 256 "$DMG_PATH" | cut -d' ' -f1)"
echo ""

# Confirm before uploading
read -p "Upload to GitHub release v${VERSION}? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 1
fi

# Check if release exists
echo ""
echo "Checking if release v${VERSION} exists..."
if gh release view "v${VERSION}" >/dev/null 2>&1; then
    echo "✓ Release v${VERSION} exists"
else
    echo "❌ Release v${VERSION} does not exist"
    echo ""
    read -p "Create release v${VERSION}? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Creating release v${VERSION}..."
        gh release create "v${VERSION}" \
            --title "v${VERSION}" \
            --notes "Release v${VERSION} - See release notes for details"
    else
        echo "Cancelled."
        exit 1
    fi
fi

# Upload to GitHub release
echo ""
echo "⬆️  Uploading to GitHub release v${VERSION}..."
gh release upload "v${VERSION}" "$DMG_PATH" --clobber

echo ""
echo "✅ Published successfully!"
echo ""
echo "📋 Release URL: https://github.com/ryanmaclean/vibecode-webgui/releases/tag/v${VERSION}"
echo ""
echo "🎉 v${VERSION} is now live!"
echo ""
