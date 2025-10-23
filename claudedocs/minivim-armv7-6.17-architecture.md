# MiniVim ARMv7 6.17.x Architecture Documentation

**Version:** 1.0  
**Date:** October 2025  
**Architecture:** ARMv7 (32-bit ARM)  
**Target Kernel:** Linux 6.17.x  

## Executive Summary

This document details the ARMv7 32-bit architecture implementation for the MiniVim kernel refresh targeting Linux 6.17.x. The implementation extends virtualization benchmark coverage to Raspberry Pi class devices while maintaining the core goal of sub-5-second boot times.

## Architecture Overview

### Target Platforms

**Primary:**
- QEMU `virt` machine with Cortex-A15 CPU emulation
- GitHub Actions CI/CD cross-compilation (Ubuntu runners)

**Secondary:**
- Raspberry Pi 2/3 (physical hardware validation)
- HyperKit (macOS ARM virtualization, if applicable)

### Architecture Characteristics

**ARMv7-A Profile:**
- 32-bit ARM architecture
- Thumb-2 instruction set support
- NEON SIMD extensions
- VFPv3 floating-point unit
- Cortex-A series processors (A7, A15, A17)

**Memory Configuration:**
- HIGHMEM support for >4GB addressing
- Page size: 4KB
- Virtual address space: 32-bit (4GB)

## Kernel 6.17.x Features

### New in 6.17.x

1. **Security Enhancements:**
   - `CONFIG_HARDENED_USERCOPY=y` - Hardened copy_to/from_user
   - `CONFIG_FORTIFY_SOURCE=y` - Buffer overflow detection
   - `CONFIG_STACKPROTECTOR_STRONG=y` - Enhanced stack protection

2. **Memory Optimization:**
   - `CONFIG_KERNEL_LZ4=y` - Fast kernel decompression
   - `CONFIG_SLUB=y` - Efficient memory allocator

3. **Performance Features:**
   - `CONFIG_PREEMPT_VOLUNTARY=y` - Balanced preemption
   - `CONFIG_HZ_250=y` - 250Hz timer frequency (optimal for virtualization)

### Removed Features (6.17.x Optimization)

The following subsystems have been explicitly disabled to reduce kernel size and boot time:

- **Graphics:** DRM, AGP, framebuffer drivers
- **Storage:** ATA, SATA drivers (virtio-blk used instead)
- **Input:** HID generic, USB HID, mice, joysticks, tablets, touchscreens
- **Power:** CPU frequency scaling, CPU idle governors
- **Misc:** Sound, wireless, Bluetooth, staging drivers

## Virtualization Support

### Virtio MMIO

**Primary I/O Method:**
```
CONFIG_VIRTIO=y
CONFIG_VIRTIO_MMIO=y
CONFIG_VIRTIO_MMIO_CMDLINE_DEVICES=y
```

**Virtio Drivers (Built-in):**
- Block: `CONFIG_VIRTIO_BLK=y`
- Network: `CONFIG_VIRTIO_NET=y`
- Console: `CONFIG_VIRTIO_CONSOLE=y`
- Balloon: `CONFIG_VIRTIO_BALLOON=y`
- SCSI: `CONFIG_SCSI_VIRTIO=y`

**Note:** Virtio PCI is included via base config for x86 compatibility, but MMIO is the primary method for ARM.

### QEMU Configuration

**Recommended QEMU Options:**
```bash
qemu-system-arm \
  -machine virt \
  -cpu cortex-a15 \
  -m 512M \
  -kernel zImage-armv7-6.17.14 \
  -initrd busybox-vi-initrd.cpio.gz \
  -nographic \
  -serial mon:stdio \
  -append "console=ttyAMA0"
```

**Machine Type:** `virt`
- Generic ARM virtualization platform
- Virtio MMIO transport
- GICv2 interrupt controller
- PL011 UART serial console

**CPU Type:** `cortex-a15`
- ARMv7-A architecture
- Hardware virtualization support
- Out-of-order execution
- NEON and VFPv4 support

## Serial Console Configuration

### PL011 UART (Primary)

**Configuration:**
```
CONFIG_SERIAL_AMBA_PL011=y
CONFIG_SERIAL_AMBA_PL011_CONSOLE=y
CONFIG_SERIAL_OF_PLATFORM=y
```

**Console Device:** `ttyAMA0`

### 8250 UART (Raspberry Pi Auxiliary)

**Configuration:**
```
CONFIG_SERIAL_8250=y
CONFIG_SERIAL_8250_CONSOLE=y
CONFIG_SERIAL_8250_BCM2835AUX=y
```

**Console Device:** `ttyS0` (Pi), `ttyAMA0` (QEMU)

## Raspberry Pi Support

### BCM2835 SoC

**Minimal Configuration:**
```
CONFIG_ARCH_BCM=y
CONFIG_ARCH_BCM2835=y
CONFIG_BCM2835_MBOX=y
CONFIG_RASPBERRYPI_FIRMWARE=y
```

**Peripherals:**
- MMC/SD: BCM2835 SDHCI controller
- GPIO: Virtual GPIO via mailbox
- RTC: PL031 RTC driver

**Note:** Full Pi support adds ~500KB to kernel size. For pure virtualization, these can be disabled.

## Cross-Compilation

### Toolchain

