# MiniVim ARMv7 Implementation Guide

**Target:** Linux 6.17.x ARMv7 kernel build and validation  
**Estimated Time:** 2-3 hours (mostly kernel build time)  
**Difficulty:** Intermediate  

## Overview

This guide walks through the complete ARMv7 kernel build process for the MiniVim benchmark suite. The workflow is divided into 8 phases, with options for automation or manual execution.

## Prerequisites

### Required Software

**Debian/Ubuntu:**
```bash
sudo apt-get update
sudo apt-get install -y \
  build-essential \
  gcc-arm-linux-gnueabihf \
  clang lld llvm \
  curl bc flex bison \
  libncurses-dev libssl-dev libelf-dev \
  dwarves ccache
```

**Optional (for testing):**
```bash
sudo apt-get install -y qemu-system-arm
```

### Required Hardware

**Minimum:**
- 4 CPU cores
- 8 GB RAM
- 15 GB free disk space

**Recommended:**
- 8+ CPU cores (parallel compilation)
- 16+ GB RAM
- 20+ GB free disk space
- SSD for faster I/O

## Quick Start (Automated)

### One-Command Workflow

```bash
cd /path/to/vibecode-webgui
./scripts/benchmarks/build-armv7-6.17-complete.sh
```

This executes all phases automatically:
- Dependency checking
- Kernel build
- Validation
- Artifact organization

### Common Options

**Skip build (validation only):**
```bash
./scripts/benchmarks/build-armv7-6.17-complete.sh --skip-build
```

**Skip validation:**
```bash
./scripts/benchmarks/build-armv7-6.17-complete.sh --skip-validate
```

**Custom kernel version:**
```bash
./scripts/benchmarks/build-armv7-6.17-complete.sh --kernel-version 6.17.15
```

## Manual Workflow

### Phase 1: Environment Setup

**Set build variables:**
```bash
export ARCH=arm
export CROSS_COMPILE=arm-linux-gnueabihf-
export MINIVIM_JOBS=$(nproc)
export CC="ccache clang"
export KCFLAGS="-pipe"
export SKIP_MRPROPER=0
```

**Verify toolchain:**
```bash
arm-linux-gnueabihf-gcc --version
clang --version
```

### Phase 2: Kernel Download

**Manual download (optional):**
```bash
cd /path/to/vibecode-webgui
mkdir -p artifacts/minivim/work
cd artifacts/minivim/work

KERNEL_VERSION=6.17.14
curl -L -O "https://cdn.kernel.org/pub/linux/kernel/v6.x/linux-${KERNEL_VERSION}.tar.xz"
tar -xf "linux-${KERNEL_VERSION}.tar.xz"
```

**Note:** `build-minivim-kernel.sh` handles this automatically.

### Phase 3: Kernel Configuration

**Initialize tinyconfig:**
```bash
cd linux-6.17.14
make ARCH=arm tinyconfig
```

**Merge MiniVim configs:**
```bash
../../../scripts/kconfig/merge_config.sh -m .config \
  ../../../scripts/benchmarks/kernel-configs/minivim-base.config \
  ../../../scripts/benchmarks/kernel-configs/minivim-armv7.config
```

**Verify critical options:**
```bash
grep -E 'CONFIG_VIRTIO_MMIO|CONFIG_SERIAL_AMBA_PL011|CONFIG_ARM_PSCI' .config
```

Expected output:
```
CONFIG_VIRTIO_MMIO=y
CONFIG_SERIAL_AMBA_PL011=y
CONFIG_ARM_PSCI=y
```

### Phase 4: Kernel Build

**Clean build (recommended first time):**
```bash
make ARCH=arm \
     CROSS_COMPILE=arm-linux-gnueabihf- \
     LLVM=1 \
     CC="ccache clang" \
     -j$(nproc) \
     zImage
```

**Expected time:**
- GitHub Actions (16 cores): 20-25 minutes
- Typical workstation (8 cores): 30-40 minutes
- Low-end system (4 cores): 50-70 minutes

**Monitor progress:**
```bash
# In another terminal
watch -n 5 'ps aux | grep make | grep -v grep'
```

### Phase 5: Artifact Collection

**Copy kernel image:**
```bash
REPO_ROOT="/path/to/vibecode-webgui"
OUTPUT_DIR="${REPO_ROOT}/bench-images/minivim"
mkdir -p "${OUTPUT_DIR}"

cp arch/arm/boot/zImage "${OUTPUT_DIR}/zImage-armv7-6.17.14"
```

