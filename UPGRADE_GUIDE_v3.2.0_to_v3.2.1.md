# Upgrade Guide: v3.2.0 → v3.2.1

**Release Date**: January 14, 2026
**Upgrade Difficulty**: ⭐ Easy (5 minutes)
**Breaking Changes**: None
**Data Loss Risk**: None

---

## Overview

Upgrading from v3.2.0 to v3.2.1 is straightforward because:

- ✅ **No Breaking Changes**: All ports, services, and APIs remain the same
- ✅ **100% Backward Compatible**: Connection strings unchanged
- ✅ **Zero Data Loss**: No migration needed
- ✅ **Drop-in Replacement**: Can install directly over v3.2.0
- ✅ **Only Addition**: Datadog extension added

**Estimated Time**: 5 minutes (download + install)

---

## What's Changing

### New in v3.2.1

| Feature | Status |
|---------|--------|
| **Datadog VSCode Extension v2.0.0** | ✨ NEW |
| **Static Code Analysis** | ✨ NEW |
| **Optional Cloud Integration** | ✨ NEW |
| **Init Script Updates** | 🔧 MODIFIED |
| **Initramfs** | 📦 UPDATED (+3 MB) |

### What's NOT Changing

| Component | Status |
|-----------|--------|
| **SSH Service** | ✅ SAME |
| **Valkey/Redis** | ✅ SAME |
| **PostgreSQL** | ✅ SAME |
| **OpenVSCode Server** | ✅ SAME |
| **Localhost Port Forwarding** | ✅ SAME |
| **Menubar UI** | ✅ SAME |
| **Network Architecture** | ✅ SAME |
| **All Ports** | ✅ SAME |
| **Connection Strings** | ✅ SAME |

---

## Quick Start Upgrade

### 5-Minute Upgrade Path

**Step 1: Download** (1 minute)
```bash
# Download v3.2.1 DMG
# From GitHub Releases or your download source
cd ~/Downloads
# File: VibeCode-Unified-v3.2.1-Datadog.dmg (253 MB)
```

**Step 2: Stop v3.2.0** (Optional, app will continue running)
```bash
# Option A: Via menubar (recommended)
# Click VibeCode icon → "Stop VM"

# Option B: Via Terminal
pkill -f UnifiedServicesVibeCodeApp
# or
killall UnifiedServicesVibeCodeApp
```

**Step 3: Remove Old App** (1 minute)
```bash
rm -rf /Applications/UnifiedServicesVibeCodeApp.app
# Confirm: ls /Applications/ | grep VibeCode
# Should show nothing
```

**Step 4: Install v3.2.1** (2 minutes)
```bash
# Mount the DMG
hdiutil mount ~/Downloads/VibeCode-Unified-v3.2.1-Datadog.dmg

# Copy app
cp -r "/Volumes/VibeCode Unified/UnifiedServicesVibeCodeApp.app" /Applications/

# Eject DMG
hdiutil eject "/Volumes/VibeCode Unified"
```

**Step 5: Launch** (1 minute)
```bash
open /Applications/UnifiedServicesVibeCodeApp.app
# Wait 2 minutes for boot
```

**Done!** You're now running v3.2.1

---

## Detailed Upgrade Steps

### Option 1: GUI Upgrade (Easiest)

**Step 1: Download v3.2.1 DMG**
1. Visit GitHub Releases
2. Find v3.2.1 release
3. Download `VibeCode-Unified-v3.2.1-Datadog.dmg`
4. Save to Downloads folder

**Step 2: Stop v3.2.0 App** (Optional)
1. Click VibeCode menubar icon
2. Select "Stop VM"
3. Wait for VM to shut down (~10 seconds)

**Step 3: Remove Old Application**
1. Open Finder
2. Navigate to Applications folder
3. Find `UnifiedServicesVibeCodeApp.app`
4. Drag to Trash
5. Empty Trash

**Step 4: Install v3.2.1**
1. Open Downloads folder
2. Double-click `VibeCode-Unified-v3.2.1-Datadog.dmg`
3. Wait for DMG to mount
4. Drag `UnifiedServicesVibeCodeApp.app` to Applications folder
5. Wait for copy to complete

