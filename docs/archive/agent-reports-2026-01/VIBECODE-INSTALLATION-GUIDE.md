# VibeCode Unified v3.0.0 - Installation & Testing Guide

## Pre-Installation Checklist

Before starting installation, ensure you have:

- macOS 13.0 or newer
- 4GB RAM available (8GB+ recommended)
- 2GB free disk space
- Virtualization framework enabled (automatic on Apple Silicon and modern Intel Macs)
- Internet connection (for initial updates)

---

## Step 1: Download DMG

### Option A: From GitHub Release

```bash
# Download the DMG from GitHub
open https://github.com/vibecode/vibecode-webgui/releases/latest

# Or via command line
cd ~/Downloads
wget https://github.com/vibecode/vibecode-webgui/releases/download/v3.0.0/VibeCode-Unified-v3.0.0-FINAL.dmg
```

### Option B: From Local Build

If building locally:
```bash
ls -lh /Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/VibeCode-Unified-v3.0.0-FINAL.dmg
```

**File Details**:
- **Name**: VibeCode-Unified-v3.0.0-FINAL.dmg
- **Size**: 94 MB (compressed)
- **MD5**: 120678f7f3834981b22c532b32a1bd3f
- **Format**: macOS disk image

---

## Step 2: Mount DMG

### Method A: Finder (Easiest)

1. Open Finder
2. Navigate to Downloads folder
3. Double-click `VibeCode-Unified-v3.0.0-FINAL.dmg`
4. Wait for volume to mount (shows as "VibeCode Unified" in Finder)

### Method B: Terminal

```bash
cd ~/Downloads
hdiutil attach VibeCode-Unified-v3.0.0-FINAL.dmg

# Verify mount
mount | grep VibeCode
# Output: /dev/diskXs2 on /Volumes/VibeCode Unified (hfs, local, nodev, nosuid, read-only, noowners)
```

### Verify DMG Contents

```bash
ls -la /Volumes/VibeCode\ Unified/

# Expected output:
# -rw-r--r-- 1 root  wheel  Applications@
# -rw-r--r-- 1 root  wheel  VibeCode.app
```

---

## Step 3: Install Application

### Method A: Drag & Drop (GUI)

1. Open Finder window with mounted DMG
2. Drag `VibeCode.app` to the `Applications` folder
3. Wait for copy to complete (~30 seconds)
4. Eject DMG when done

### Method B: Command Line

```bash
# Copy application to /Applications
sudo cp -r "/Volumes/VibeCode Unified/VibeCode.app" /Applications/

# Or without sudo (if you have write permission)
cp -r "/Volumes/VibeCode Unified/VibeCode.app" /Applications/

# Verify installation
ls -la /Applications/VibeCode.app
```

### Method C: Automated Installation

```bash
#!/bin/bash
# install-vibecode.sh

DMG_PATH=~/Downloads/VibeCode-Unified-v3.0.0-FINAL.dmg
MOUNT_POINT=$(hdiutil attach "$DMG_PATH" | tail -1 | awk '{print $NF}')

echo "DMG mounted at: $MOUNT_POINT"

# Copy app
cp -r "$MOUNT_POINT/VibeCode.app" /Applications/

# Unmount
hdiutil detach "$MOUNT_POINT"

echo "Installation complete!"
ls -lh /Applications/VibeCode.app
```

---

## Step 4: Launch Application

### Method A: Spotlight Search (Fastest)

1. Press Cmd+Space
2. Type "VibeCode"
3. Press Enter

### Method B: Finder

1. Open Finder
2. Navigate to Applications folder
3. Double-click VibeCode.app

### Method C: Terminal

```bash
open /Applications/VibeCode.app

# Or run in background
open -a VibeCode &
```

### Method D: Dock

1. First launch app via any method above
2. Right-click icon in Dock
3. Select "Options" → "Keep in Dock"

---

## Step 5: First Launch & Permissions

On first launch, you may see:

### Permission Prompt 1: Virtualization Framework

```
"VibeCode" wants to access the virtualization framework.
```

**Action**: Click **Allow**

This enables the SwiftUI Virtualization API to manage the Linux VM.

### Permission Prompt 2: Network Access

