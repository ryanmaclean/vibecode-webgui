# Installation Instructions - VibeCode v1.5.0

## macOS Installation

### Prerequisites
- macOS 13.0 (Ventura) or later
- Apple Silicon (M1/M2/M3/M4) Mac
- 8GB RAM recommended
- 1GB free disk space

### Download
Visit: https://github.com/ryanmaclean/vibecode-webgui/releases/tag/v1.5.0

**Files available:**
- `VibeCode-v1.5.0-macOS-arm64.dmg` (2-3 MB)
- `VibeCode-v1.5.0-macOS-arm64.app.zip` (5-6 MB)
- `SHA256SUMS.txt` (checksums)

### Verify Download (Recommended)
```bash
# Download checksums
curl -L -O https://github.com/ryanmaclean/vibecode-webgui/releases/download/v1.5.0/SHA256SUMS.txt

# Verify DMG
shasum -a 256 VibeCode-v1.5.0-macOS-arm64.dmg
cat SHA256SUMS.txt | grep dmg

# Verify ZIP
shasum -a 256 VibeCode-v1.5.0-macOS-arm64.app.zip
cat SHA256SUMS.txt | grep zip
```

### Method 1: DMG Installer (Recommended)
1. Download `VibeCode-v1.5.0-macOS-arm64.dmg`
2. Double-click to mount the disk image
3. Drag `VibeCode.app` to the Applications folder
4. Eject the DMG (drag to trash or right-click → Eject)
5. Open Applications folder
6. **Right-click** `VibeCode.app` → **Open**
7. Click "Open" on Gatekeeper warning (first time only)

### Method 2: ZIP Archive
```bash
# Download
curl -L -o VibeCode.app.zip \
  https://github.com/ryanmaclean/vibecode-webgui/releases/download/v1.5.0/VibeCode-v1.5.0-macOS-arm64.app.zip

# Extract
unzip VibeCode.app.zip

# Install
mv VibeCode.app /Applications/

# Remove quarantine (alternative to right-click → Open)
xattr -d com.apple.quarantine /Applications/VibeCode.app

# Launch
open /Applications/VibeCode.app
```

### Post-Installation
1. **First Launch:** App creates `~/.vibecode` directory
2. **Permissions:** May prompt for file/folder access - click Allow
3. **Configuration:** Preferences → AI Providers to add API keys

---

## Linux Installation (Coming Soon)

Support for Linux (Ubuntu, Fedora, Arch) is planned for v1.6.0.

Expected formats:
- `.deb` (Debian/Ubuntu)
- `.rpm` (Fedora/RHEL)
- `.AppImage` (Universal)
- `.tar.gz` (Manual)

---

## Windows Installation (Coming Soon)

Support for Windows 10/11 is planned for v1.7.0.

Expected formats:
- `.msi` (Windows Installer)
- `.exe` (Portable)

---

## Uninstallation

### macOS
```bash
# Remove application
rm -rf /Applications/VibeCode.app

# Remove configuration (optional)
rm -rf ~/.vibecode

# Remove VM images (optional)
rm -rf ~/Library/Application\ Support/com.vibecode.app/vms
```

### Keeping Configuration
To reinstall while keeping settings, only remove the app:
```bash
rm -rf /Applications/VibeCode.app
# Config in ~/.vibecode will be preserved
```

---

## Troubleshooting Installation

### "App is damaged and can't be opened"
**Cause:** Gatekeeper protection (unsigned app)
**Fix:**
```bash
xattr -d com.apple.quarantine /Applications/VibeCode.app
```
Or: Right-click → Open (instead of double-clicking)

### "App can't be opened because Apple cannot check it"
**Cause:** First launch of unsigned app
**Fix:** System Preferences → Security & Privacy → Click "Open Anyway"

### DMG Won't Mount
**Cause:** Corrupted download
**Fix:**
1. Delete the .dmg file
2. Clear browser cache
3. Re-download from GitHub
4. Verify checksum matches SHA256SUMS.txt

### Installation Fails
**Cause:** Insufficient permissions
**Fix:**
```bash
# Check if Applications folder is writable
ls -ld /Applications
# Should show: drwxrwxr-x

# If not, repair permissions
sudo chmod 775 /Applications
```

---

## Upgrading from Previous Versions

### From v1.0.0 - v1.4.x
```bash
# 1. Backup configuration
cp -r ~/.vibecode ~/.vibecode.backup

# 2. Remove old app
rm -rf /Applications/VibeCode.app

# 3. Install v1.5.0 (follow instructions above)

# 4. Configuration will migrate automatically
```

### Breaking Changes in v1.5.0
- None - v1.5.0 is backward compatible

---

## Development Installation

### Build from Source
```bash
# Clone repository
git clone https://github.com/ryanmaclean/vibecode-webgui.git
cd vibecode-webgui

# Install dependencies
npm install --legacy-peer-deps

# Build Tauri app
npm run tauri build

# App location
open src-tauri/target/release/bundle/macos/VibeCode.app
```

### Development Mode
```bash
# Run in development
npm run tauri dev
```

---

## Platform-Specific Details

### macOS Features
- **Apple Virtualization Framework** - Native VM support
- **Touch ID** - Biometric authentication (coming soon)
- **Keychain Integration** - Secure API key storage
- **Native Menu Bar** - macOS-style menus

