# Datadog Extension Investigation Report - Agent X
**Date:** January 14, 2026  
**VM Status:** Running (PID 1484)  
**Investigator:** Agent X

## Executive Summary

**FINDING:** The Datadog extension is MISSING from the deployed initramfs but EXISTS in the source initramfs files.

**ROOT CAUSE:** Wrong initramfs was deployed to the app bundle. A non-Datadog version was copied instead of the Datadog-enabled version.

**IMPACT:** Agent V's tests correctly report Datadog as missing. The extension never made it into the running VM.

---

## Detailed Investigation

### 1. VM Runtime Check

**SSH Investigation Results:**
```bash
# Search for Datadog directories
find / -name '*datadog*' -type d 2>/dev/null
# Result: NOTHING FOUND

# Check OpenVSCode extensions directory  
ls -la /.openvscode-server/extensions/
# Result: Empty (only extensions.json with 2 bytes)

# Check source extensions in /opt
ls -la /opt/openvscode/extensions/
# Result: 90 extensions present, NO Datadog
```

**Conclusion:** The Datadog extension is not running in the VM and never was deployed.

### 2. Initramfs Forensics

#### Deployed Initramfs Analysis
```bash
File: /Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/Apps/UnifiedServicesVibeCodeApp.app/Contents/Resources/unified-vm-initramfs.cpio.gz
Size: 112MB
Created: January 14, 10:41 AM
MD5: 2e654e33e4c443fadb0edb0c1e399bdf
Extensions Count: 90
Contains Datadog: NO
```

**Contents Check:**
```bash
gunzip -c unified-vm-initramfs.cpio.gz | cpio -t | grep 'datadog'
# Result: NO OUTPUT - Datadog not present
```

#### Available Initramfs Versions

| File | Size | Created | Contains Datadog |
|------|------|---------|------------------|
| unified-vm-initramfs-with-datadog.cpio.gz | 120MB | Jan 14 08:14 | YES ✓ |
| unified-vm-initramfs-v1.106.3-with-datadog.cpio.gz | 144MB | Jan 14 09:20 | YES ✓ |
| unified-vm-initramfs-green-terminal-v2.cpio.gz | 120MB | Jan 14 10:35 | YES ✓ |
| **[DEPLOYED]** unified-vm-initramfs.cpio.gz | 112MB | Jan 14 10:41 | NO ✗ |

**Verification:**
```bash
# Check green-terminal-v2 for Datadog
gunzip -c /tmp/unified-vm-initramfs-green-terminal-v2.cpio.gz | cpio -t | grep 'datadog'
# Result: 37 files found including datadog.datadog-vscode-2.0.0/*

# Extensions count:
# Deployed: 90 extensions
# Green-v2: 91 extensions (includes Datadog)
```

### 3. Init Script Analysis

**Finding:** The init script does NOT have any logic to copy extensions from `/opt/openvscode/extensions/` to `/.openvscode-server/extensions/`.

**OpenVSCode Startup (lines 429-439):**
```bash
if [ -f /opt/openvscode/bin/openvscode-server ]; then
    (cd /opt/openvscode && ./bin/openvscode-server \
        --host $VSCODE_HOST \
        --port 8080 \
        --without-connection-token \
        --accept-server-license-terms \
        --user-data-dir /tmp/vscode-data \
        --log trace \
        > /tmp/openvscode.log 2>&1) &
    VSCODE_PID=$!
    echo "  - OpenVSCode server launched (PID: $VSCODE_PID)"
fi
```

**Issue:** OpenVSCode is launched but there's no step to:
1. Copy extensions from `/opt/openvscode/extensions/` to `/.openvscode-server/extensions/`
2. Update the extensions registry
3. Enable the Datadog extension

**Expected Behavior:** Extensions should be available from `/opt/openvscode/extensions/` directory, which OpenVSCode should discover automatically, OR they should be deployed to the user data directory.

### 4. Timeline Reconstruction

```
08:14 AM - unified-vm-initramfs-with-datadog.cpio.gz created (120MB)
08:49 AM - Docker version created (172MB)
09:20 AM - v1.106.3 with Datadog created (144MB)
10:09 AM - Fixed terminal version created (120MB)
10:32 AM - Green terminal v1 created (120MB)
10:35 AM - Green terminal v2 created (120MB) ← Last Datadog version
10:41 AM - Current deployed initramfs (112MB) ← NO DATADOG
```

