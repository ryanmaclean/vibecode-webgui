# Network Interface - Quick Reference

**Quick commands for working with network-enabled VMs**

## Launch VM

```bash
cd ~/vibecode-webgui/azure/SwiftUI-Apps
open BasicVibeCode.app
# or
open LiquidGlassVibeCode.app
```

## Check Network Status

```bash
# Get latest console log
LATEST_LOG=$(ls -t /tmp/vibecode-console-*.log | head -1)

# View boot sequence
tail -100 "$LATEST_LOG"

# Check module loading
grep "virtio_net" "$LATEST_LOG"
# Expected: virtio_net module loaded successfully

# Check interface
grep "Found interface" "$LATEST_LOG"
# Expected: Found interface: eth0

# Check DHCP
grep "DHCP successful" "$LATEST_LOG"
# Expected: DHCP successful: 192.168.64.3/24

# Get VM IP
VM_IP=$(grep "inet " "$LATEST_LOG" | grep -v "127.0.0.1" | awk '{print $2}' | cut -d'/' -f1)
echo "VM IP: $VM_IP"
```

## Test Connectivity

```bash
# Ping VM from host
ping -c 3 $VM_IP

# Expected output:
# 3 packets transmitted, 3 packets received, 0.0% packet loss
```

## Troubleshooting

```bash
# Check if module loaded
grep -i "insmod\|module" "$LATEST_LOG"

# Check interface detection
grep -i "eth0\|interface" "$LATEST_LOG"

# Check DHCP process
grep -i "dhcp\|udhcpc" "$LATEST_LOG"

# Check routing
grep -i "route\|gateway" "$LATEST_LOG"

# Check DNS
grep -i "dns\|nameserver" "$LATEST_LOG"

# View all network-related messages
grep -i "network\|virtio_net\|eth0\|dhcp" "$LATEST_LOG"
```

## Rebuild App Bundles

```bash
cd ~/vibecode-webgui/azure/SwiftUI-Apps
bash bundle-apps.sh
```

## File Locations

### Kernel
```bash
~/Downloads/linux-kernel-ubuntu-5.15.0-160-arm64-uncompressed
# Size: 45MB
# Version: 5.15.0-160-generic
```

### Initramfs
```bash
~/vibecode-webgui/azure/bun-openvscode-with-modules.cpio.gz
# Size: 108MB
# Contains: virtio_net.ko, net_failover.ko, failover.ko
```

### App Bundles
```bash
~/vibecode-webgui/azure/SwiftUI-Apps/BasicVibeCode.app
~/vibecode-webgui/azure/SwiftUI-Apps/LiquidGlassVibeCode.app
# Size: 153MB each
```

### Console Logs
```bash
/tmp/vibecode-console-*.log
# One per VM instance
# Contains boot and network initialization logs
```

## Expected Network Configuration

| Parameter | Value |
|-----------|-------|
| Interface | eth0 |
| IP Address | 192.168.64.3/24 (DHCP) |
| Gateway | 192.168.64.1 |
| Network | 192.168.64.0/24 |
| DHCP Server | 192.168.64.1 |
| MTU | 1500 |
| State | UP |

## Kernel Modules

| Module | Path | Size | Purpose |
|--------|------|------|---------|
| failover | `/lib/modules/kernel/net/core/failover.ko` | 18KB | Failover support |
| net_failover | `/lib/modules/5.15.0-160-generic/net_failover.ko` | 29KB | Network failover |
| virtio_net | `/lib/modules/5.15.0-160-generic/virtio_net.ko` | 120KB | VirtIO network |

## Common Issues

### 1. Module Load Failure
```bash
# Symptom: "ERROR: Failed to load virtio_net module"
# Cause: Kernel/module version mismatch
# Solution: Verify kernel version matches 5.15.0-160-generic
strings ~/Downloads/linux-kernel-ubuntu-5.15.0-160-arm64-uncompressed | grep "5.15.0-160-generic"
```

### 2. No IP Address
```bash
# Symptom: Interface up but no IP
# Cause: DHCP failure
# Check: grep "DHCP\|udhcpc" "$LATEST_LOG"
# Solution: Verify network device configuration in BaseVMManager.swift
```

### 3. Can't Ping VM
```bash
# Symptom: Ping fails from host
# Cause: Interface not configured or firewall
# Check: grep "inet " "$LATEST_LOG" | grep eth0
# Solution: Verify DHCP succeeded and interface is UP
```

## Performance Metrics

Typical values from testing:

```bash
# Ping latency
# Min: 0.365ms
# Avg: 0.516ms
# Max: 0.800ms
# Packet loss: 0%

# Boot time
# Module loading: ~2 seconds
# DHCP acquisition: ~5 seconds
# Total network init: ~7 seconds
```

## Network Architecture

```
Host (macOS)
  └─ NAT Gateway (192.168.64.1)
      └─ VM Network (192.168.64.0/24)
          └─ VM eth0 (192.168.64.3)
              ├─ virtio_net.ko (driver)
              ├─ DHCP client (udhcpc)
              └─ Default route (via 192.168.64.1)
```

## Related Documentation

- **Full Implementation Guide:** `NETWORK-IMPLEMENTATION.md`
- **Kernel Resolution Details:** `KERNEL-RESOLUTION.md`
- **Verification Summary:** `NETWORK-VERIFICATION-SUMMARY.md`
- **Bundle Script:** `bundle-apps.sh`
- **VM Manager:** `Shared/Core/BaseVMManager.swift`

## Quick Diagnostics

One-liner to check everything:

```bash
LATEST_LOG=$(ls -t /tmp/vibecode-console-*.log | head -1) && \
echo "=== Network Status ===" && \
echo "Module: $(grep 'virtio_net module loaded' "$LATEST_LOG" | wc -l) loaded" && \
echo "Interface: $(grep 'Found interface: eth0' "$LATEST_LOG" | wc -l) detected" && \
echo "DHCP: $(grep 'DHCP successful' "$LATEST_LOG" | wc -l) succeeded" && \
echo "IP: $(grep 'inet ' "$LATEST_LOG" | grep -v '127.0.0.1' | awk '{print $2}')" && \
VM_IP=$(grep "inet " "$LATEST_LOG" | grep -v "127.0.0.1" | awk '{print $2}' | cut -d'/' -f1) && \
echo "Ping: $(ping -c 1 -W 1 $VM_IP >/dev/null 2>&1 && echo 'OK' || echo 'FAILED')"
```

Expected output:
```
=== Network Status ===
Module: 1 loaded
Interface: 1 detected
DHCP: 1 succeeded
IP: 192.168.64.3/24
Ping: OK
```

---

**Last updated:** 2025-11-26