```
"VibeCode" wants to access the network.
```

**Action**: Click **Allow**

This allows the VM to use NAT networking.

### Console Output (Expected)

Once permissions are granted, watch the app's console for:

```
[Loading] Initializing Unified Services VM...
[15:42:33] Kernel boot: Linux 6.x.x arm64
[15:42:35] Init system: systemd loading
[15:42:40] Network: DHCP address 192.168.64.X
[15:42:45] PostgreSQL: ✓ Ready on port 5432
[15:42:48] Valkey: ✓ Ready on port 6379
[15:42:50] OpenVSCode: ✓ Ready on port 8080
[15:42:52] SSH: ✓ Ready on port 2222

Unified Multi-Service VM Ready
VM IP address: 192.168.64.X
All services available - Ready for development!
```

---

## Step 6: Verify Services Are Running

### Quick Verification (Visual)

1. Check app console shows "Unified Multi-Service VM Ready"
2. Services should all show ✓ status

### Detailed Verification

```bash
# Check OpenVSCode
curl -s http://localhost:8080 | head -10
# Should return HTML content

# Check PostgreSQL
psql -h localhost -p 5432 -U postgres -c "SELECT 1;"
# Should return: 1

# Check Valkey
redis-cli -p 6379 ping
# Should return: PONG

# Check SSH
ssh -p 2222 root@localhost "echo 'SSH OK'"
# Should return: SSH OK
```

---

## Full Verification Script

Save this as `verify-vibecode.sh`:

```bash
#!/bin/bash

echo "=========================================="
echo "  VibeCode Services Verification"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

services_ok=0
services_total=4

# Test OpenVSCode
echo -n "Testing OpenVSCode (8080)... "
if timeout 5 bash -c "cat < /dev/null > /dev/tcp/localhost/8080" 2>/dev/null; then
    echo -e "${GREEN}✓ OK${NC}"
    ((services_ok++))
else
    echo -e "${RED}✗ FAILED${NC}"
fi

# Test PostgreSQL
echo -n "Testing PostgreSQL (5432)... "
if psql -h localhost -p 5432 -U postgres -c "SELECT 1" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ OK${NC}"
    ((services_ok++))
else
    echo -e "${RED}✗ FAILED${NC}"
fi

# Test Valkey
echo -n "Testing Valkey (6379)... "
if redis-cli -p 6379 ping > /dev/null 2>&1; then
    echo -e "${GREEN}✓ OK${NC}"
    ((services_ok++))
else
    echo -e "${RED}✗ FAILED${NC}"
fi

# Test SSH
echo -n "Testing SSH (2222)... "
if ssh -p 2222 -o ConnectTimeout=5 root@localhost "true" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ OK${NC}"
    ((services_ok++))
else
    echo -e "${RED}✗ FAILED${NC}"
fi

echo ""
echo "=========================================="
echo "Services: ${GREEN}$services_ok${NC}/$services_total ready"
echo "=========================================="

if [ $services_ok -eq 4 ]; then
    echo -e "${GREEN}All services operational!${NC}"
    exit 0
else
    echo -e "${YELLOW}Some services may still be starting...${NC}"
    exit 1
fi
```

Run it:
```bash
chmod +x verify-vibecode.sh
./verify-vibecode.sh
```

---

## Accessing Services

### OpenVSCode Web IDE

1. Open browser: http://localhost:8080
2. You should see VS Code interface
3. Features available:
   - File explorer
   - Built-in terminal
   - Extensions marketplace
   - Syntax highlighting
   - Git integration

### PostgreSQL Database

Connect with any PostgreSQL client:

```bash
# Using psql
psql -h localhost -p 5432 -U postgres

# Connection string for applications
postgresql://postgres:password@localhost:5432/postgres

# Test query
SELECT * FROM pg_version();
```

### Valkey Cache

```bash
# Using redis-cli
redis-cli -p 6379

# Basic commands
> SET mykey "Hello"
> GET mykey
> INCR counter
> LPUSH mylist "item1"
> LRANGE mylist 0 -1
```

### SSH Terminal Access

```bash
# Connect to VM
ssh -p 2222 root@localhost

# Once connected, you can:
systemctl status               # Check service status
journalctl -xe                # View system logs
top                           # Monitor resources
df -h                         # Check disk space
ps aux                        # List running processes

# Exit SSH
exit
```

