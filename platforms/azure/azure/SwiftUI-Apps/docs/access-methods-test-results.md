# VibeCode Access Methods - Comprehensive End-to-End Test Results

**Test Date:** 2025-11-26 12:22-12:30  
**Test Subject:** BasicVibeCode.app (latest build)  
**Working Directory:** /Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps  
**Tester:** Claude Code (Automated Testing)

---

## Executive Summary

**CRITICAL FINDING:** All 4 access methods are currently **NON-FUNCTIONAL** due to a fundamental kernel configuration issue.

**Root Cause:** The Linux kernel (`vmlinux-raw`) used by BasicVibeCode.app does **NOT** have `CONFIG_VIRTIO_NET=y` built-in. This means:
- VM has no network interface (only loopback `lo`)
- No network device appears in `/sys/class/net/`
- No IP address assigned via DHCP
- virtio0 network device is detected by hardware but has no driver

**Impact:** Users cannot access the OpenVSCode Server running inside the VM through any of the 4 documented methods.

---

## Test Setup

### 1. VM Launch
- **Launch Time:** 2025-11-26 12:22:13
- **Boot Time:** ~30 seconds
- **App Location:** `/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/BasicVibeCode.app`
- **Process Status:** Running initially, crashed/exited after ~8 minutes
- **Console Log:** `/tmp/vibecode-console-*.log` (multiple instances)

### 2. VM Configuration (from code analysis)
- **VM Manager:** BasicVMManager (extends BaseVMManager)
- **Network Strategy:** NATNetworkStrategy with MAC `52:54:00:12:34:90`
- **Vsock Enabled:** Yes (guest port 3000, host port 3000)
- **CPUs:** 2
- **Memory:** 1GB
- **Kernel:** vmlinux-raw (45MB ARM64 kernel)
- **Initramfs:** bun-openvscode.cpio.gz
- **Serial Console:** File-based logging (PTY disabled by default)

### 3. VM Boot Status
```
Boot Messages (from console log):
=== Booting Bun OpenVSCode VM ===
Mounting filesystems...
Checking for network drivers...
NOTE: No network interface - kernel requires CONFIG_VIRTIO_NET=y (built-in)
      VM accessible via localhost only
```

**Key Finding:** The init script correctly detects the problem and warns that no network interface is available.

---

## Method #1: Direct Network Access (TCP Relay)

### Expected Behavior
- VM gets DHCP IP on 192.168.64.x subnet
- Direct access via `http://VM_IP:3000` or `http://VM_IP:8080`
- Works for: Host machine access

### Test Results
```bash
# Test 1: Look for VM network interfaces
$ ifconfig | grep -A 1 "vz\|tap\|bridge"
bridge0: exists (standard macOS bridge)
bridge100: exists (Virtualization.framework - 192.168.64.1/24)
# But no VM-specific interfaces found

# Test 2: Check for listening ports
$ netstat -an | grep "LISTEN" | grep "8080\|3000\|22"
# No VM ports exposed on host network

# Test 3: Check DHCP leases
$ sudo cat /var/db/dhcpd_leases | grep "52:54:00:12:34:90"
# No lease found for VM MAC address

# Test 4: ARP table
$ arp -an | grep "52:54:00:12:34:90"
# No ARP entry found

# Test 5: Subnet scan
$ for i in {2..10}; do nc -zv 192.168.64.$i 22; done
# No responsive hosts found
```

### Result: ❌ **FAILED**

**Reason:** No network interface in VM guest means:
- No DHCP request sent
- No IP address assigned
- No network reachability
- VM completely isolated

**URL:** N/A (no IP address)

---

## Method #2: Vsock Proxy (localhost)

### Expected Behavior
- NATNetworkStrategy starts VsockProxyServer on localhost:3000
- Proxy forwards TCP to VM via vsock (guest port 3000)
- Works for: Localhost access, browser access

### Test Results
```bash
# Test 1: Check if port 3000 is listening
$ lsof -iTCP:3000 -sTCP:LISTEN
# No output (port not listening)

$ netstat -an | grep "3000.*LISTEN"
# No output (port not listening)

# Test 2: Attempt connection
$ curl -I http://localhost:3000 -m 5
curl: (56) Recv failure: Connection reset by peer

# Test 3: Check for vsock proxy process
$ ps aux | grep -i "vsock\|proxy"
# No vsock-proxy or related process found
```

### Result: ❌ **FAILED**

**Reason:** The vsock proxy server is NOT running. Analysis of `NATNetworkStrategy.swift` shows:
1. Proxy setup requires socket device from VM
2. Proxy starts after 0.5s delay in `startProxyServer()`
3. **Problem:** VM may not have fully initialized socket devices, or proxy startup failed silently

**Evidence from curl:** Connection reset (not refused) suggests something tried to accept the connection but immediately closed it. This could indicate:
- Proxy briefly started but crashed
- macOS reserved the port but nothing is listening
- Race condition in proxy startup

**URL:** `http://localhost:3000` (but non-functional)

**Code Location:** `/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/Shared/Networking/NATNetworkStrategy.swift:227-275`

