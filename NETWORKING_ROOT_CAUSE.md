# 🔍 VM Networking Root Cause Analysis

## Problem Statement

VMs boot successfully but **cannot create network interfaces**. Only loopback (`lo`) interface exists.

---

## Evidence

```bash
/sys/class/net/:
total 0
lrwxrwxrwx    1 root     root    0 lo -> ../../devices/virtual/net/lo

# No eth0, no enp0s*, nothing
```

**Error**: `ip: can't find device 'eth0'`

---

## Root Cause: Missing virtio-net Kernel Driver

### What We Found:

1. **vfkit Configuration is CORRECT**:
   ```bash
   --device virtio-net,nat,mac=52:54:00:12:34:57
   ```
   ✅ vfkit is correctly configured to provide virtio-net device

2. **Alpine virt Kernel Issue**:
   - Using: `alpine-virt-3.19.1-aarch64` kernel (vmlinux)
   - Extracted from Alpine ISO
   - **Problem**: Kernel lacks built-in virtio-net support

3. **No Kernel Modules in initramfs**:
   - Our minimal initramfs has no `/lib/modules/`
   - Cannot load `virtio_net.ko` module
   - Kernel needs either built-in support OR loadable modules

---

## Why This Happens

Alpine's `virt` kernel is optimized for containers/minimal VMs and may not include all virtio drivers built-in. It expects:
- Either: Full Alpine installation with module loading
- Or: Kernel with built-in virtio support

**Our approach** (minimal initramfs) needs a kernel with **built-in virtio-net**.

---

## Research Findings

### vfkit + CRC (CodeReady Containers)

CRC successfully uses vfkit with Fedora CoreOS, which has:
- ✅ Kernel with built-in virtio drivers  
- ✅ Proper init system (systemd)
- ✅ Full OS installation (not minimal initramfs)

### Alpine Linux

Alpine **can** work with vfkit, but requires:
- Full Alpine installation (not just kernel + initramfs)
- OpenRC init system
- Kernel modules loaded at boot

---

## Solutions

### Option 1: Use Different Kernel ⭐ RECOMMENDED

**Use a kernel with built-in virtio support:**

```bash
# Try mainline ARM64 kernel with built-in virtio
# Or: Fedora/Ubuntu kernel known to work with vfkit
```

**Where to get it:**
- Fedora CoreOS kernel (known to work with vfkit/CRC)
- Ubuntu cloud-init kernel
- Custom-compiled kernel with:
  ```
  CONFIG_VIRTIO_NET=y  # Built-in, not module
  CONFIG_VIRTIO_BLK=y
  CONFIG_VIRTIO_PCI=y
  ```

### Option 2: Full Alpine Installation

Install Alpine to disk (not initramfs-only):
- ✅ OpenRC properly manages modules
- ✅ Persistent storage
- ✅ Full package management
- ❌ More setup required

### Option 3: Include Modules in initramfs

Add kernel modules to initramfs:
- Extract modules from Alpine packages
- Load virtio_net.ko in init script
- ✅ Keeps minimal approach
- ❌ Requires matching kernel/modules versions

### Option 4: Use Pre-Built Binaries (Current Approach) ✅

**What we already have working:**
- ✅ Valkey built on macOS (2.2 MB)
- ✅ Node.js 24 available (24.10.0)

**For PostgreSQL + openvscode:**
- Build on macOS (not musl, but still works)
- Or: Use existing Linux ARM64 binaries

---

## Comparison with Other Projects

| Project | VM Type | Kernel | Networking | Works? |
|---------|---------|--------|------------|--------|
| **CRC** | Fedora CoreOS | Built-in virtio | ✅ Yes | ✅ Yes |
| **Our Alpine** | Minimal initramfs | No virtio | ❌ No | ❌ No |
| **Full Alpine** | Disk install | Modules loaded | ✅ Yes | ✅ Should work |

---

## Why vfkit Is Not The Problem

vfkit is correctly:
- ✅ Creating virtio-net device  
- ✅ Providing NAT networking
- ✅ Launching VMs successfully

**The issue is the guest kernel**, not vfkit.

---

## Recommendations

### Immediate (Use What Works):

```bash
# Already working:
/tmp/valkey-7.2.5/src/valkey-server  # 2.2 MB, tested ✅
node --version  # v24.10.0, tested ✅
```

### Short Term (Fix VMs):

1. **Get Fedora CoreOS kernel**:
   - Known to work with vfkit (used by CRC)
   - Has built-in virtio support
   - ARM64 available

2. **Or: Full Alpine disk install**:
   - Use `setup-alpine` to install to disk
   - OpenRC will handle modules
   - Proper networking guaranteed

### Long Term (If Needed):

Build custom kernel with:
```
CONFIG_VIRTIO=y
CONFIG_VIRTIO_NET=y
CONFIG_VIRTIO_BLK=y
CONFIG_VIRTIO_PCI=y
CONFIG_NET_9P=y
CONFIG_NET_9P_VIRTIO=y
```

---

## Verdict

**NOT a timeout issue.**  
**NOT a vfkit bug.**  
**IS a kernel configuration issue.**

The Alpine virt kernel lacks built-in virtio-net support, and our minimal initramfs can't load modules.

**Solution**: Use a different kernel (Fedora CoreOS) or full Alpine installation.

---

## Current Status

✅ **2 of 4 services working** (Valkey + Node.js on macOS)  
❌ **VM networking blocked** (kernel issue)  
🔧 **Fix required**: Different kernel OR full Alpine install

---

## Next Steps

- [ ] Try Fedora CoreOS kernel with vfkit
- [ ] Or: Full Alpine disk installation
- [ ] Or: Continue with macOS builds (already working!)

**Recommendation**: Keep using Valkey + Node.js that already work, build PostgreSQL on macOS too.

