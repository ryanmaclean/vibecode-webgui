# VibeCode Unified Services v3.3.0 - Installation Guide

## Quick Installation

### Step 1: Download
Download `VibeCode-Unified-v3.3.0-FINAL-COMPLETE.dmg` (133 MB) from the GitHub release page.

### Step 2: Verify Checksums (Optional but Recommended)
```bash
md5 VibeCode-Unified-v3.3.0-FINAL-COMPLETE.dmg
# Should output: c8cf116c79235cff9f234fa80393f930

shasum -a 256 VibeCode-Unified-v3.3.0-FINAL-COMPLETE.dmg
# Should output: a4f2c535d36924bcc15226117e6cd48fffde4f63463af55027fb8d5f8d98ee8d
```

### Step 3: Mount the DMG
Double-click the DMG file to mount it. A Finder window will open.

### Step 4: Install
Drag `VibeCode Unified Services.app` to your Applications folder.

### Step 5: First Launch
**Important**: Since the app uses adhoc code signing, you must:
1. Navigate to Applications folder
2. Right-click (or Control-click) on "VibeCode Unified Services"
3. Select "Open" from the context menu
4. Click "Open" in the security dialog

### Step 6: Wait for Boot
First boot takes 2-3 minutes to:
- Initialize VM
- Configure networking
- Start all services
- Set up port forwarding

### Step 7: Access Services
Once booted, services are available on localhost:

- **OpenVSCode**: http://localhost:8080
- **Valkey**: localhost:6379
- **PostgreSQL**: localhost:5432
- **SSH**: localhost:2222

## System Requirements

### Minimum Requirements
- **OS**: macOS 14.0 (Sonoma) or later
- **Architecture**: Apple Silicon (ARM64)
- **RAM**: 4GB
- **Disk Space**: 500MB free
- **Network**: Internet connection (for initial setup)

### Recommended Requirements
- **OS**: macOS 15.0 (Sequoia) or later
- **RAM**: 8GB or more
- **Disk Space**: 1GB free

## Verifying Installation

### Check App is Running
Look for the menubar icon (top-right of screen) labeled "VibeCode".

### Test OpenVSCode
```bash
open http://localhost:8080
```
Should open OpenVSCode in your default browser.

### Test Valkey
```bash
redis-cli -p 6379 ping
# Should respond: PONG
```

### Test PostgreSQL
```bash
psql -h localhost -p 5432 -U postgres
# Password: (press Enter, no password required)
# Should connect to PostgreSQL prompt
```

### Test SSH
```bash
ssh -p 2222 root@localhost
# Password: vibecode
# Should connect to VM shell
```

## Troubleshooting

### App Won't Open
**Problem**: "App is damaged and can't be opened"
**Solution**: 
1. Use right-click → Open method (not double-click)
2. If still blocked, run:
```bash
xattr -cr "/Applications/VibeCode Unified Services.app"
```

### Services Not Accessible
**Problem**: Can't connect to localhost ports
**Solution**:
1. Wait 2-3 minutes after launch
2. Check menubar for "Services Ready" status
3. Restart the app if needed

### Slow Boot Time
**Problem**: Takes longer than 3 minutes
**Solution**:
- Normal on first boot
- Check Activity Monitor for high CPU usage
- Ensure adequate RAM available
- Close other resource-intensive apps

### Port Already in Use
**Problem**: "Port 8080 already in use"
**Solution**:
1. Find conflicting process:
```bash
lsof -i :8080
```
2. Stop conflicting service or change VibeCode port in config

## Uninstallation

### Remove Application
```bash
rm -rf "/Applications/VibeCode Unified Services.app"
```

### Remove Support Files
```bash
rm -rf ~/Library/Application\ Support/VibeCode
rm -rf ~/Library/Caches/com.vibecode.unified
```

### Remove Logs
```bash
rm -rf ~/Library/Logs/VibeCode
```

## Advanced Configuration

### Custom Ports
Edit configuration file at:
```
~/Library/Application Support/VibeCode/config.json
```

### Enable Debug Logging
Add to config.json:
```json
{
  "debug": true,
  "logLevel": "verbose"
}
```

### Resource Limits
Adjust VM memory in config.json:
```json
{
  "vm": {
    "memory": "4GB",
    "cpus": 4
  }
}
```

## Getting Help

- **Issues**: https://github.com/yourusername/vibecode-webgui/issues
- **Discussions**: https://github.com/yourusername/vibecode-webgui/discussions
- **Documentation**: https://github.com/yourusername/vibecode-webgui/wiki

## What's Next

After installation, try:
1. Open OpenVSCode and create a project
2. Connect to PostgreSQL and create a database
3. Use Valkey for caching
4. SSH into the VM for advanced configuration

See RELEASE_NOTES_v3.3.0.md for full feature list.

---

**Version**: 3.3.0  
**Release Date**: January 13, 2026  
**Commit**: 4f2a643ec2a0799073c1e6f1a17403ca0cc599d4