**Recommended:**
```bash
gcc-arm-linux-gnueabihf (version >= 10.0)
clang with ARM cross-compilation support
```

**Environment Variables:**
```bash
export ARCH=arm
export CROSS_COMPILE=arm-linux-gnueabihf-
export CC="ccache clang"  # Optional, for faster builds
export KCFLAGS="-pipe"    # Optional, reduce I/O overhead
```

### GitHub Actions Integration

**CI Matrix Entry:**
```yaml
- arch: armv7
  packages: >-
    build-essential clang lld llvm curl bc flex bison libncurses-dev
    libssl-dev libelf-dev dwarves ccache gcc-arm-linux-gnueabihf
  cross: arm-linux-gnueabihf-
```

**Build Command:**
```bash
MINIVIM_JOBS=$(nproc) \
  CROSS_COMPILE=arm-linux-gnueabihf- \
  ./scripts/benchmarks/build-minivim-kernel.sh armv7 6.17
```

## Performance Targets

### Boot Time

**Target:** <5 seconds (boot-to-vi)
**Expected:** 4-4.5 seconds on QEMU with Cortex-A15

**Comparison:**
- x86_64: <3 seconds (Intel Core i7)
- arm64: <4 seconds (Apple M-series)
- armv7: <5 seconds (relaxed due to 32-bit limitations)

### Build Time

**GitHub Actions (16 cores):**
- Clean build: 20-25 minutes
- Incremental build: 8-12 minutes

**With Optimizations:**
- ccache: 30-40% reduction on subsequent builds
- clang with `-pipe`: 10-15% reduction in I/O time

### Kernel Size

**Target:** 3-4 MB (compressed zImage)

**Size Breakdown:**
- Base kernel: ~2.5 MB
- Virtio drivers (built-in): ~300 KB
- ARM platform code: ~500 KB
- BCM2835 support: ~500 KB (optional)

## Security Considerations

### Hardening Features

**Enabled in 6.17.x:**
1. Stack protection (strong)
2. Hardened usercopy
3. Fortify source
4. No module loading (`CONFIG_MODULES=n`)

**Disabled:**
- SELinux, AppArmor, SMACK (benchmark kernel only)
- Debugging symbols
- Kernel profiling

### ABI Compatibility

**EABI Only:**
```
CONFIG_AEABI=y
CONFIG_OABI_COMPAT=n
```

Modern ARM toolchains require EABI. OABI is disabled to reduce kernel size and eliminate legacy ABI attack surface.

## Memory Layout

### Page Configuration

**Page Size:** 4KB (`CONFIG_ARM_LPAE=n`)

**High Memory:**
```
CONFIG_HIGHMEM=y
CONFIG_HIGHPTE=y
```

Allows efficient use of systems with >768MB RAM.

### SLUB Allocator

```
CONFIG_SLUB=y
CONFIG_SLUB_CPU_PARTIAL=y
```

SLUB is more efficient than SLAB for small-memory systems and reduces fragmentation.

## Integration Points

### BusyBox Initramfs

**Location:** `bench-images/busybox/busybox-vi-initrd.cpio.gz`

**Size:** ~2-3 MB compressed

**Contents:**
- BusyBox multi-call binary
- Minimal init script
- Vi/Vim editor for benchmark endpoint

### Boot Process

1. **Kernel decompression** (LZ4, <1 second)
2. **Architecture init** (ARM platform detection)
3. **Device tree parsing** (QEMU virt machine)
4. **Virtio MMIO enumeration**
5. **Initramfs extraction** (BusyBox)
6. **Init process launch** (/init)
7. **Vi launch** (benchmark endpoint)

## Troubleshooting

### Common Issues

**1. Kernel Panic: No init found**
- Cause: Missing initramfs or wrong console device
- Solution: Ensure initramfs is specified and console=ttyAMA0

**2. Slow Boot Times**
- Cause: Unnecessary drivers probing
- Solution: Verify DRM, SATA, USB are disabled in config

**3. QEMU Hangs**
- Cause: Wrong machine type or missing virtio
- Solution: Use `-machine virt` and verify `CONFIG_VIRTIO_MMIO=y`

**4. Cross-compilation Fails**
- Cause: Missing toolchain or wrong ARCH
- Solution: Install gcc-arm-linux-gnueabihf, export ARCH=arm

## References

### Documentation

- [ARM Linux Kernel Documentation](https://www.kernel.org/doc/html/latest/arm/index.html)
- [QEMU ARM System Emulation](https://www.qemu.org/docs/master/system/target-arm.html)
- [Raspberry Pi Kernel Building](https://www.raspberrypi.org/documentation/linux/kernel/building.md)

### Related Issues

- #573: MiniVim kernel refresh - x86_64 6.17.x
- #574: MiniVim kernel refresh - arm64 6.17.x
- #576: MiniVim kernel refresh - armv7 6.17.x (this document)

### File Locations

- Kernel config: `scripts/benchmarks/kernel-configs/minivim-armv7.config`
- Build script: `scripts/benchmarks/build-minivim-kernel.sh`
- Validation: `scripts/benchmarks/validate-armv7-kernel.sh`
- Complete workflow: `scripts/benchmarks/build-armv7-6.17-complete.sh`

---

**Document Revision:** 1.0  
**Last Updated:** October 2025  
**Maintained by:** Atlas (hand-off to Velocity)