**Capture CPU info:**
```bash
lscpu > "${OUTPUT_DIR}/cpuinfo-armv7.txt"
# or
cat /proc/cpuinfo > "${OUTPUT_DIR}/cpuinfo-armv7.txt"
```

**Check kernel size:**
```bash
ls -lh "${OUTPUT_DIR}/zImage-armv7-6.17.14"
# Expected: 3-4 MB
```

### Phase 6: Validation

**Automated validation:**
```bash
cd "${REPO_ROOT}"
./scripts/benchmarks/validate-armv7-kernel.sh 6.17.14
```

**Manual QEMU test:**
```bash
qemu-system-arm \
  -machine virt \
  -cpu cortex-a15 \
  -m 512M \
  -kernel "${OUTPUT_DIR}/zImage-armv7-6.17.14" \
  -initrd bench-images/busybox/busybox-vi-initrd.cpio.gz \
  -nographic \
  -serial mon:stdio \
  -append "console=ttyAMA0"
```

**Expected output:**
```
[    0.000000] Booting Linux on physical CPU 0x0
[    0.000000] Linux version 6.17.14 (builder@host) (clang ...)
[    0.123456] Virtio devices found: 1
...
[    3.456789] BusyBox v1.36.1 (2025-10-01) multi-call binary
/ # vi
```

**Exit QEMU:** `Ctrl-A`, then `x`

### Phase 7: Benchmarking

**Boot latency test:**
```bash
# If boot_latency_bench.py supports ARM
python3 scripts/benchmarks/boot_latency_bench.py \
  --arch armv7 \
  --kernel "${OUTPUT_DIR}/zImage-armv7-6.17.14" \
  --initrd bench-images/busybox/busybox-vi-initrd.cpio.gz \
  --runs 5 \
  --output artifacts/minivim/armv7-boot-benchmark.json
```

**Expected metrics:**
- Boot time: 4-4.5 seconds
- Kernel decompression: <1 second
- Init to shell: 2-3 seconds

### Phase 8: Documentation Update

**Update timing table:**
```bash
vim docs/virtualization/minivim-kernel.md
```

Add ARMv7 column to timing table (see example below).

## Timing Table Format

Add this to `docs/virtualization/minivim-kernel.md`:

```markdown
| Architecture | Hardware | Kernel | Build Time (clean) | Build Time (incr) | Boot Time | Image Size |
|--------------|----------|--------|-------------------|-------------------|-----------|------------|
| x86_64 | Intel i7-9750H | 6.17.14 | 20m | 8m | 4.4s | 5.2 MB |
| arm64 | Apple M3 | 6.17.14 | 12m | 5m | 3.8s | 4.1 MB |
| armv7 | GitHub Actions | 6.17.14 | 25m | 10m | 4.5s | 3.6 MB |
```

## Troubleshooting

### Build Failures

**Error: `arm-linux-gnueabihf-gcc: command not found`**

Solution:
```bash
sudo apt-get install gcc-arm-linux-gnueabihf
export CROSS_COMPILE=arm-linux-gnueabihf-
```

**Error: `clang: error: unsupported option '-mabi=aapcs-linux'`**

Solution: Fall back to GCC
```bash
unset CC
make ARCH=arm CROSS_COMPILE=arm-linux-gnueabihf- -j$(nproc) zImage
```

**Error: `No rule to make target 'arch/arm/boot/zImage'`**

Solution: Verify ARCH is set
```bash
export ARCH=arm
make zImage
```

### Configuration Errors

**Warning: `CONFIG_VIRTIO_MMIO=n`**

This is critical for QEMU. Verify:
```bash
grep CONFIG_VIRTIO_MMIO .config
```

If missing, manually enable:
```bash
echo "CONFIG_VIRTIO_MMIO=y" >> .config
make olddefconfig
```

**Warning: `CONFIG_MODULES=y`**

MiniVim should have modules disabled:
```bash
grep CONFIG_MODULES .config
# Expected: # CONFIG_MODULES is not set or CONFIG_MODULES=n
```

### Runtime Issues

**QEMU: `Kernel panic - not syncing: No working init found`**

Causes:
1. Missing initramfs
2. Wrong console device

Solutions:
```bash
# Verify initramfs exists
ls -lh bench-images/busybox/busybox-vi-initrd.cpio.gz

# Use correct console
-append "console=ttyAMA0"

# Verify initramfs is passed
-initrd bench-images/busybox/busybox-vi-initrd.cpio.gz
```

**QEMU: Boot hangs at "Booting Linux"**

Cause: Serial console misconfigured