---

## Method #3: SSH Tunnel

### Expected Behavior
- VM runs SSH server on port 22
- Connect via `ssh root@VM_IP` (password: password)
- Create tunnel: `ssh -L 8888:127.0.0.1:3000 -N -f root@VM_IP`
- Access via `http://localhost:8888`

### Test Results
```bash
# Test 1: Find VM IP
$ arp -an | grep "52:54:00:12:34:90"
# No ARP entry

# Test 2: Check bridge network
$ ifconfig bridge100 | grep "inet "
inet 192.168.64.1 netmask 0xffffff00 broadcast 192.168.64.255
# Bridge exists, but no VM attached

# Test 3: Quick port scan
$ for i in {2..10}; do timeout 1 nc -zv 192.168.64.$i 22; done
# No SSH ports found

# Test 4: Check console log for SSH status
$ grep -i "ssh\|sshd" /tmp/vibecode-console-*.log
# No SSH-related messages (init never got that far)
```

### Result: ❌ **FAILED**

**Reason:** 
- No VM IP address (no network interface)
- Cannot establish SSH connection
- Even if network worked, unclear if SSH daemon is configured in initramfs

**URL:** N/A

---

## Method #4: PTY/TTY Terminal

### Expected Behavior
- VM serial console attached to PTY device
- Interactive terminal access via screen/tmux
- Connect using `scripts/connect-vm-terminal.sh`

### Test Results
```bash
# Test 1: Check for PTY devices
$ ls -la /dev/ttys* | head -10
crw-rw-rw-  1 root  wheel  /dev/ttys0
crw--w----  1 ryan.maclean  tty  /dev/ttys000
crw--w----  1 ryan.maclean  tty  /dev/ttys001
# Standard macOS PTY devices exist

# Test 2: Check connection script
$ ls -la scripts/connect-vm-terminal.sh
-rwx--x--x@ 1 ryan.maclean  staff  10804 Nov 26 10:03 connect-vm-terminal.sh
# Script exists

# Test 3: List available VM consoles
$ scripts/connect-vm-terminal.sh --list
Found VibeCode console logs:
  - VM ID: 0C4789FE-D858-474C-8E09-DA4A138A9CF1
  - VM ID: 0EB37C63-77C3-478C-8D91-178FE2F38DE9
  [... multiple logs found ...]
# Script finds FILE logs, not PTY devices

# Test 4: Check BaseVMManager configuration
$ grep -A 5 "enablePTY" Shared/Core/BaseVMManager.swift
open func enablePTY() -> Bool {
    return false  // ← PTY DISABLED BY DEFAULT
}
```

### Result: ❌ **FAILED** (But fixable!)

**Reason:**
- PTY mode is **disabled by default** in BaseVMManager
- BasicVMManager does not override `enablePTY()` to enable it
- VM uses file-based logging instead
- Console logs are written to `/tmp/vibecode-console-UUID.log`

**Potential Fix:** BasicVMManager could override:
```swift
override func enablePTY() -> Bool {
    return true
}
```

**Current Access:** Read-only file logs at `/tmp/vibecode-console-*.log`

**Script Location:** `/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/scripts/connect-vm-terminal.sh`

---

## Console Log Analysis

### Log Location
```bash
$ ls -lt /tmp/vibecode-console-*.log | head -1
/tmp/vibecode-console-01E6180C-BB61-4316-9657-1B1388FDD4CE.log (102 lines, 12K)
```

### Key Messages

**Boot Progress:**
```
[  0.832868] Run /init as init process
=== Booting Bun OpenVSCode VM ===
Mounting filesystems...
Checking for network drivers...
```

**Network Detection:**
```
NOTE: No network interface - kernel requires CONFIG_VIRTIO_NET=y (built-in)
      VM accessible via localhost only

Current interfaces:
1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN qlen 1000
    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00
```

**Virtio Device Detection:**
```
Checking for virtio bus...
lrwxrwxrwx  virtio0 -> ../../../devices/platform/40000000.pci/pci0000:00/0000:00:01.0/virtio0
lrwxrwxrwx  virtio1 -> ../../../devices/platform/40000000.pci/pci0000:00/0000:00:05.0/virtio1
lrwxrwxrwx  virtio2 -> ../../../devices/platform/40000000.pci/pci0000:00/0000:00:06.0/virtio2
lrwxrwxrwx  virtio3 -> ../../../devices/platform/40000000.pci/pci0000:00/0000:00:07.0/virtio3

Identifying virtio network device...
  virtio0: device_id=0x0001
    -> This is a network device!
    -> No net subdirectory found!
```

**Device ID Analysis:**
- `virtio0` (0x0001) = Network device (detected but no driver)
- `virtio1` (0x0003) = Console device
- `virtio2` (0x0013) = Socket device (vsock)
- `virtio3` (0x0004) = Block device

**Boot Timeout:**
```
Waiting for network device... (0/30)
virtio0
virtio1
virtio2
Waiting for network device... (4/30)
[... continues waiting ...]
```