**Step 5: Eject DMG**
1. Click eject icon next to "VibeCode Unified" in Finder sidebar
2. Or right-click desktop → Eject

**Step 6: Launch v3.2.1**
1. Open Applications folder
2. Double-click `UnifiedServicesVibeCodeApp.app`
3. If security prompt: Right-click → Open → Open
4. Wait 2 minutes for boot

**Complete!** Check menubar icon to verify services are running.

### Option 2: Command Line Upgrade (Faster)

**One-Command Upgrade**:
```bash
# Complete upgrade in one script
cd ~/Downloads && \
hdiutil mount VibeCode-Unified-v3.2.1-Datadog.dmg && \
pkill -f UnifiedServicesVibeCodeApp && \
sleep 2 && \
rm -rf /Applications/UnifiedServicesVibeCodeApp.app && \
cp -r "/Volumes/VibeCode Unified/UnifiedServicesVibeCodeApp.app" /Applications/ && \
hdiutil eject "/Volumes/VibeCode Unified" && \
open /Applications/UnifiedServicesVibeCodeApp.app && \
echo "✅ Upgrade complete. Wait 2 minutes for services..."
```

**Or step-by-step**:
```bash
# 1. Stop v3.2.0
pkill -f UnifiedServicesVibeCodeApp
sleep 2

# 2. Remove old app
rm -rf /Applications/UnifiedServicesVibeCodeApp.app

# 3. Mount v3.2.1 DMG
hdiutil mount ~/Downloads/VibeCode-Unified-v3.2.1-Datadog.dmg
# Expected output: /Volumes/VibeCode Unified

# 4. Copy new app
cp -rv "/Volumes/VibeCode Unified/UnifiedServicesVibeCodeApp.app" /Applications/

# 5. Verify copy
ls -la /Applications/UnifiedServicesVibeCodeApp.app

# 6. Eject DMG
hdiutil eject "/Volumes/VibeCode Unified"

# 7. Launch new version
open /Applications/UnifiedServicesVibeCodeApp.app

# 8. Wait for boot
echo "⏳ Waiting for VM to boot... (2 minutes)"
sleep 120

# 9. Verify services
curl -s http://localhost:8080 | head -1 && echo "✅ OpenVSCode ready"
redis-cli -h localhost -p 6379 ping && echo "✅ Valkey ready"
pg_isready -h localhost -p 5432 && echo "✅ PostgreSQL ready"
```

---

## Compatibility & Connection Strings

### No Connection String Changes Required

**Your existing scripts and applications need NO changes**:

#### SSH
```bash
# v3.2.0
ssh root@localhost -p 2222

# v3.2.1 - SAME
ssh root@localhost -p 2222
```

#### Valkey/Redis
```bash
# v3.2.0
redis-cli -h localhost -p 6379

# v3.2.1 - SAME
redis-cli -h localhost -p 6379
```

#### PostgreSQL
```bash
# v3.2.0
psql -h localhost -p 5432 -U vibecode vibecode

# v3.2.1 - SAME
psql -h localhost -p 5432 -U vibecode vibecode

# Connection string
# v3.2.0: postgresql://vibecode:vibecode@localhost:5432/vibecode
# v3.2.1: postgresql://vibecode:vibecode@localhost:5432/vibecode (SAME)
```

#### OpenVSCode
```bash
# v3.2.0
open http://localhost:8080

# v3.2.1 - SAME (now with Datadog extension)
open http://localhost:8080
```

### Application Code - No Changes

**Node.js**:
```javascript
// v3.2.0 and v3.2.1 - IDENTICAL
const PG = require('pg');
const redis = require('redis');

// PostgreSQL - SAME CONNECTION STRING
const pg = new PG.Client({
  host: 'localhost',
  port: 5432,
  user: 'vibecode',
  password: 'vibecode',
  database: 'vibecode'
});

// Redis - SAME
const redisClient = redis.createClient({
  host: 'localhost',
  port: 6379
});
```

