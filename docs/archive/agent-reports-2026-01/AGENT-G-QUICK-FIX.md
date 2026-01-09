# Agent G - Quick Fix Guide

## Problem
VM starts but produces no console output and services are not accessible.

## Root Cause
**The launch script is missing the kernel and initramfs parameters.**

Current broken command:
```bash
vfkit --cpus 2 --memory 2048 --gui --log-level debug
```

This starts an empty VM with no operating system to boot.

---

## Quick Fix

### Option 1: Use the Test Script (Recommended)

```bash
cd /Users/ryan.maclean/vibecode-webgui
./azure/test-unified-vm-boot.sh
```

This will:
- Verify all files exist
- Launch with correct parameters
- Show console output in real-time
- Log to `/tmp/unified-vm-console.log`

---

### Option 2: Manual Command

```bash
vfkit \
  --cpus 2 \
  --memory 2048 \
  --kernel /Users/ryan.maclean/vibecode-webgui/azure/linux-kernel-arm64 \
  --initrd /Users/ryan.maclean/vibecode-webgui/azure/unified-services-static.cpio.gz \
  --kernel-cmdline "console=hvc0 loglevel=7 debug" \
  --device virtio-net,nat,mac=52:54:00:12:34:70 \
  --device virtio-serial,logFilePath=/tmp/unified-vm-console.log \
  --device virtio-rng \
  --gui \
  --log-level debug
```

---

### Option 3: Fix Existing Start Script

Edit `/Users/ryan.maclean/vibecode-webgui/start-vibecode-vfkit-vm.sh`:

**Replace this:**
```bash
vfkit --cpus 2 --memory 2048 --gui --log-level debug &
```

**With this:**
```bash
vfkit \
  --cpus 2 \
  --memory 2048 \
  --kernel "$HOME/vibecode-webgui/azure/linux-kernel-arm64" \
  --initrd "$HOME/vibecode-webgui/azure/unified-services-static.cpio.gz" \
  --kernel-cmdline "console=hvc0 loglevel=4" \
  --device virtio-net,nat,mac=52:54:00:12:34:70 \
  --device virtio-serial,logFilePath=/tmp/unified-vm-console.log \
  --device virtio-rng \
  --gui \
  --log-level info &
```

---

## What You Should See

### Immediate Boot Messages
```
[    0.000000] Booting Linux on physical CPU 0x0000000000 [0x610f0000]
[    0.000000] Linux version 5.15.0-161-generic ...
=========================================
  Unified Services VM
  PARALLEL STARTUP (Firecracker-style)
=========================================
```

### Network Setup
```
=== Network Setup ===
  ✓ Found interface: enp0s1 after 0.5 seconds
✓ DHCP IP: 192.168.64.X
```

### Services Running
```
All services launched in background!

=== SERVICE VERIFICATION ===

=== SSH Server ===
✓ SSH server running (PID: 123)
  Connect: ssh root@192.168.64.X

=== Valkey Server ===
✓ Valkey running (PID: 125)
  Port: 6379

=== PostgreSQL Server ===
✓ PostgreSQL running (PID: 126)
  Port: 5432
  ✓ Accepting connections

=== OpenVSCode Server ===
✓ OpenVSCode running (PID: 127)
  URL: http://192.168.64.X:8080
```

---

## Verification Commands

### Check console log:
```bash
tail -f /tmp/unified-vm-console.log
```

### Get VM IP:
```bash
grep "DHCP IP:" /tmp/unified-vm-console.log | awk '{print $4}'
```

### Test services:
```bash
# Get IP
VM_IP=$(grep "DHCP IP:" /tmp/unified-vm-console.log | awk '{print $4}')

# Test Valkey
redis-cli -h $VM_IP ping

# Test PostgreSQL
psql -h $VM_IP -U postgres -l

# Test OpenVSCode
curl http://$VM_IP:8080

# SSH access
ssh root@$VM_IP
# Password: vibecode
```

---

## Why This Fixes It

| Missing Parameter | What It Does | Without It |
|------------------|--------------|------------|
| `--kernel` | Specifies the kernel to boot | No OS to run |
| `--initrd` | Loads the root filesystem | No services |
| `--kernel-cmdline` | Configures console output | No output visible |
| `--device virtio-net` | Provides network hardware | No networking |
| `--device virtio-serial` | Provides console hardware | No console |

---

## For Full Details

See: `/Users/ryan.maclean/vibecode-webgui/AGENT-G-DEBUG-REPORT.md`

---

**Agent G - Quick Fix Complete**
