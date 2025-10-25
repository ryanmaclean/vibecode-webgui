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