**Python**:
```python
# v3.2.0 and v3.2.1 - IDENTICAL

import psycopg2
import redis

# PostgreSQL - SAME
conn = psycopg2.connect(
    host="localhost",
    port=5432,
    user="vibecode",
    password="vibecode",
    database="vibecode"
)

# Redis - SAME
r = redis.Redis(host='localhost', port=6379)
```

**Docker Compose**:
```yaml
# v3.2.0 and v3.2.1 - IDENTICAL
services:
  app:
    environment:
      DATABASE_URL: postgresql://vibecode:vibecode@localhost:5432/vibecode
      REDIS_URL: redis://localhost:6379
      OPENVSCODE_URL: http://localhost:8080
```

---

## Pre-Upgrade Checklist

Before upgrading, verify your current setup:

```bash
# ✅ Check v3.2.0 is running
pgrep -f UnifiedServicesVibeCodeApp && echo "✅ App running" || echo "❌ App not running"

# ✅ Check services accessible
curl -s http://localhost:8080 | head -1 && echo "✅ OpenVSCode"
redis-cli -h localhost -p 6379 ping && echo "✅ Valkey"
pg_isready -h localhost -p 5432 && echo "✅ PostgreSQL"
ssh -o ConnectTimeout=5 root@localhost -p 2222 "echo ok" && echo "✅ SSH"

# ✅ Check disk space
df -h / | grep -v Filesystem | awk '{print $4}' && echo "GB free"
# Should show >2GB free

# ✅ Check system memory
vm_stat | head -1
# Should show >500000 free pages (~2GB)
```

---

## Post-Upgrade Verification

After upgrading to v3.2.1:

### Step 1: Verify Services (2 minutes)

```bash
# Wait 2 minutes for VM to boot

# Check OpenVSCode
curl -I http://localhost:8080 | head -3
# Expected: HTTP/1.1 200 OK

# Check Valkey
redis-cli -h localhost -p 6379 ping
# Expected: PONG

# Check PostgreSQL
pg_isready -h localhost -p 5432
# Expected: localhost:5432 - accepting connections

# Check SSH
ssh root@localhost -p 2222 "uname -a"
# Expected: Linux output
```

### Step 2: Verify Datadog Extension

```bash
# Open OpenVSCode
open http://localhost:8080

# In the browser:
# 1. Look for Extensions icon (left sidebar)
# 2. Search for "Datadog"
# 3. Should show as Installed
# 4. Can use for static code analysis immediately
```

### Step 3: Test Your Applications

If you have applications using the services:

```bash
# Test your Node.js app
node my-app.js
# Should connect to all services without changes

# Test your Python script
python my-script.py
# Should work with existing connection strings

# Test your database backups/migrations
psql -h localhost -p 5432 -U vibecode -d vibecode < my-backup.sql
# Should restore without issues
```

### Step 4: Verify Version

```bash
# Check app version in menubar
# Click VibeCode icon → Click "About"
# Should show v3.2.1

# Or via VM
ssh root@localhost -p 2222 "cat /etc/os-version"
```

---

## Rollback (If Needed)

If you encounter issues with v3.2.1:

### Option 1: Downgrade to v3.2.0

**If you still have v3.2.0 DMG**:
```bash
# Stop v3.2.1
pkill -f UnifiedServicesVibeCodeApp

# Remove v3.2.1
rm -rf /Applications/UnifiedServicesVibeCodeApp.app

# Install v3.2.0 from saved DMG
hdiutil mount ~/Archive/VibeCode-Unified-v3.2.0-COMPLETE.dmg
cp -r "/Volumes/VibeCode Unified/UnifiedServicesVibeCode.app" /Applications/
hdiutil eject "/Volumes/VibeCode Unified"

# Relaunch
open /Applications/UnifiedServicesVibeCode.app
```

**If you don't have v3.2.0 DMG**:
- Download from previous releases on GitHub
- Follow same installation steps

### Option 2: Fresh Install