---

## Troubleshooting Installation

### Issue: DMG Won't Mount

**Symptoms**: Double-clicking DMG does nothing

**Solutions**:
```bash
# Option 1: Try hdiutil
hdiutil attach VibeCode-Unified-v3.0.0-FINAL.dmg

# Option 2: Check file integrity
md5 VibeCode-Unified-v3.0.0-FINAL.dmg
# Compare with: 120678f7f3834981b22c532b32a1bd3f

# Option 3: Repair DMG
hdiutil verify VibeCode-Unified-v3.0.0-FINAL.dmg
```

### Issue: Permission Denied During Copy

```bash
# Solution: Use sudo
sudo cp -r "/Volumes/VibeCode Unified/VibeCode.app" /Applications/

# Or check permissions
ls -la /Applications/
# Should have write permissions
```

### Issue: App Won't Launch

**Check**:
```bash
# Verify app exists and is executable
file /Applications/VibeCode.app/Contents/MacOS/VibeCode

# Try launching with debug output
/Applications/VibeCode.app/Contents/MacOS/VibeCode

# Check if sandbox is blocking
# System Settings → Privacy & Security → Allow VibeCode
```

### Issue: Services Not Starting

After launch, wait 30-45 seconds for full boot. If services don't appear:

```bash
# Check if VM is even running
ps aux | grep -i virtualization

# Try SSH - if SSH works but other services don't:
ssh -p 2222 root@localhost

# Inside VM, check service status
systemctl status
journalctl -n 50 -p err
```

---

## Performance Testing

After installation, test performance:

```bash
#!/bin/bash
# test-performance.sh

echo "Boot Time Measurement:"
date +%s > /tmp/start_time

# Wait for all services
while true; do
    if redis-cli -p 6379 ping > /dev/null 2>&1 && \
       ssh -p 2222 -o ConnectTimeout=2 root@localhost true 2>/dev/null; then
        break
    fi
    sleep 1
done

boot_time=$(($(date +%s) - $(cat /tmp/start_time)))
echo "Time to all services ready: ${boot_time}s"

# Memory usage
echo ""
echo "Memory Usage:"
vm_stat | grep "Pages free"

# CPU availability
echo ""
echo "Available CPUs:"
sysctl -n hw.ncpu
```

---

## Next Steps

Once installed:

1. **Open OpenVSCode**: http://localhost:8080
2. **Connect to PostgreSQL**: Create tables and test queries
3. **Use Valkey**: Store and retrieve cached data
4. **SSH into VM**: Monitor services and check logs
5. **Read Full Guide**: See VIBECODE-FINAL-USAGE-GUIDE.md for detailed usage

---

## Uninstalling

### Quick Uninstall

```bash
rm -rf /Applications/VibeCode.app
```

### Complete Cleanup

```bash
# Remove app
rm -rf /Applications/VibeCode.app

# Remove config/cache
rm -rf ~/.config/VibeCode
rm -rf ~/Library/Application\ Support/VibeCode
rm -rf ~/Library/Caches/VibeCode

# Remove DMG
rm ~/Downloads/VibeCode-Unified-v3.0.0-FINAL.dmg
```

---

## File Checksums

Verify download integrity:

```bash
# MD5
md5 VibeCode-Unified-v3.0.0-FINAL.dmg
# Expected: 120678f7f3834981b22c532b32a1bd3f

# SHA256
shasum -a 256 VibeCode-Unified-v3.0.0-FINAL.dmg
# Expected: [SHA256 hash if available]
```

---

## Getting Help

If you encounter issues:

1. Check console output for error messages
2. Verify all services via verification script
3. SSH into VM for detailed logs:
   ```bash
   ssh -p 2222 root@localhost
   journalctl -xe
   ```
4. Restart services:
   ```bash
   ssh -p 2222 root@localhost
   systemctl restart openvscode-server postgresql valkey
   ```

---

**Installation Status**: Ready to Use
**Expected Boot Time**: 25-45 seconds
**All 4 Services**: Automatically started on app launch

Enjoy VibeCode Unified v3.0.0!
