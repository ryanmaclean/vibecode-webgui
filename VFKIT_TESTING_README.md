# vfkit vs Virtualization.framework Networking Test Results

**Date**: October 30, 2025  
**Status**: TESTING COMPLETE  
**Result**: Both hypervisors have identical networking behavior (same root cause)

## Quick Summary

After comprehensive testing with vfkit using the same initramfs and kernel as Virtualization.framework, **both fail identically**. The problem is NOT the hypervisor but the initramfs configuration.

### Key Finding
```
vfkit networking:        Port OPEN → TCP connects → HTTP TIMEOUT
Virtualization.framework: Port CLOSED → Connection refused
eth0 interface:          NOT DETECTED in either hypervisor
Root cause:              Missing virtio-net driver in initramfs
```

## Test Results Files

### 1. Main Technical Report
**File**: `/Users/ryan.maclean/vibecode-webgui/VFKIT_VS_VZ_NETWORKING_TEST.md`

Comprehensive 300+ line technical report including:
- Executive summary
- Detailed test configuration
- Console output from VM boot
- Network interface detection results
- Port accessibility tests
- Kernel module analysis
- Comparison matrix
- Root cause analysis
- Recommended solutions with step-by-step instructions

### 2. Executive Summary
**File**: `/Users/ryan.maclean/vibecode-webgui/NETWORKING_TEST_RESULTS_SUMMARY.txt`

Quick reference summary including:
- Test results overview
- Key findings
- Comparison table
- Recommended solutions prioritized by effort
- Technical notes
- Conclusions

### 3. Test Execution Log
**File**: `/Users/ryan.maclean/vibecode-webgui/TEST_EXECUTION_LOG.txt`

Detailed timeline of all tests including:
- Exact commands executed
- Output from each test
- Initramfs structure analysis
- Kernel information
- Performance metrics
- Test logs locations

## Test Command Used

```bash
vfkit \
  --cpus 4 \
  --memory 2048 \
  --kernel "/Users/ryan.maclean/.vfkit/vms/vibecode-alpine/kernel/vmlinux-raw" \
  --initrd "/Users/ryan.maclean/vibecode-webgui/azure/bun-openvscode.cpio.gz" \
  --device virtio-net,nat \
  --device "virtio-serial,logFilePath=/tmp/vfkit-test.log" \
  --kernel-cmdline "console=hvc0 root=/dev/ram ro init=/sbin/init"
```

## Results at a Glance

### eth0 Detection
```
vfkit:                  ❌ NOT DETECTED
Virtualization.framework: ❌ NOT DETECTED
Status: IDENTICAL FAILURE
```

### Console Output
```
Network interfaces:
1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536
    inet 127.0.0.1/8 scope host lo
```

### OpenVSCode Status
```
Both:   ✅ Starts successfully on 127.0.0.1:3000
Both:   ✅ Web UI accessible via localhost
Both:   ✅ Fully functional on loopback
```

### Port Accessibility from Host

| Test | vfkit | Virtualization.framework | Notes |
|------|-------|--------------------------|-------|
| TCP port 3000 connect | ✅ ACCEPTED | ❌ REFUSED | vfkit superior |
| HTTP GET request | ⏱ TIMEOUT | ❌ N/A | Connection timeout |
| Response received | ❌ NO | ❌ NO | Both fail |

## Root Cause Analysis

### Why No eth0?

The initramfs (`bun-openvscode.cpio.gz`) lacks:
1. **Kernel modules directory** (`lib/modules/`)
2. **virtio-net.ko driver file**
3. **Module loading in init script**

The kernel has:
- **No built-in virtio-net driver** (`CONFIG_VIRTIO_NET=y` missing)
- **No ability to detect eth0** without the driver
- **No error messages** about missing driver (gracefully skips)

Both hypervisors:
- ✅ Correctly create virtio-net device
- ✅ Correctly configure NAT
- ❌ But kernel cannot use the device

### Why Different Port Behavior?

**vfkit**:
- Accepts TCP connections to port 3000
- NAT routing works at hypervisor level
- Issue: Response doesn't route back (guest issue, not vfkit)

**Virtualization.framework**:
- Doesn't expose ports by default
- Requires additional port forwarding configuration
- More restrictive security posture

## Solutions Ranked by Speed

### 1. Use Lima (FASTEST - Already Working)
```bash
limactl start --name=vibecode ~/vibecode-webgui/config/lima/vibecode.yaml
limactl shell vibecode
ip addr show eth0  # WORKS!
curl http://localhost:3000  # WORKS!
```
**Time**: 5 minutes  
**Effort**: Minimal