### System Integration
- **Spotlight Search** - Find VibeCode quickly
- **Dock Integration** - Native dock icon and badge
- **File Associations** - Open code files directly
- **Notifications** - Native macOS notifications

---

## Environment Variables

### Optional Configuration
Create a `.env` file in `~/.vibecode/` or set system-wide:

```bash
# AI Provider API Keys
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
OPENROUTER_API_KEY=sk-or-v1-...

# Datadog (Optional)
DD_API_KEY=your_datadog_api_key
DD_SITE=datadoghq.com

# Application Settings
NEXT_TELEMETRY_DISABLED=1
NODE_ENV=production
PORT=3000
```

### Setting Environment Variables (macOS)
```bash
# Add to ~/.zshrc or ~/.bashrc
echo 'export OPENAI_API_KEY="sk-..."' >> ~/.zshrc
source ~/.zshrc
```

---

## Security Considerations

### Gatekeeper and Code Signing
VibeCode v1.5.0 is **not code-signed** with an Apple Developer certificate. This means:
- First launch requires right-click → Open
- Or remove quarantine attribute manually
- Future versions will include proper code signing

### Permissions Required
VibeCode requests these permissions:
- **File System Access** - To read/write project files
- **Network Access** - For AI API calls
- **VM Management** - For Apple Virtualization Framework (macOS only)

### API Key Security
- API keys stored in macOS Keychain (encrypted)
- Never committed to version control
- Can be revoked/rotated anytime in settings

---

## Disk Space Requirements

### Base Installation
- **App Bundle:** ~200-500 MB
- **Configuration:** ~10-50 MB
- **Cache:** ~100-500 MB

### VM Images (Optional)
Each VM requires:
- **vibecode-postgresql:** 10 GB
- **vibecode-nodejs:** 50 GB
- **vibecode-nodejs-codeserver:** 50 GB
- **vibecode-pgvector:** 20 GB
- **vibecode-valkey:** 10 GB
- **vibecode-ide:** 50 GB

**Total for all VMs:** ~190 GB

### Cache and Logs
- **Monaco Editor Cache:** ~50-100 MB
- **Application Logs:** ~10-50 MB (rotated automatically)
- **AI Response Cache:** ~50-200 MB

---

## Network Requirements

### Required Connections
- **github.com** - Download releases and updates
- **api.openai.com** - OpenAI API (if configured)
- **api.anthropic.com** - Anthropic API (if configured)
- **api.openrouter.ai** - OpenRouter API (if configured)

### Optional Connections
- **datadoghq.com** - Datadog monitoring (if enabled)
- **open-vsx.org** - VS Code extensions (future feature)

### Firewall Configuration
VibeCode runs local servers:
- **Port 3000** - Main application (internal)
- **Port 8080** - OpenVSCode Server (internal)
- **Port 9090** - Prometheus metrics (optional)

No inbound connections required unless accessing monitoring endpoints.

---

## Installation Verification

### Verify Installation
```bash
# Check app exists
ls -lh /Applications/VibeCode.app

# Check configuration directory
ls -lh ~/.vibecode

# Check app can launch
open -a VibeCode --args --version
```

### Verify VM Support (macOS)
```bash
# Check macOS version (must be 13.0+)
sw_vers

# Output should show:
# ProductName:    macOS
# ProductVersion: 13.0 or higher
```

### Verify Network Connectivity
```bash
# Test GitHub access
curl -I https://github.com

# Test OpenAI API (if configured)
curl -I https://api.openai.com

# Test OpenRouter API (if configured)
curl -I https://api.openrouter.ai
```

---

## Common Installation Issues

### Issue: "Code signature invalid"
**Solution:**
```bash
codesign --remove-signature /Applications/VibeCode.app
xattr -cr /Applications/VibeCode.app
```

### Issue: "Insufficient disk space"
**Solution:**
- Free up disk space (need 1GB minimum)
- Or install to external drive
- Skip VM downloads initially

### Issue: "Permission denied"
**Solution:**
```bash
# Fix permissions
sudo chown -R $(whoami):staff /Applications/VibeCode.app
chmod -R u+rwx /Applications/VibeCode.app
```

### Issue: App crashes on launch
**Solution:**
1. Check Console.app for crash logs
2. Remove configuration: `rm -rf ~/.vibecode`
3. Reinstall the app
4. Report issue on GitHub with crash log

---

## Release Checksums

Verify your download integrity by comparing checksums:

```bash
# Download checksum file
curl -L -O https://github.com/ryanmaclean/vibecode-webgui/releases/download/v1.5.0/SHA256SUMS.txt

# Compute checksum of downloaded file
shasum -a 256 VibeCode-v1.5.0-macOS-arm64.dmg

# Compare with published checksum
cat SHA256SUMS.txt
```

Checksums published in release notes at:
https://github.com/ryanmaclean/vibecode-webgui/releases/tag/v1.5.0

---

For more help, visit:
- **GitHub Discussions:** https://github.com/ryanmaclean/vibecode-webgui/discussions
- **GitHub Issues:** https://github.com/ryanmaclean/vibecode-webgui/issues
- **Quick Start Guide:** [QUICKSTART.md](./QUICKSTART.md)
- **User Guide:** [USER_GUIDE.md](./USER_GUIDE.md)