```bash
# Remove v3.2.1
rm -rf /Applications/UnifiedServicesVibeCodeApp.app

# Remove configuration files
rm -rf ~/Library/Application\ Support/UnifiedServicesVibeCode
rm -rf ~/Library/Caches/UnifiedServicesVibeCode

# Download and install fresh copy of v3.2.1
# Then restart from clean state
```

---

## Upgrade Troubleshooting

### Issue: Installation Fails

**Error**: `cp: cannot open "source file" (No such file)`

**Solution**:
```bash
# Verify DMG is mounted
hdiutil info | grep VibeCode

# If not mounted:
hdiutil mount ~/Downloads/VibeCode-Unified-v3.2.1-Datadog.dmg

# Verify source path
ls "/Volumes/VibeCode Unified"

# Should show: UnifiedServicesVibeCodeApp.app

# If path is different, adjust in cp command
```

### Issue: Old App Still Running After Removal

**Symptom**: Can still connect to old services after uninstalling

**Solution**:
```bash
# Kill all instances
pkill -9 -f UnifiedServicesVibeCodeApp
killall UnifiedServicesVibeCodeApp

# Verify removed
pgrep -f UnifiedServicesVibeCodeApp
# Should return nothing

# Wait 10 seconds for ports to close
sleep 10

# Verify ports are free
lsof -i :8080
# Should return nothing
```

### Issue: Services Not Responding After Upgrade

**Symptom**: v3.2.1 installed but services not accessible

**Solutions**:
```bash
# 1. Wait longer (up to 3 minutes on first boot)
echo "Waiting 2 minutes for full boot..."
sleep 120

# 2. Check app is running
pgrep -f UnifiedServicesVibeCodeApp

# 3. Check ports
netstat -an | grep -E "LISTEN.*(8080|5432|6379|2222)"

# 4. Restart app
pkill -f UnifiedServicesVibeCodeApp
sleep 2
open /Applications/UnifiedServicesVibeCodeApp.app
sleep 120

# 5. Check logs
log show --predicate 'process == "UnifiedServicesVibeCode"' --last 1h
```

### Issue: Datadog Extension Not Visible

**Symptom**: Datadog extension missing from Extensions list

**Solution**:
```bash
# 1. Hard refresh OpenVSCode
# In browser: Cmd+Shift+R (or Ctrl+Shift+R)

# 2. Check extension files exist
ssh root@localhost -p 2222 \
  "ls -la /.openvscode-server/extensions/datadog*"

# 3. Restart OpenVSCode service
ssh root@localhost -p 2222 \
  "systemctl restart openvscode-server"

# 4. Wait 30 seconds, then refresh browser
```

### Issue: Port Conflicts

**Symptom**: "Address already in use" errors

**Solution**:
```bash
# Find what's using the ports
lsof -i :8080
lsof -i :6379
lsof -i :5432
lsof -i :2222

# If other apps using ports:
# Option A: Stop the other app
# Option B: Restart VibeCode:
pkill -f UnifiedServicesVibeCodeApp
sleep 2
open /Applications/UnifiedServicesVibeCodeApp.app
```

---

## Performance After Upgrade

### Expected Performance

v3.2.1 has negligible performance impact compared to v3.2.0:

| Metric | v3.2.0 | v3.2.1 | Change |
|--------|--------|--------|--------|
| **Boot Time** | ~120s | ~120s | None |
| **Memory (VM)** | 2 GB | 2 GB | None |
| **Extension Memory** | - | ~50 MB | +50 MB |
| **CPU Usage** | Minimal | Minimal | None |
| **Disk Space** | 133 MB DMG | 253 MB DMG | +120 MB |

### Memory Management

- VM uses 2 GB (same as v3.2.0)
- Datadog extension uses ~50 MB when active
- Total system impact: Negligible on 8GB+ Macs

### If Experiencing Slowness

```bash
# Check available memory
vm_stat | head -1

# If <400000 free pages (~1.5GB):
# Close other applications
# Restart Mac
# Consider upgrading Mac RAM to 8GB+

# Monitor in real-time
top -n1 | head -15
```

---

## FAQ

### Q: Do I need to back up any data before upgrading?