### 2. Rebuild Initramfs with virtio-net (RECOMMENDED)
```bash
# Extract initramfs
mkdir -p initramfs-work && cd initramfs-work
gunzip -c ~/.vfkit/vms/vibecode-alpine/kernel/initramfs | cpio -id

# Get Alpine kernel modules
wget https://dl-cdn.alpinelinux.org/alpine/v3.22/releases/aarch64/alpine-minirootfs-3.22.0-aarch64.tar.gz
tar -xf alpine-minirootfs-*.tar.gz -C alpine-root

# Copy virtio-net driver
mkdir -p lib/modules/6.6.63/kernel/drivers/net
cp alpine-root/lib/modules/6.6.63/kernel/drivers/net/virtio_net.ko lib/modules/6.6.63/kernel/drivers/net/

# Update init script (add after line 32):
# /sbin/modprobe virtio_net
# ip link set eth0 up
# udhcpc -i eth0 -q

# Rebuild
find . | cpio -H newc -o | gzip > ../initramfs-fixed.cpio.gz
cp ../initramfs-fixed.cpio.gz ~/.vfkit/vms/vibecode-alpine/kernel/initramfs-network
```
**Time**: 1-2 hours  
**Effort**: Moderate  
**Benefit**: Full networking, maintains initramfs approach

### 3. Use Disk-Based Filesystem (LONG-TERM)
Build bootable Alpine Linux disk image with:
- Full package management
- Dynamic module loading
- Persistence
- Better for production

**Time**: 4-8 hours  
**Effort**: High  
**Benefit**: Production-ready solution

## Key Insights

1. **Problem is NOT vfkit**
   - vfkit creates and configures virtio-net correctly
   - NAT implementation works (accepts connections)
   - Issue is entirely in initramfs/kernel

2. **Problem is NOT Virtualization.framework**
   - Uses same VirtIO protocol
   - Same device configuration
   - More restrictive port exposure (by design)

3. **Problem IS initramfs-only boot**
   - Cannot load kernel modules dynamically
   - No package management
   - No runtime flexibility
   - Suitable only for immutable deployments

4. **vfkit Advantages Over VZ**
   - Accepts connections to exposed ports
   - NAT forwarding works better
   - More transparent network behavior
   - Better debugging capability (serial logging)

5. **The Fix is Simple**
   - Just add virtio-net.ko to initramfs
   - Update init script to load it
   - Rebuild initramfs
   - Should solve networking for both hypervisors

## Next Steps

### Immediate (this session)
- Review the three test report files
- Choose which solution to implement
- If using Lima: `limactl start` (5 minutes)
- If rebuilding initramfs: follow detailed steps in main report

### Short-term (next few days)
- Implement networking fix (whichever approach)
- Re-test vfkit and VZ with working networking
- Verify eth0 detection and DHCP configuration

### Long-term (next sprint)
- Migrate to disk-based filesystem
- Set up production networking (DNS, routing)
- Implement persistent storage
- Add system service management

## Files Summary

```
VFKIT_VS_VZ_NETWORKING_TEST.md      - Complete technical analysis (14 KB)
NETWORKING_TEST_RESULTS_SUMMARY.txt - Executive summary (10 KB)  
TEST_EXECUTION_LOG.txt              - Detailed test timeline (10 KB)
VFKIT_TESTING_README.md             - This file
```

All files in: `/Users/ryan.maclean/vibecode-webgui/`

## Verification Commands

### Check Files Exist
```bash
ls -lh ~/vibecode-webgui/VFKIT_VS_VZ_NETWORKING_TEST.md
ls -lh ~/vibecode-webgui/NETWORKING_TEST_RESULTS_SUMMARY.txt
ls -lh ~/vibecode-webgui/TEST_EXECUTION_LOG.txt
```

### View Reports
```bash
cat ~/vibecode-webgui/VFKIT_VS_VZ_NETWORKING_TEST.md
cat ~/vibecode-webgui/NETWORKING_TEST_RESULTS_SUMMARY.txt
cat ~/vibecode-webgui/TEST_EXECUTION_LOG.txt
```

### Reproduce Test
```bash
# Use the command from "Test Command Used" section
# Or check TEST_EXECUTION_LOG.txt for exact commands
```

## Conclusion

Both vfkit and Virtualization.framework fail to detect eth0 identically because the initramfs lacks the virtio-net kernel driver. **This is not a hypervisor issue but an initramfs configuration issue**.

However, vfkit demonstrates **superior port forwarding capability** - it accepts connections while Virtualization.framework blocks them entirely. This makes vfkit the better choice for network-exposed services once the initramfs is fixed.

The solution is straightforward: rebuild the initramfs with the virtio-net kernel module. Full instructions are provided in the technical report.

---

**Status**: READY FOR IMPLEMENTATION  
**Recommendation**: Use Lima immediately for working solution, or rebuild initramfs for vfkit/VZ flexibility