**Conclusion:** Something happened between 10:35 AM (green-v2 with Datadog) and 10:41 AM (deployed without Datadog) that caused a non-Datadog initramfs to be deployed.

---

## Root Cause Analysis

### Primary Issue: Wrong Initramfs Deployed

The deployment process copied an initramfs that does NOT contain the Datadog extension, despite multiple Datadog-enabled versions existing in `/tmp/`.

**Evidence:**
- Deployed initramfs has 90 extensions
- Datadog versions have 91 extensions
- MD5 checksums don't match any known Datadog version
- File size is 112MB vs 120MB for Datadog versions

### Secondary Issue: No Extension Deployment Mechanism

Even if Datadog was in `/opt/openvscode/extensions/`, there's no guarantee OpenVSCode would find it without:
1. Proper extension discovery configuration
2. Extensions being in the correct location
3. Extension manifest updates

---

## What Went Wrong

**Deployment Chain Breakdown:**

1. **Build Phase:** Multiple initramfs versions were created, some with Datadog (120MB), some without
2. **Selection Phase:** The wrong initramfs was selected for deployment to the app bundle
3. **Copy Phase:** A 112MB non-Datadog version was copied at 10:41 AM
4. **Runtime Phase:** VM boots with no Datadog, Agent V's tests correctly report missing extension

**Most Likely Scenario:**
- Agent created terminal fixes after 10:35 AM
- Created a new initramfs without Datadog
- This version was deployed instead of green-terminal-v2
- The deployment script didn't verify Datadog presence

---

## How to Fix

### Option 1: Redeploy Correct Initramfs (RECOMMENDED)

```bash
# Copy the Datadog-enabled initramfs
cp /tmp/unified-vm-initramfs-green-terminal-v2.cpio.gz \
   /Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/Apps/UnifiedServicesVibeCodeApp.app/Contents/Resources/unified-vm-initramfs.cpio.gz

# Verify copy
ls -lh /Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/Apps/UnifiedServicesVibeCodeApp.app/Contents/Resources/unified-vm-initramfs.cpio.gz

# Should show: 120MB

# Verify Datadog present
gunzip -c /Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/Apps/UnifiedServicesVibeCodeApp.app/Contents/Resources/unified-vm-initramfs.cpio.gz | \
  cpio -t 2>/dev/null | grep -c 'datadog'

# Should show: 37 (number of Datadog extension files)

# Restart app
killall UnifiedServicesVibeCode
open /Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/Apps/UnifiedServicesVibeCodeApp.app
```

### Option 2: Rebuild Initramfs with Datadog

If green-terminal-v2 has other issues, rebuild with these steps:

```bash
# Extract current initramfs
cd /tmp
mkdir rebuild-with-datadog
cd rebuild-with-datadog
gunzip -c /Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/Apps/UnifiedServicesVibeCodeApp.app/Contents/Resources/unified-vm-initramfs.cpio.gz | cpio -id

# Extract Datadog from known good version
cd /tmp
mkdir datadog-source
cd datadog-source
gunzip -c /tmp/unified-vm-initramfs-green-terminal-v2.cpio.gz | cpio -id opt/openvscode/extensions/datadog.datadog-vscode-2.0.0

# Copy Datadog to rebuild directory
cp -r /tmp/datadog-source/opt/openvscode/extensions/datadog.datadog-vscode-2.0.0 \
      /tmp/rebuild-with-datadog/opt/openvscode/extensions/

# Repack
cd /tmp/rebuild-with-datadog
find . -print0 | cpio --null -ov --format=newc | gzip -9 > /tmp/unified-vm-initramfs-datadog-restored.cpio.gz

# Deploy
cp /tmp/unified-vm-initramfs-datadog-restored.cpio.gz \
   /Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/Apps/UnifiedServicesVibeCodeApp.app/Contents/Resources/unified-vm-initramfs.cpio.gz
```

### Option 3: Verify OpenVSCode Extension Discovery

If extensions are in `/opt/openvscode/extensions/` but not loading, add to init script:

```bash
# Before launching OpenVSCode, ensure extensions are available
if [ -d /opt/openvscode/extensions ]; then
    mkdir -p /.openvscode-server/extensions
    # Option A: Symlink (preferred)
    ln -sf /opt/openvscode/extensions/* /.openvscode-server/extensions/
    
    # Option B: Copy (if symlinks don't work)
    # cp -r /opt/openvscode/extensions/* /.openvscode-server/extensions/
fi
```

---

## Verification Steps

After applying fix, verify with:

