# VibeCode Unified v3.2.1 - Installation Guide

**Version**: 3.2.1
**Release Date**: January 14, 2026
**Platform**: macOS 13.0+ (Apple Silicon M1/M2/M3/M4)

---

## Table of Contents

1. [System Requirements](#system-requirements)
2. [Pre-Installation](#pre-installation)
3. [Installation Steps](#installation-steps)
4. [First Launch](#first-launch)
5. [Verification](#verification)
6. [Accessing Services](#accessing-services)
7. [Troubleshooting](#troubleshooting)
8. [Uninstallation](#uninstallation)

---

## System Requirements

### Minimum Requirements

| Requirement | Minimum | Recommended |
|-------------|---------|-------------|
| **macOS Version** | 13.0 (Ventura) | 14.0+ (Sonoma) |
| **CPU** | Apple Silicon M1 | M2/M3/M4+ |
| **RAM** | 4 GB | 8 GB |
| **Disk Space** | 2 GB free | 5 GB free |
| **Network** | Not required | Not required |

### Not Supported

- **Intel Macs**: Requires Apple Silicon (M1, M2, M3, M4, etc.)
- **Older macOS**: Requires macOS 13.0 (Ventura) or later
- **iOS/iPadOS**: Mac application only

### Check Your System

To verify your Mac is compatible:

```bash
# Check macOS version
sw_vers

# Expected output: macOS 13.0 or higher

# Check processor
sysctl -n machdep.cpu.brand_string

# Expected output: Contains "Apple M1", "M2", "M3", etc.

# Check available RAM
system_profiler SPMemoryDataType | grep "Memory:"

# Should show 4GB+ (8GB+ recommended)

# Check disk space
df -h / | grep -v Filesystem

# Should show at least 2GB available in "Available" column
```

---

## Pre-Installation

### Step 1: Download the DMG File

**File Name**: `VibeCode-Unified-v3.2.1-Datadog.dmg`
**Size**: 253 MB
**SHA256**: `837a77f0c5f39873245d89d3449986590a8586759ecfcf1dae8499711aaa9aff`

**Download Options**:

1. **From GitHub Releases** (Recommended)
   - Visit GitHub Releases page
   - Find v3.2.1 release
   - Download the DMG file
   - Save to `~/Downloads/` or preferred location

2. **Via Command Line**
   ```bash
   cd ~/Downloads
   # Download link would be provided in release notes
   ```

### Step 2: Verify File Integrity (Optional but Recommended)

Verifying the checksum ensures the file wasn't corrupted during download:

```bash
# Navigate to download directory
cd ~/Downloads

# Calculate SHA256 checksum
shasum -a 256 VibeCode-Unified-v3.2.1-Datadog.dmg

# Expected output:
# 837a77f0c5f39873245d89d3449986590a8586759ecfcf1dae8499711aaa9aff  VibeCode-Unified-v3.2.1-Datadog.dmg

# If checksums match:
echo "✅ File is valid and ready to install"

# If checksums don't match:
echo "❌ File is corrupted. Please re-download."
```

### Step 3: Check Available Applications Folder

Ensure you have space in the Applications folder:

```bash
# Check Applications folder
ls -la /Applications | head -5

# Check free space
df -h /Applications

# If using external drive, verify it has 2GB+ free
```

---

## Installation Steps

### Method 1: GUI Installation (Easiest)

**Step 1: Mount the DMG**
1. Open Finder
2. Navigate to Downloads folder
3. Double-click `VibeCode-Unified-v3.2.1-Datadog.dmg`
4. Wait for DMG to mount (appears as "VibeCode Unified" on desktop)

**Step 2: Open DMG Window**
- A Finder window opens showing the DMG contents
- You should see `UnifiedServicesVibeCodeApp.app`

**Step 3: Copy App to Applications**
1. Drag `UnifiedServicesVibeCodeApp.app` to the Applications folder (shown in sidebar)
2. Or right-click app → "Copy"
3. Navigate to Applications folder
4. Right-click → "Paste"
5. Wait for copy to complete (~30 seconds)

**Step 4: Eject the DMG**
1. In Finder, click the eject icon next to "VibeCode Unified" in sidebar
2. Or right-click on desktop "VibeCode Unified" → Eject
3. Verify desktop no longer shows the mounted volume

**Step 5: Launch the Application**
1. Open Applications folder
2. Find `UnifiedServicesVibeCodeApp.app`
3. Double-click to launch
4. If security prompt appears: "Right-click → Open → Open" button

**Done!** Skip to [First Launch](#first-launch)

### Method 2: Command Line Installation

**Step 1: Mount the DMG**
```bash
hdiutil mount ~/Downloads/VibeCode-Unified-v3.2.1-Datadog.dmg
# Output: /Volumes/VibeCode Unified
```

**Step 2: Copy App to Applications**
```bash
cp -r "/Volumes/VibeCode Unified/UnifiedServicesVibeCodeApp.app" /Applications/
# Or with verbose output:
cp -rv "/Volumes/VibeCode Unified/UnifiedServicesVibeCodeApp.app" /Applications/
```

**Step 3: Verify Installation**
```bash
ls -la /Applications/UnifiedServicesVibeCodeApp.app
# Should show the app bundle with MacOS, Resources, Info.plist
```

**Step 4: Eject the DMG**
```bash
hdiutil eject "/Volumes/VibeCode Unified"
# Output: "VibeCode Unified" ejected successfully
```

**Step 5: Launch the Application**
```bash
open /Applications/UnifiedServicesVibeCodeApp.app
# Or use:
/Applications/UnifiedServicesVibeCodeApp.app/Contents/MacOS/UnifiedServicesVibeCode
```

**Done!** Continue to [First Launch](#first-launch)

### Handling Security Prompts

**First Launch**: macOS may show a security warning.

```
"UnifiedServicesVibeCodeApp cannot be opened because the developer
cannot be verified."
```

**Solution Options**:

**Option 1: Right-Click Open** (Recommended)
1. Close the warning dialog
2. Open Applications folder
3. Find `UnifiedServicesVibeCodeApp.app`
4. Right-click (or Ctrl+click)
5. Select "Open"
6. Click "Open" in the security dialog
7. App launches normally

**Option 2: Command Line Override**
```bash
xattr -d com.apple.quarantine /Applications/UnifiedServicesVibeCodeApp.app
# Then launch normally
open /Applications/UnifiedServicesVibeCodeApp.app
```

**Option 3: Allow in System Settings**
1. Open System Settings
2. Go to Privacy & Security
3. Scroll to "Allow apps downloaded from"
4. Look for "UnifiedServicesVibeCodeApp was blocked..."
5. Click "Open Anyway"
6. Re-launch the app

---

## First Launch

### Initial Startup Process

When you first launch the app, the following happens automatically:

**Phase 1: App Launch** (5-10 seconds)
- Application binary loads
- VM configuration initializes
- System prepares virtualization resources

**Phase 2: Kernel Boot** (15-25 seconds)
- Linux kernel starts
- Hardware devices initialize
- Kernel logs appear in system logs

**Phase 3: Network Setup** (40-80 seconds)
- DHCP IP assignment
- ARP-based detection
- Port forwarding configuration

**Phase 4: Service Startup** (20-40 seconds)
- SSH server (Dropbear) starts
- Valkey/Redis initializes
- PostgreSQL initializes
- OpenVSCode server starts

**Total Time**: ~120 seconds (2 minutes)

### What to Expect

**Menubar Icon** (appears after Phase 1)
- Look for the VibeCode icon in the top-right of your screen
- If you don't see it immediately, wait 10-15 seconds
- The app intentionally doesn't appear in the dock (menubar-only design)

**Menubar Dropdown** (visible after Phase 3)
Click the VibeCode icon to see:
- VM Status (Starting... → Running)
- VM IP Address (appears when network ready)
- Service Status (SSH, Valkey, PostgreSQL, OpenVSCode)
- Quick Actions (Stop VM, Restart, View Logs)

**Console Output**:
If you want to monitor boot process:
```bash
log stream --predicate 'process == "UnifiedServicesVibeCode"' --level debug
```

### Activity During Startup

**Menubar Dropdown Progress**:
```
Initial (0-30 seconds):
├─ VM Status: Starting...
├─ IP Address: Detecting...
└─ Services: Not yet available

Mid-Boot (30-90 seconds):
├─ VM Status: Running
├─ IP Address: 192.168.64.2 ✓
└─ Services:
   ├─ SSH: Connecting...
   ├─ Valkey: Connecting...
   ├─ PostgreSQL: Connecting...
   └─ OpenVSCode: Connecting...

Ready (90-120 seconds):
├─ VM Status: Running ✓
├─ IP Address: 192.168.64.2
└─ Services:
   ├─ SSH: Available ✓
   ├─ Valkey: Available ✓
   ├─ PostgreSQL: Available ✓
   └─ OpenVSCode: Available ✓
```

### First Launch Troubleshooting

**Issue**: Menubar icon doesn't appear
- **Wait**: Takes 5-15 seconds to appear
- **Check**: System Settings → Notifications → allow VibeCode
- **Try**: Restart the app

**Issue**: Services show "Connecting..." for >2 minutes
- **Wait**: Sometimes takes full 2 minutes
- **Restart**: Stop VM from menubar, relaunch app
- **Check**: System memory with `vm_stat`

**Issue**: Some services show "Unavailable"
- **Wait**: Services may start at different times
- **Restart**: Stop and restart the app
- **Check**: System logs for errors (see Troubleshooting section)

---

## Verification

### Quick Verification (2 minutes)

1. **Check Menubar**
   - Click VibeCode icon
   - Should show "VM Status: Running"
   - Should show IP address (192.168.64.2)
   - Should show all services "Available"

2. **Test OpenVSCode** (Easiest service to test)
   ```bash
   curl -s http://localhost:8080 | head -5
   # Should return HTML content starting with <!DOCTYPE
   ```

3. **Done!**
   - If both checks pass, installation is successful

### Comprehensive Verification

Test all four services:

**Test 1: SSH Access**
```bash
ssh root@localhost -p 2222 "echo 'SSH Works!'"
# Expected: SSH Works!
# Password prompt: vibecode
# If first time, confirm host key
```

**Test 2: Valkey/Redis**
```bash
redis-cli -h localhost -p 6379 ping
# Expected: PONG
```

**Test 3: PostgreSQL**
```bash
pg_isready -h localhost -p 5432 -U vibecode
# Expected: localhost:5432 - accepting connections
```

**Test 4: OpenVSCode**
```bash
# Open in browser
open http://localhost:8080

# Or test via curl
curl -I http://localhost:8080 | head -3
# Expected: HTTP/1.1 200 OK
```

**Test 5: Datadog Extension**
```bash
# OpenVSCode should load with Datadog extension in sidebar
# 1. Navigate to http://localhost:8080
# 2. Look for Extensions icon (left sidebar)
# 3. Search for "Datadog"
# 4. Should show: Datadog by Datadog, Inc. (Installed)
```

---

## Accessing Services

### OpenVSCode Server

**Direct Browser Access**:
```bash
open http://localhost:8080
```

**Via Command Line**:
```bash
# Test connection
curl http://localhost:8080

# Open in default browser
open http://localhost:8080

# Open in specific browser
open -a "Google Chrome" http://localhost:8080
open -a "Firefox" http://localhost:8080
open -a "Safari" http://localhost:8080
```

**Datadog Extension**:
1. In OpenVSCode, click Extensions icon (left sidebar)
2. Search for "Datadog"
3. Should show as installed and enabled
4. Use for static code analysis (offline mode)
5. Optionally configure cloud integration with API key

### SSH Access

**Basic Connection**:
```bash
ssh root@localhost -p 2222
# Password: vibecode
```

**Non-Interactive Commands**:
```bash
# Check system info
ssh root@localhost -p 2222 "uname -a"

# List files in VM
ssh root@localhost -p 2222 "ls -la /"

# Check running services
ssh root@localhost -p 2222 "systemctl status"
```

**File Transfer**:
```bash
# Copy file from Mac to VM
scp -P 2222 ~/myfile.txt root@localhost:/tmp/

# Copy file from VM to Mac
scp -P 2222 root@localhost:/tmp/myfile.txt ~/myfile.txt
```

### Valkey/Redis

**Connect via redis-cli**:
```bash
redis-cli -h localhost -p 6379
```

**Common Commands**:
```bash
# Ping server
redis-cli -h localhost -p 6379 ping
# Returns: PONG

# Set key-value
redis-cli -h localhost -p 6379 SET mykey "Hello"

# Get value
redis-cli -h localhost -p 6379 GET mykey

# List keys
redis-cli -h localhost -p 6379 KEYS "*"

# Get info
redis-cli -h localhost -p 6379 INFO
```

**From Application Code**:
```javascript
// Node.js example
const redis = require('redis');
const client = redis.createClient({
  host: 'localhost',
  port: 6379
});

client.on('error', (err) => console.log('Redis error:', err));
client.on('ready', () => console.log('Redis ready'));
```

### PostgreSQL Database

**Connect via psql**:
```bash
psql -h localhost -p 5432 -U vibecode -d vibecode
# Password: vibecode
```

**Connect from Application**:
```bash
# Connection string for most applications:
postgresql://vibecode:vibecode@localhost:5432/vibecode

# Test connection:
pg_isready -h localhost -p 5432
```

**Sample Queries**:
```sql
-- List tables
\dt

-- Create test table
CREATE TABLE test (id SERIAL PRIMARY KEY, name VARCHAR(255));

-- Insert data
INSERT INTO test (name) VALUES ('Hello World');

-- Query data
SELECT * FROM test;

-- Drop table
DROP TABLE test;
```

---

## Troubleshooting

### General Issues

#### App Won't Launch

**Symptom**: Double-clicking app does nothing or shows error

**Solutions**:
1. Try right-click → Open
2. Try command line:
   ```bash
   open /Applications/UnifiedServicesVibeCodeApp.app
   ```
3. Check system memory:
   ```bash
   vm_stat
   # Should show >1GB free memory
   ```
4. Restart Mac and try again
5. Check for crashes:
   ```bash
   log show --predicate 'process == "UnifiedServicesVibeCode"' --last 1h
   ```

#### Menubar Icon Doesn't Appear

**Symptom**: App launches but no icon in menubar

**Solutions**:
1. Wait 10-15 seconds (app takes time to initialize)
2. Try clicking top-right corner where icon should be
3. Restart the app:
   - Find in System Activity Monitor
   - Force quit if necessary
   - Relaunch
4. Check System Settings → General → Login Items
5. See if it's hidden in menubar overflow (click arrow at top-right)

#### VM Doesn't Boot

**Symptom**: App launches, but menubar shows "Starting..." indefinitely

**Solutions**:
1. Wait full 2 minutes (first boot takes time)
2. Check system memory:
   ```bash
   vm_stat | head -1
   # Pages free should be >200000 (roughly 800MB)
   ```
3. Close other memory-intensive apps (Xcode, Chrome with many tabs, etc.)
4. Try restarting the app
5. Check system logs:
   ```bash
   log show --predicate 'process == "UnifiedServicesVibeCode"' --level debug
   ```

### Service Issues

#### Services Show "Connecting..." but Never Ready

**Symptom**: Menubar shows services as "Connecting..." for >2 minutes

**Solutions**:
1. Wait longer - sometimes takes full 2 minutes
2. Manually test each service:
   ```bash
   # Test SSH
   ssh root@localhost -p 2222 "echo ok" 2>&1

   # Test Valkey
   redis-cli -h localhost -p 6379 ping

   # Test PostgreSQL
   pg_isready -h localhost -p 5432

   # Test OpenVSCode
   curl -s http://localhost:8080 | head -1
   ```
3. Check system logs for errors:
   ```bash
   # SSH logs
   ssh root@localhost -p 2222 "journalctl -u dropbear -n 20"

   # OpenVSCode logs
   ssh root@localhost -p 2222 "journalctl -u openvscode-server -n 20"
   ```
4. Restart services in VM:
   ```bash
   ssh root@localhost -p 2222
   systemctl restart valkey
   systemctl restart postgresql
   systemctl restart openvscode-server
   exit
   ```

#### "Connection Refused" on Port

**Symptom**: `curl: (7) Failed to connect to localhost port XXXX`

**Solutions**:
1. Wait 2 minutes from app launch
2. Check if another process is using the port:
   ```bash
   lsof -i :8080
   lsof -i :6379
   lsof -i :5432
   lsof -i :2222
   ```
3. If another app is using the port, either:
   - Stop that app
   - Change its port
   - Use different port numbers with VibeCode (requires rebuild)
4. Verify VM is running:
   ```bash
   # From menubar, check "VM Status: Running"
   # Or check with:
   netstat -an | grep -E "2222|6379|5432|8080"
   ```

#### OpenVSCode Not Loading

**Symptom**: `http://localhost:8080` shows blank page or loading spinner

**Solutions**:
1. Wait 2 minutes from app launch
2. Check if port is forwarded:
   ```bash
   curl -I http://localhost:8080
   # Should show: HTTP/1.1 200 OK
   ```
3. Hard refresh in browser:
   - Chrome/Firefox: `Cmd+Shift+R`
   - Safari: `Cmd+Option+R`
4. Try different browser:
   - Chrome, Firefox, Safari, or Edge
   - Some browsers may have caching issues
5. Check OpenVSCode service in VM:
   ```bash
   ssh root@localhost -p 2222
   systemctl status openvscode-server
   systemctl restart openvscode-server
   ```

#### Datadog Extension Not Visible

**Symptom**: Extension doesn't show in Extensions sidebar

**Solutions**:
1. Refresh page: `Cmd+R` or `Ctrl+R`
2. Check browser console for errors: `F12` → Console
3. Verify extension files exist in VM:
   ```bash
   ssh root@localhost -p 2222
   ls -la /.openvscode-server/extensions/
   # Should show datadog.datadog-vscode-2.0.0 directory
   ```
4. Restart OpenVSCode service:
   ```bash
   ssh root@localhost -p 2222
   systemctl restart openvscode-server
   ```
5. Clear browser cache:
   - Chrome: Settings → Privacy → Clear browsing data
   - Safari: Develop → Empty Web Storage
   - Firefox: History → Clear Recent History

### System Issues

#### VM Uses Too Much Memory

**Symptom**: Mac becomes slow, fans loud, memory warnings

**Solution**: This is expected - VM allocates 2GB RAM
- Close browser windows/tabs
- Close other heavy applications
- Restart Mac
- Consider upgrading Mac's total RAM
- Recommendation: 8GB+ for smooth operation

#### Slow Boot Time

**Symptom**: Takes >2 minutes to boot

**Cause**: This is normal - network detection is slow
- Kernel boot: 20 seconds
- Network detection: 60 seconds
- Service startup: 40 seconds

**Workaround**: Keep app running in menubar for quick access

#### Port Conflicts with Other Apps

**Symptom**: Services fail with "Address already in use"

**Solution**:
1. Find what's using the port:
   ```bash
   lsof -i :8080  # OpenVSCode port
   lsof -i :5432  # PostgreSQL port
   lsof -i :6379  # Valkey port
   lsof -i :2222  # SSH port
   ```
2. Stop the conflicting app
3. Or restart VibeCode:
   - Stop VM from menubar
   - Quit app
   - Relaunch

---

## Uninstallation

### Remove Application

**Via Finder**:
1. Open Applications folder
2. Find `UnifiedServicesVibeCodeApp.app`
3. Right-click → Move to Trash
4. Empty Trash

**Via Command Line**:
```bash
rm -rf /Applications/UnifiedServicesVibeCodeApp.app
# Or move to trash:
mv /Applications/UnifiedServicesVibeCodeApp.app ~/.Trash/
```

### Clean Up Remaining Files

The app may have created configuration files:

```bash
# Remove application support files
rm -rf ~/Library/Application\ Support/UnifiedServicesVibeCode

# Remove cache
rm -rf ~/Library/Caches/UnifiedServicesVibeCode

# Remove preferences
rm -f ~/Library/Preferences/com.vibecode.*
```

### Verify Removal

```bash
# Check app is removed
ls -la /Applications/UnifiedServicesVibeCodeApp.app
# Should show: No such file or directory

# Check no processes running
pgrep -f UnifiedServicesVibeCode
# Should return nothing

# Check ports are freed
lsof -i :8080
lsof -i :5432
lsof -i :6379
lsof -i :2222
# Should return nothing
```

### Keep DMG for Reinstallation

```bash
# Optionally keep the DMG for future reinstalls
# Store it somewhere safe:
cp ~/Downloads/VibeCode-Unified-v3.2.1-Datadog.dmg ~/Archive/
```

---

## Next Steps

After successful installation:

1. **Verify All Services** (see [Verification](#verification) section)
2. **Test OpenVSCode** at http://localhost:8080
3. **Explore Datadog Extension** in OpenVSCode Extensions sidebar
4. **Read Usage Guide** for connecting from your applications
5. **Set Up Cloud Integration** (optional) if you have Datadog account

---

## Getting Help

### Resources

- **Quick Links**:
  - [Release Notes](GITHUB_RELEASE_v3.2.1.md)
  - [Upgrade Guide](UPGRADE_GUIDE_v3.2.0_to_v3.2.1.md)
  - [Troubleshooting](#troubleshooting) (above)

- **External Resources**:
  - [macOS Virtualization Framework](https://developer.apple.com/virtualization/)
  - [Alpine Linux Wiki](https://wiki.alpinelinux.org/)
  - [PostgreSQL Documentation](https://www.postgresql.org/docs/)
  - [OpenVSCode Documentation](https://github.com/gitpod-io/openvscode-server)

### Support Channels

- **GitHub Issues**: Report bugs or request features
- **Documentation**: Check included MD files for FAQs
- **System Logs**: Useful for debugging (see Troubleshooting section)

---

**Status**: Installation Complete
**Version**: v3.2.1
**Last Updated**: January 14, 2026
**Platform**: macOS 13.0+ (Apple Silicon)