**Analysis:** The init script waits up to 30 iterations for a network device to appear in `/sys/class/net/`, but it never does because the kernel lacks the virtio-net driver.

---

## Root Cause Analysis

### The Problem

The Linux kernel image at:
```
/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/BasicVibeCode.app/Contents/Resources/vmlinux-raw
```

**Does NOT include:**
- `CONFIG_VIRTIO_NET=y` (built-in virtio network driver)

**This means:**
- Kernel can see virtio network hardware (virtio0)
- Kernel cannot initialize or use it (no driver)
- No `/sys/class/net/eth0` or similar device created
- No network interface available to userspace
- Init script correctly detects and warns about this

### Why This Matters

1. **NAT Networking Doesn't Work:** Even though SwiftUI app configures `VZNATNetworkDeviceAttachment`, the guest kernel cannot use it.

2. **Vsock SHOULD Still Work:** The socket device (virtio2) is a separate device and should work independently of network. The vsock proxy failure is a SEPARATE bug.

3. **SSH Cannot Work:** Requires IP connectivity.

4. **Only Vsock Can Work:** If the proxy is fixed, vsock-based access via localhost:3000 should work even without network drivers.

### Evidence

From console log:
```
NOTE: No network interface - kernel requires CONFIG_VIRTIO_NET=y (built-in)
```

This message comes from the initramfs init script, which explicitly checks for network drivers.

---

## Recommendations for Users

### Immediate Workarounds

**None available.** All access methods are currently broken.

### What Needs to be Fixed

#### Priority 1: Fix Kernel (Enables Methods #1, #3)
Build a new kernel with `CONFIG_VIRTIO_NET=y`:
```bash
# In kernel config
CONFIG_VIRTIO_NET=y
CONFIG_VIRTIO_PCI=y
CONFIG_VIRTIO=y
```

**Impact:** Enables direct network access and SSH tunnels.

#### Priority 2: Fix Vsock Proxy (Enables Method #2)
Debug why VsockProxyServer is not starting:
- Check logs in Xcode Console
- Add NSLog statements to `NATNetworkStrategy.startProxyServer()`
- Verify socket device is available: `vm.socketDevices.count > 0`
- Check if port 3000 is already in use

**Impact:** Enables localhost:3000 access (the simplest method for users).

#### Priority 3: Enable PTY (Enables Method #4)
In `BasicVMManager.swift`, add:
```swift
override func enablePTY() -> Bool {
    return true
}
```

**Impact:** Enables interactive terminal access for debugging.

---

## Technical Details

### File Locations

**Application:**
- `/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/BasicVibeCode.app`

**Kernel:**
- `/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/BasicVibeCode.app/Contents/Resources/vmlinux-raw`
- Type: Linux kernel ARM64 boot executable Image, little-endian, 4K pages
- Size: 45MB

**Source Code:**
- `/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/BasicVibeCodeApp.swift`
- `/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/Apps/BasicVibeCodeApp/BasicVMManager.swift`
- `/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/Shared/Networking/NATNetworkStrategy.swift`
- `/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/Shared/Core/BaseVMManager.swift`

**Console Logs:**
- `/tmp/vibecode-console-*.log` (multiple UUIDs)

**Scripts:**
- `/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/scripts/connect-vm-terminal.sh`

### Network Configuration

**Host Network:**
- Bridge: bridge100 (192.168.64.1/24)
- VM Subnet: 192.168.64.0/24
- Expected VM IP Range: 192.168.64.2-254

**VM Network (Configured but Not Working):**
- Strategy: NAT
- MAC Address: 52:54:00:12:34:90
- Expected Interface: eth0 or similar
- Actual Interface: None (only lo)

**Vsock Configuration:**
- Guest Port: 3000
- Host Port: 3000
- Device: virtio2 (device_id=0x0013)
- Status: Device exists, proxy not running

---

## Conclusions

### What Works
- VM boots successfully
- Kernel loads and runs
- Initramfs init script executes
- OpenVSCode Server likely starts (but unreachable)
- Console logging works (file-based)
- Virtio devices are detected by hardware

### What Doesn't Work
- ❌ Method #1: Direct Network Access (no network interface)
- ❌ Method #2: Vsock Proxy (proxy not running)
- ❌ Method #3: SSH Tunnel (no network interface)
- ❌ Method #4: PTY Terminal (PTY disabled)

### Success Criteria Not Met
**None of the 4 access methods are functional for real users.**

### Next Steps
1. **Build kernel with CONFIG_VIRTIO_NET=y** (highest priority)
2. **Debug and fix vsock proxy startup** (independent of kernel fix)
3. **Enable PTY in BasicVMManager** (easy 1-line fix)
4. **Re-test all methods** after fixes are applied

---

## Test Evidence

All commands and outputs documented above were executed live during testing on 2025-11-26.

**Test Environment:**
- macOS (Darwin 24.6.0)
- Platform: darwin
- Working Directory: /Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps
- Git Status: Multiple modified files in docs/ and scripts/

**Reproducible:** Yes. Launch BasicVibeCode.app and observe the same failures.

---

*End of Report*
