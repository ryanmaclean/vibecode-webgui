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
