#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"


# VibeCode ARD Deployment Script
# Deploys unsigned PKG to remote Macs via Apple Remote Desktop

# Initialize log aggregation
init_log_aggregation


set -e

echo "🚀 VibeCode ARD Deployment"
echo "========================"
echo ""

# Configuration
PKG_FILE="dist-pkg/VibeCode-1.2.0.pkg"
ARD_SCRIPT="dist-pkg/ard-install.sh"

# Check if PKG exists
if [ ! -f "$PKG_FILE" ]; then
    echo "❌ Error: $PKG_FILE not found!"
    echo "Run PKG build first"
    exit 1
fi

echo "📦 PKG Information:"
echo "   File: $PKG_FILE"
echo "   Size: $(du -h "$PKG_FILE" | cut -f1)"
echo "   Status: Unsigned (will use -allowUntrusted flag)"
echo ""

# Create ARD installation script
echo "📜 Creating ARD installation script..."
cat > "$ARD_SCRIPT" << 'EOF'
#!/bin/bash

# VibeCode ARD Installation Script
# Run this script on remote Macs via Apple Remote Desktop

set -e

PKG_FILE="VibeCode-1.2.0.pkg"
LOG_FILE="/tmp/vibecode-ard-install.log"

echo "🚀 VibeCode ARD Installation on $(hostname)..." | tee "$LOG_FILE"
echo "Date: $(date)" | tee -a "$LOG_FILE"
echo "User: $(whoami)" | tee -a "$LOG_FILE"
echo "OS: $(sw_vers -productName) $(sw_vers -productVersion)" | tee -a "$LOG_FILE"

# Check if PKG file exists
if [ ! -f "$PKG_FILE" ]; then
    echo "❌ Error: $PKG_FILE not found!" | tee -a "$LOG_FILE"
    echo "Make sure to copy the PKG file to this Mac first" | tee -a "$LOG_FILE"
    exit 1
fi

# Install the package (unsigned, requires -allowUntrusted)
echo "📦 Installing VibeCode package (unsigned)..." | tee -a "$LOG_FILE"
if sudo installer -pkg "$PKG_FILE" -target / -allowUntrusted 2>&1 | tee -a "$LOG_FILE"; then
    echo "✅ Installation successful!" | tee -a "$LOG_FILE"
else
    echo "❌ Installation failed!" | tee -a "$LOG_FILE"
    exit 1
fi

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
    
    # Test launching
    echo "🚀 Testing app launch..." | tee -a "$LOG_FILE"
    if open /Applications/VibeCode.app 2>&1 | tee -a "$LOG_FILE"; then
        echo "✅ App launched successfully!" | tee -a "$LOG_FILE"
    else
        echo "⚠️  App launch failed" | tee -a "$LOG_FILE"
    fi
    
else
    echo "❌ Installation verification failed!" | tee -a "$LOG_FILE"
    exit 1
fi

echo "🎉 Installation complete on $(hostname)!" | tee -a "$LOG_FILE"
echo "📁 Log file: $LOG_FILE" | tee -a "$LOG_FILE"
EOF

chmod +x "$ARD_SCRIPT"

# Create ARD deployment guide
echo "📖 Creating ARD deployment guide..."
cat > "dist-pkg/ARD-DEPLOYMENT-GUIDE.md" << 'EOF'
# VibeCode ARD Deployment Guide

## Overview
This guide explains how to deploy VibeCode to remote Macs using Apple Remote Desktop (ARD) with an unsigned PKG.

## Files Included
- `VibeCode-1.2.0.pkg` - Unsigned PKG installer (5.1 MB)
- `ard-install.sh` - ARD installation script
- `ARD-DEPLOYMENT-GUIDE.md` - This guide

## ARD Deployment Steps

### Step 1: Copy Files to Target Macs
1. Open Apple Remote Desktop
2. Select target Macs
3. Choose "Send Items" → "Files"
4. Select both files:
   - `VibeCode-1.2.0.pkg`
   - `ard-install.sh`
5. Choose destination: `/tmp/`
6. Click "Send"

### Step 2: Run Installation Script
1. In ARD, select target Macs
2. Choose "Send Unix Command"
3. Enter command:
   ```bash
   cd /tmp && chmod +x ard-install.sh && ./ard-install.sh
   ```
4. Click "Send"

### Step 3: Verify Installation
1. In ARD, select target Macs
2. Choose "Send Unix Command"
3. Enter command:
   ```bash
   ls -la /Applications/VibeCode.app && \
   lipo -info /Applications/VibeCode.app/Contents/MacOS/vibecode && \
   echo "Installation successful!"
   ```
4. Click "Send"

## Alternative: Direct PKG Installation

### Via ARD Package Installer
1. In ARD, select target Macs
2. Choose "Send Items" → "Packages"
3. Select `VibeCode-1.2.0.pkg`
4. Choose "Install" as the action
5. **Important**: Add `-allowUntrusted` flag in advanced options
6. Execute the task

### Manual Installation
On each target Mac:
```bash
sudo installer -pkg /tmp/VibeCode-1.2.0.pkg -target / -allowUntrusted
```

## Troubleshooting

### Installation Fails
- Check log file: `/tmp/vibecode-ard-install.log`
- Verify PKG file exists: `ls -la /tmp/VibeCode-1.2.0.pkg`
- Try manual installation with `-allowUntrusted` flag

### App Won't Launch
- Check if code-server is running: `lsof -i :8080`
- Check app permissions: `ls -la /Applications/VibeCode.app`
- Try launching from terminal: `open /Applications/VibeCode.app`

### Architecture Issues
- Verify Universal2 binary: `lipo -info /Applications/VibeCode.app/Contents/MacOS/vibecode`
- Should show: `x86_64 arm64`

## Requirements
- macOS 10.13 or later
- Admin privileges for installation
- Universal2 binary supports both Intel and Apple Silicon
- Unsigned PKG requires `-allowUntrusted` flag

## Security Note
The PKG is unsigned for testing purposes. For production deployment, consider:
1. Signing with Apple Developer certificate
2. Using self-signed certificate with proper trust setup
3. Deploying via MDM with proper certificate management
EOF

echo "✅ ARD Deployment Package Ready!"
echo "================================"
echo ""
echo "📦 Files ready for ARD deployment:"
echo "   • $PKG_FILE (unsigned PKG)"
echo "   • $ARD_SCRIPT (installation script)"
echo "   • dist-pkg/ARD-DEPLOYMENT-GUIDE.md (deployment guide)"
echo ""
echo "🚀 Next steps:"
echo "   1. Open Apple Remote Desktop"
echo "   2. Select target Macs"
echo "   3. Send files: $PKG_FILE and $ARD_SCRIPT"
echo "   4. Run installation script: ./ard-install.sh"
echo "   5. Verify installation"
echo ""
echo "⚠️  Note: Unsigned PKG requires -allowUntrusted flag"
echo "   This is handled automatically in the installation script"