**A**: No. v3.2.1 is backward compatible and doesn't change any data structures. However, good practice would be to backup your PostgreSQL data if you have important data:
```bash
ssh root@localhost -p 2222 'pg_dump vibecode' > backup.sql
```

### Q: Will my existing applications break?

**A**: No. All connection strings remain identical. Any application that worked with v3.2.0 will work with v3.2.1 without changes.

### Q: Do I need to reconfigure OpenVSCode?

**A**: No. All OpenVSCode settings are preserved (they're browser-based). The Datadog extension adds new features but doesn't affect existing configuration.

### Q: Can I keep v3.2.0 installed while testing v3.2.1?

**A**: Not at the same time (port conflicts). However, you can:
1. Keep v3.2.0 DMG saved
2. Install v3.2.1
3. If issues, downgrade by removing v3.2.1 and reinstalling v3.2.0

### Q: How long does the upgrade take?

**A**: 5-10 minutes:
- Download DMG: 2-3 minutes (depending on internet speed)
- Install: 1-2 minutes
- Boot: 2 minutes
- Total: 5-7 minutes

### Q: Do I need to restart my Mac?

**A**: No. Just stop the app, install new version, relaunch.

### Q: What if download is interrupted?

**A**: Re-download the DMG. Partial downloads won't install correctly. You can verify with:
```bash
shasum -a 256 VibeCode-Unified-v3.2.1-Datadog.dmg
# Should output: 837a77f0c5f39873245d89d3449986590a8586759ecfcf1dae8499711aaa9aff
```

### Q: Is v3.2.1 more stable than v3.2.0?

**A**: v3.2.0 was already production-ready (100% service availability verified). v3.2.1 adds features without changing stability. They're equally reliable.

### Q: When should I upgrade?

**A**: Upgrade if:
- You want to use the Datadog extension
- You want the latest features
- You're starting a new project

No need to upgrade if v3.2.0 is working for you.

---

## Quick Reference

### Upgrade Commands

```bash
# Complete upgrade in one script
cd ~/Downloads && \
hdiutil mount VibeCode-Unified-v3.2.1-Datadog.dmg && \
pkill -f UnifiedServicesVibeCodeApp && \
sleep 2 && \
rm -rf /Applications/UnifiedServicesVibeCodeApp.app && \
cp -r "/Volumes/VibeCode Unified/UnifiedServicesVibeCodeApp.app" /Applications/ && \
hdiutil eject "/Volumes/VibeCode Unified" && \
open /Applications/UnifiedServicesVibeCodeApp.app && \
echo "✅ Upgrade complete"
```

### Verification Commands

```bash
# All services
curl -s http://localhost:8080 | head -1 && \
redis-cli -h localhost -p 6379 ping && \
pg_isready -h localhost -p 5432 && \
ssh root@localhost -p 2222 "echo ok" && \
echo "✅ All services ready"
```

### Rollback Commands

```bash
# Downgrade to v3.2.0
pkill -f UnifiedServicesVibeCodeApp && \
rm -rf /Applications/UnifiedServicesVibeCodeApp.app && \
hdiutil mount ~/Archive/VibeCode-Unified-v3.2.0-COMPLETE.dmg && \
cp -r "/Volumes/VibeCode Unified/UnifiedServicesVibeCode.app" /Applications/ && \
hdiutil eject "/Volumes/VibeCode Unified" && \
open /Applications/UnifiedServicesVibeCode.app && \
echo "✅ Downgrade complete"
```

---

## Support

**Issues?** Check:
1. [Installation Guide v3.2.1](INSTALLATION_GUIDE_v3.2.1.md) - Troubleshooting section
2. [Release Notes v3.2.1](GITHUB_RELEASE_v3.2.1.md) - Known Limitations section
3. System logs: `log show --predicate 'process == "UnifiedServicesVibeCode"'`

---

**Upgrade Status**: Ready
**Version**: v3.2.0 → v3.2.1
**Difficulty**: Easy
**Estimated Time**: 5 minutes
**Risk Level**: Low (backward compatible, reversible)
