# Alpine Linux Kernel Compatibility

This document tracks compatibility of Alpine Linux kernels with different virtualization platforms used by VibeCode.

## Compatibility Matrix

| Alpine Version | Architecture | Apple VZ (vfkit) | QEMU/KVM | Status | Notes |
|----------------|-------------|------------------|----------|--------|-------|
| 3.19 | aarch64 | ✓ Verified | ✓ Verified | Production | Current production kernel |
| 3.19 | x86_64 | N/A | ✓ Verified | Production | x86_64 Linux support |
| 3.20 | aarch64 | ✓ Tested | ✓ Tested | Tested | Stable release |
| 3.20 | x86_64 | N/A | ✓ Tested | Tested | Stable release |
| 3.21 | aarch64 | ○ Untested | ○ Untested | Available | Latest stable |
| 3.21 | x86_64 | N/A | ○ Untested | Available | Latest stable |
| 3.22 | aarch64 | ○ Untested | ○ Untested | Latest | Edge release (may not exist) |
| 3.22 | x86_64 | N/A | ○ Untested | Latest | Edge release (may not exist) |

**Legend:**
- ✓ = Verified working
- ○ = Available but not tested
- N/A = Not applicable (Apple VZ is ARM64 only)

## Required Kernel Config

### For Apple Virtualization Framework (vfkit)

The Apple Virtualization Framework requires specific VirtIO support for ARM64:

```
CONFIG_VIRTIO_BLK=y         # Block devices (storage)
CONFIG_VIRTIO_NET=y         # Network devices
CONFIG_VIRTIO_CONSOLE=y     # Serial console
CONFIG_VIRTIO_PCI=y         # PCI transport layer
CONFIG_VIRTIO_MMIO=y        # MMIO transport for ARM64
CONFIG_PCI_HOST_GENERIC=y   # Generic PCI host controller
CONFIG_SERIAL_AMBA_PL011=y  # ARM UART (console)
```

### For QEMU/KVM

QEMU/KVM requires similar VirtIO support plus KVM-specific options:

```
CONFIG_VIRTIO_BLK=y         # Block devices
CONFIG_VIRTIO_NET=y         # Network devices
CONFIG_VIRTIO_CONSOLE=y     # Serial console
CONFIG_VIRTIO_PCI=y         # PCI transport
CONFIG_VIRTIO_MMIO=y        # MMIO transport (ARM64)
CONFIG_KVM_GUEST=y          # KVM guest support (x86_64)
CONFIG_PVPANIC=y            # Panic notification to hypervisor
```

### Alpine Default Configs

Alpine Linux kernels come in several variants:

- **lts**: Long-term support kernel (recommended for production)
- **virt**: Optimized for virtualization (smaller, faster boot)
- **edge**: Latest kernel from Alpine Edge

For VibeCode, we use the **lts** (Long-Term Support) kernel variant, which includes all necessary VirtIO drivers by default.

## Download URLs

### Base URL Structure

Alpine kernels are available from the official CDN:

```
https://dl-cdn.alpinelinux.org/alpine/v{version}/releases/{arch}/netboot/
```

### Kernel Files

- **Kernel**: `vmlinuz-lts`
- **Initramfs**: `initramfs-lts`

### Examples

Alpine 3.19 ARM64:
```bash
# Kernel
curl -LO https://dl-cdn.alpinelinux.org/alpine/v3.19/releases/aarch64/netboot/vmlinuz-lts

# Initramfs
curl -LO https://dl-cdn.alpinelinux.org/alpine/v3.19/releases/aarch64/netboot/initramfs-lts
```

Alpine 3.20 x86_64:
```bash
# Kernel
curl -LO https://dl-cdn.alpinelinux.org/alpine/v3.20/releases/x86_64/netboot/vmlinuz-lts

# Initramfs
curl -LO https://dl-cdn.alpinelinux.org/alpine/v3.20/releases/x86_64/netboot/initramfs-lts
```

## Testing Kernels

### Automated Testing

Use the kernel compatibility test script:

```bash
./tests/vm-integration/test-kernel-compat.sh
```

This script:
1. Downloads kernels for all Alpine versions and architectures
2. Verifies file types and sizes
3. Checks architecture compatibility
4. On Linux: attempts QEMU boot test
5. Generates a compatibility matrix

### Manual Testing

#### Apple Virtualization Framework (macOS ARM64)