```bash
# 1. Check initramfs size
ls -lh /Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/Apps/UnifiedServicesVibeCodeApp.app/Contents/Resources/unified-vm-initramfs.cpio.gz
# Should be: 120MB (not 112MB)

# 2. Verify Datadog in initramfs
gunzip -c /Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/Apps/UnifiedServicesVibeCodeApp.app/Contents/Resources/unified-vm-initramfs.cpio.gz | \
  cpio -t 2>/dev/null | grep 'datadog.datadog-vscode' | head -5
# Should show: Datadog extension files

# 3. Start VM and check
open /Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/Apps/UnifiedServicesVibeCodeApp.app
sleep 30

# 4. SSH and verify
sshpass -p vibecode ssh -p 2222 root@localhost "ls -la /opt/openvscode/extensions/ | grep datadog"
# Should show: datadog.datadog-vscode-2.0.0 directory

# 5. Check OpenVSCode can see it
sshpass -p vibecode ssh -p 2222 root@localhost "find /.openvscode-server -name '*datadog*' -type d"
# Should show: Datadog in extensions directory OR verify via API

# 6. Run Agent V's test again
# Should pass
```

---

## Prevention Measures

To prevent this from happening again:

1. **Add Deployment Verification:**
   ```bash
   # In deployment script, verify Datadog before copying
   DATADOG_COUNT=$(gunzip -c "$SOURCE_INITRAMFS" | cpio -t 2>/dev/null | grep -c 'datadog')
   if [ "$DATADOG_COUNT" -lt 30 ]; then
       echo "ERROR: Datadog extension missing from initramfs!"
       exit 1
   fi
   ```

2. **Add Size Check:**
   ```bash
   # Datadog initramfs should be ~120MB
   SIZE=$(stat -f%z "$SOURCE_INITRAMFS")
   if [ "$SIZE" -lt 115000000 ]; then
       echo "WARNING: Initramfs smaller than expected (missing Datadog?)"
   fi
   ```

3. **Add MD5 Tracking:**
   ```bash
   # Keep a manifest of known good initramfs versions
   echo "2e654e33e4c443fadb0edb0c1e399bdf NO_DATADOG" >> /tmp/initramfs-manifest.txt
   echo "414d23fca8d0d0016806bf0202b7f5d7 WITH_DATADOG" >> /tmp/initramfs-manifest.txt
   ```

4. **Automated Testing:**
   - Run extension count check as part of CI/CD
   - Boot VM and verify Datadog presence before release
   - Add to Agent V's test suite

---

## Answers to Key Questions

### Is Datadog in the VM?
**NO** - Not in the running VM, not in the deployed initramfs

### Where is Datadog?
- EXISTS in `/tmp/unified-vm-initramfs-with-datadog.cpio.gz` (120MB)
- EXISTS in `/tmp/unified-vm-initramfs-green-terminal-v2.cpio.gz` (120MB)
- MISSING from deployed initramfs (112MB)
- MISSING from running VM

### Which initramfs version is deployed?
- **File:** unified-vm-initramfs.cpio.gz
- **Size:** 112MB  
- **Created:** January 14, 10:41 AM
- **MD5:** 2e654e33e4c443fadb0edb0c1e399bdf
- **Extensions:** 90 (missing Datadog)
- **Datadog Status:** NOT PRESENT

### What went wrong?
Wrong initramfs was copied to the app bundle. A non-Datadog version (112MB with 90 extensions) was deployed instead of a Datadog version (120MB with 91 extensions).

### Is the deployment chain broken?
**YES** - The deployment process has no verification step to ensure Datadog is present. The chain builds correct initramfs files but deploys the wrong one.

### Is the init script broken?
**PARTIALLY** - The init script doesn't have logic to deploy extensions from `/opt/openvscode/extensions/` to the user extensions directory, but this might not be necessary if OpenVSCode discovers extensions correctly.

---

## Recommended Action

**IMMEDIATE:** Deploy the correct initramfs using Option 1 above (copy green-terminal-v2)

**SHORT TERM:** Add verification checks to deployment scripts

**LONG TERM:** Implement automated testing that boots VM and verifies all expected extensions are present

---

## Agent V Status

**Agent V's Tests are CORRECT.** The Datadog extension is indeed missing, and the tests accurately reflect the current state. Once the correct initramfs is deployed, Agent V's tests should pass.

---

**Investigation Complete**  
**Agent X**  
January 14, 2026 - 11:15 AM