Solution:
```bash
# Ensure these are in kernel config
grep -E 'SERIAL_AMBA_PL011|SERIAL_AMBA_PL011_CONSOLE' .config

# Use QEMU serial flags
-nographic -serial mon:stdio
```

### Performance Issues

**Slow build times**

Solutions:
```bash
# 1. Use more cores
export MINIVIM_JOBS=$(nproc)

# 2. Enable ccache
export CC="ccache clang"

# 3. Reduce I/O overhead
export KCFLAGS="-pipe"

# 4. Skip mrproper on incremental builds
export SKIP_MRPROPER=1
```

**Large kernel size (>5 MB)**

Check for enabled subsystems:
```bash
# Should all be disabled
grep -E 'CONFIG_DRM|CONFIG_ATA|CONFIG_USB_SUPPORT|CONFIG_SOUND' .config

# Expected: =n or "is not set"
```

If enabled, regenerate config:
```bash
make mrproper
make ARCH=arm tinyconfig
# Re-merge configs
```

## CI/CD Integration

### GitHub Actions

The workflow is already configured in `.github/workflows/minivim-build.yml`:

```yaml
- arch: armv7
  packages: >-
    build-essential clang lld llvm curl bc flex bison libncurses-dev
    libssl-dev libelf-dev dwarves ccache gcc-arm-linux-gnueabihf
  cross: arm-linux-gnueabihf-
```

**Trigger workflow:**
```bash
# Push to minivim-refresh branch
git checkout minivim-refresh
git push origin minivim-refresh

# Or manually dispatch
# GitHub UI: Actions → MiniVim Kernel Builds → Run workflow
```

**Download artifacts:**
```bash
# Via gh CLI
gh run download <run-id> -n minivim-armv7

# Or via web UI
# Actions → MiniVim Kernel Builds → Latest run → Artifacts → minivim-armv7
```

## Advanced Configuration

### Incremental Builds

**First build:**
```bash
export SKIP_MRPROPER=0
./scripts/benchmarks/build-minivim-kernel.sh armv7 6.17.14
```

**Subsequent builds:**
```bash
export SKIP_MRPROPER=1
./scripts/benchmarks/build-minivim-kernel.sh armv7 6.17.14
```

### Custom Kernel Config

**Add custom options:**
```bash
cd artifacts/minivim/work/linux-6.17.14

# Interactive config
make ARCH=arm menuconfig

# Save to custom fragment
./scripts/diffconfig .config.old .config > my-custom.config

# Apply custom config
./scripts/kconfig/merge_config.sh -m .config my-custom.config
```

### Optimization Flags

**Aggressive optimization (may break):**
```bash
export KCFLAGS="-O3 -march=armv7-a -mtune=cortex-a15 -pipe"
```

**Debug build:**
```bash
export KCFLAGS="-g -O0"
echo "CONFIG_DEBUG_INFO=y" >> .config
make olddefconfig
```

## Command Reference

### Essential Commands

```bash
# Complete automated workflow
./scripts/benchmarks/build-armv7-6.17-complete.sh

# Manual kernel build
./scripts/benchmarks/build-minivim-kernel.sh armv7 6.17.14

# Validation only
./scripts/benchmarks/validate-armv7-kernel.sh 6.17.14

# QEMU boot test
qemu-system-arm -machine virt -cpu cortex-a15 -m 512M \
  -kernel bench-images/minivim/zImage-armv7-6.17.14 \
  -initrd bench-images/busybox/busybox-vi-initrd.cpio.gz \
  -nographic -serial mon:stdio -append "console=ttyAMA0"
```

### Cleanup

```bash
# Remove build artifacts
rm -rf artifacts/minivim/work/linux-6.17.14

# Remove downloaded tarball
rm artifacts/minivim/work/linux-6.17.14.tar.xz

# Complete cleanup (preserves final kernel)
rm -rf artifacts/minivim/work/*
```

## Next Steps

1. ✅ Complete kernel build and validation
2. 📊 Capture benchmark timings
3. 📝 Update `docs/virtualization/minivim-kernel.md`
4. 📦 Package artifacts for release
5. 🔄 Integrate with nightly builds (issue #557)

## Support

- **Issue Tracker:** ryanmaclean/vibecode-webgui#576
- **Related Issues:** #573 (x86_64), #574 (arm64)
- **Documentation:** `docs/virtualization/minivim-kernel.md`

---

**Guide Version:** 1.0  
**Last Updated:** October 2025  
**Maintainer:** Atlas → Velocity hand-off