```bash
# Download kernel and initramfs
cd ~/.vfkit/vms/vibecode-alpine/kernel
curl -LO https://dl-cdn.alpinelinux.org/alpine/v3.21/releases/aarch64/netboot/vmlinuz-lts
curl -LO https://dl-cdn.alpinelinux.org/alpine/v3.21/releases/aarch64/netboot/initramfs-lts

# Test with vfkit
vfkit \
  --cpus 2 \
  --memory 2048 \
  --kernel vmlinuz-lts \
  --initrd initramfs-lts \
  --bootloader linux \
  --device virtio-blk,path=disk.img \
  --device virtio-net,nat,mac=52:54:00:12:34:56
```

#### QEMU (Linux or macOS)

```bash
# ARM64
qemu-system-aarch64 \
  -M virt \
  -cpu cortex-a72 \
  -m 2G \
  -kernel vmlinuz-lts \
  -initrd initramfs-lts \
  -append "console=ttyAMA0" \
  -nographic

# x86_64
qemu-system-x86_64 \
  -M pc \
  -m 2G \
  -kernel vmlinuz-lts \
  -initrd initramfs-lts \
  -append "console=ttyS0" \
  -nographic
```

## Known Issues

### Apple Virtualization Framework

1. **Kernel must be uncompressed**: vfkit requires an uncompressed kernel image
   - Compressed kernels (`vmlinuz`) must be decompressed to `vmlinux`
   - See `scripts/vfkit/02-download-alpine-kernel.py` for decompression code

2. **Serial console**: Must use ARM PL011 UART (`console=ttyAMA0`)
   - x86 serial console (`ttyS0`) won't work on ARM64

3. **Device tree**: Apple VZ provides its own device tree
   - No need to provide DTB file
   - Kernel auto-detects VZ-provided hardware

### QEMU/KVM

1. **KVM acceleration**: Requires matching host/guest architecture
   - ARM64 host → ARM64 guest only
   - x86_64 host → x86_64 guest only
   - Cross-architecture requires full emulation (slow)

2. **Console output**: Must specify correct console in kernel cmdline
   - ARM64: `console=ttyAMA0`
   - x86_64: `console=ttyS0`

## Version Support Policy

### Production (Currently 3.19)

- Fully tested on Apple VZ and QEMU
- All VibeCode features verified working
- Security updates monitored
- Recommended for all users

### Tested (3.20)

- Downloaded and verified
- Basic boot testing completed
- Not yet production default
- Safe for testing/development

### Available (3.21+)

- Published by Alpine project
- Not yet tested by VibeCode
- May work without issues
- Use at your own risk

### Edge Releases

- May not be stable
- URLs may not exist yet
- Only for experimentation
- Not recommended for production

## Upgrading Kernels

To upgrade to a new Alpine kernel version:

1. Test with the compatibility script:
   ```bash
   ./tests/vm-integration/test-kernel-compat.sh
   ```

2. Review compatibility matrix output

3. Update kernel version in download scripts:
   ```bash
   # Edit these files:
   scripts/vfkit/02-download-alpine-kernel.sh
   scripts/vfkit/02-download-alpine-kernel.py
   ```

4. Update `ALPINE_VERSION` and `ALPINE_RELEASE` variables

5. Test VM boot:
   ```bash
   ./scripts/vfkit/02-download-alpine-kernel.py
   ./scripts/vfkit/05-boot-alpine-vm.sh
   ```

6. Verify all services start correctly:
   - SSH
   - PostgreSQL
   - Valkey
   - OpenVSCode Server
   - Docker

7. Update this documentation with test results

## References

- [Alpine Linux Releases](https://alpinelinux.org/releases/)
- [Alpine Netboot Downloads](https://dl-cdn.alpinelinux.org/alpine/)
- [Apple Virtualization Framework](https://developer.apple.com/documentation/virtualization)
- [QEMU Documentation](https://www.qemu.org/documentation/)
- [VirtIO Specification](https://docs.oasis-open.org/virtio/virtio/v1.1/virtio-v1.1.html)

## Related Scripts

- `scripts/vfkit/02-download-alpine-kernel.sh` - Download Alpine kernel (bash)
- `scripts/vfkit/02-download-alpine-kernel.py` - Download Alpine kernel (Python)
- `tests/vm-integration/test-kernel-compat.sh` - Kernel compatibility testing
