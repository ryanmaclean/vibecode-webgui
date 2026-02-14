# VM Launch Methods

This document describes the various virtualization methods available for running Alpine Linux VMs in VibeCode, with platform-specific recommendations.

## Overview

VibeCode supports multiple VM launch methods to accommodate different host platforms and use cases. The primary method varies by platform:

- **macOS (M-series)**: Apple Virtualization Framework (recommended)
- **macOS (Intel)**: Apple Virtualization Framework or QEMU
- **Linux**: QEMU/KVM (recommended)
- **Windows**: Not currently supported (future: WSL2 or QEMU)

## 1. Apple Virtualization Framework

**Platform**: macOS 11+ (Big Sur and later)
**Architecture**: ARM64 (M1/M2/M3/M4) and x86_64 (Intel)
**Status**: Primary method for macOS

### Overview

The Apple Virtualization Framework (`Virtualization.framework`) provides native, high-performance virtualization on macOS. VibeCode uses this via the `vfkit` binary.

### Advantages

- **Native performance**: Hardware-accelerated, close to bare-metal speed
- **Apple Silicon optimization**: Excellent performance on M-series Macs
- **Modern API**: Clean Swift/Objective-C API with good documentation
- **Rosetta 2 support**: Can run x86_64 binaries in ARM64 VMs (macOS 13+)
- **Graphics acceleration**: virtio-gpu support for GUI workloads
- **Network integration**: Seamless NAT and bridged networking

### Limitations

- **macOS-only**: Cannot be used on Linux or Windows
- **Recent macOS required**: Needs macOS 11+ (some features require 12+/13+)
- **Limited cross-architecture**: Best for ARM64 on M-series, x86_64 on Intel

### Implementation

VibeCode uses the `vfkit` binary as a lightweight frontend to the Apple Virtualization Framework:

```bash
# Launch Alpine Linux VM with vfkit
vfkit \
  --cpus 2 \
  --memory 4096 \
  --bootloader efi,variable-store=/path/to/vars.bin \
  --device virtio-blk,path=/path/to/disk.img \
  --device virtio-net,nat \
  --device virtio-serial,stdio
```

### Configuration Files

- `platforms/macos/virtiofsd/vfkit-config.json` - vfkit configuration template
- `platforms/macos/virtiofsd/vfkit-alpine.sh` - Launch script example

### References

- [Apple Virtualization Framework Documentation](https://developer.apple.com/documentation/virtualization)
- [vfkit GitHub Repository](https://github.com/crc-org/vfkit)

## 2. QEMU

**Platform**: Linux, macOS, Windows
**Architecture**: x86_64, ARM64, cross-emulation supported
**Status**: Recommended for Linux hosts, fallback for macOS

### Overview

QEMU is a mature, cross-platform virtualization and emulation system. It supports both hardware-accelerated virtualization (KVM on Linux) and CPU emulation for cross-architecture scenarios.

### Advantages

- **Cross-platform**: Runs on Linux, macOS, Windows
- **Cross-architecture**: Can emulate ARM64 on x86_64 and vice versa
- **Mature ecosystem**: Extensive documentation, large community
- **KVM acceleration**: Near-native performance on Linux with KVM
- **Flexible configuration**: Supports wide range of devices and options

### Limitations

- **Complex configuration**: More flags and options than Apple VZ
- **Slower without KVM**: Emulation mode is significantly slower
- **macOS performance**: Not as fast as Apple Virtualization Framework on M-series

### Implementation

#### Linux (KVM-accelerated)

```bash
# Launch Alpine Linux VM with QEMU/KVM
qemu-system-aarch64 \
  -machine virt,accel=kvm,gic-version=3 \
  -cpu host \
  -smp 2 \
  -m 4096 \
  -bios /usr/share/AAVMF/AAVMF_CODE.fd \
  -drive if=none,file=/path/to/disk.img,id=hd0 \
  -device virtio-blk-device,drive=hd0 \
  -netdev user,id=net0 \
  -device virtio-net-device,netdev=net0 \
  -nographic
```

#### macOS (HVMF acceleration)

```bash
# Launch on macOS with HVMF
qemu-system-aarch64 \
  -machine virt,accel=hvf,highmem=off \
  -cpu host \
  -smp 2 \
  -m 4096 \
  -bios /opt/homebrew/share/qemu/edk2-aarch64-code.fd \
  -drive if=none,file=/path/to/disk.img,id=hd0 \
  -device virtio-blk-device,drive=hd0 \
  -netdev user,id=net0 \
  -device virtio-net-device,netdev=net0 \
  -nographic
```

#### Cross-architecture (x86_64 → ARM64 emulation)

```bash
# Emulate ARM64 on x86_64 Linux workstation
qemu-system-aarch64 \
  -machine virt \
  -cpu cortex-a72 \
  -smp 2 \
  -m 4096 \
  -bios /usr/share/AAVMF/AAVMF_CODE.fd \
  -drive if=none,file=/path/to/disk.img,id=hd0 \
  -device virtio-blk-device,drive=hd0 \
  -netdev user,id=net0 \
  -device virtio-net-device,netdev=net0 \
  -nographic
```

**Note**: Emulation mode is 10-100x slower than native/KVM. Use for testing compatibility, not performance benchmarks.

### Configuration Files

- `platforms/linux/qemu/` - QEMU launch scripts (if available)
- Future: QEMU-specific configuration templates

### References

- [QEMU Documentation](https://www.qemu.org/documentation/)
- [QEMU/KVM on Linux](https://www.linux-kvm.org/page/Main_Page)

## 3. Lima

**Platform**: macOS, Linux
**Architecture**: ARM64, x86_64
**Status**: Alternative method, wrapper around QEMU/Apple VZ

### Overview

Lima (Linux on Mac) is a higher-level tool that simplifies VM management on macOS. It can use either QEMU or Apple Virtualization Framework as the backend.

### Advantages

- **Simple YAML configuration**: Easier than raw QEMU commands
- **Automatic file sharing**: Built-in directory mounting
- **Multi-VM management**: Easy to create and manage multiple VMs
- **Backend flexibility**: Can switch between QEMU and Apple VZ

### Limitations

- **Another abstraction layer**: Adds complexity on top of underlying hypervisors
- **Less control**: Abstracts away some low-level configuration options
- **macOS/Linux only**: Not available on Windows

### Implementation

```yaml
# lima-alpine.yaml
vmType: "vz"  # Use Apple Virtualization Framework (or "qemu")
os: "Linux"
arch: "aarch64"
cpus: 2
memory: "4GiB"
disk: "10GiB"

images:
  - location: "https://dl-cdn.alpinelinux.org/alpine/v3.22/releases/aarch64/alpine-virt-3.22.0-aarch64.iso"
    arch: "aarch64"

mounts:
  - location: "~"
    writable: false
  - location: "/tmp/lima"
    writable: true
```

```bash
# Launch VM with Lima
limactl start lima-alpine.yaml
limactl shell alpine
```

### References

- [Lima GitHub Repository](https://github.com/lima-vm/lima)
- [Lima Documentation](https://lima-vm.io/)

## 4. vfkit

**Platform**: macOS
**Architecture**: ARM64, x86_64
**Status**: Direct frontend to Apple Virtualization Framework (used by VibeCode)

### Overview

`vfkit` is a lightweight command-line tool that provides direct access to the Apple Virtualization Framework without the abstractions of Lima or other higher-level tools.

### Advantages

- **Minimal overhead**: Direct API calls to Virtualization.framework
- **Simple CLI**: Straightforward command-line interface
- **macOS-native**: Built for macOS, leverages all platform features
- **Well-maintained**: Actively developed by Red Hat (part of CRC project)

### Limitations

- **macOS-only**: Not portable to other platforms
- **Less mature**: Newer than QEMU, smaller community

### Implementation

See "Apple Virtualization Framework" section above for vfkit examples. VibeCode uses vfkit as the primary interface to Apple VZ.

### References

- [vfkit GitHub Repository](https://github.com/crc-org/vfkit)
- [vfkit Documentation](https://github.com/crc-org/vfkit/tree/main/doc)

## Recommendations by Platform

### macOS (M1/M2/M3/M4)

**Recommended**: Apple Virtualization Framework via vfkit

```
Priority:
1. vfkit (current implementation)
2. Lima with vmType: "vz"
3. QEMU with accel=hvf (fallback)
```

**Rationale**: Apple VZ provides the best performance on M-series Macs. vfkit gives direct access without abstraction layers.

### macOS (Intel)

**Recommended**: Apple Virtualization Framework via vfkit (macOS 11+) or QEMU

```
Priority:
1. vfkit (if macOS 11+)
2. QEMU with accel=hvf
3. Lima with vmType: "vz" or "qemu"
```

**Rationale**: Apple VZ works on Intel but QEMU is more mature. Use VZ for native integration, QEMU for compatibility.

### Linux (x86_64 with KVM)

**Recommended**: QEMU/KVM

```
Priority:
1. QEMU/KVM (native x86_64)
2. QEMU/KVM with ARM64 emulation (for cross-testing)
3. Lima (if simpler management desired)
```

**Rationale**: QEMU/KVM provides near-native performance on Linux. Essential for CI/CD on Linux workstations.

### Linux (ARM64 with KVM)

**Recommended**: QEMU/KVM

```
Priority:
1. QEMU/KVM (native ARM64)
2. Lima (if simpler management desired)
```

**Rationale**: QEMU/KVM is the standard for ARM64 Linux virtualization.

## Testing Infrastructure

For VibeCode's test infrastructure:

- **MBP M1/Mac Studio M2 Ultra**: Use vfkit (Apple VZ) for ARM64 testing
- **Linux workstations (AMD 5950x/7950x)**: Use QEMU/KVM for x86_64 native testing
- **Cross-architecture testing**: Use QEMU emulation mode on Linux (slower but validates compatibility)

See [TEST_INFRASTRUCTURE.md](TEST_INFRASTRUCTURE.md) for detailed test environment setup.

## Related Issues

- [#1877 - Document VM launch methods (vfkit, QEMU, Lima)](https://github.com/ryanmaclean/vibecode/issues/1877)
- [#1850 - Alpine Linux VM: Boot, but services fail to start (macOS)](https://github.com/ryanmaclean/vibecode/issues/1850)
- [#1851 - Test Alpine Linux VM on x86_64 Linux with QEMU/KVM](https://github.com/ryanmaclean/vibecode/issues/1851)
- [#1866 - Implement health check retries and timeout improvements for VM services](https://github.com/ryanmaclean/vibecode/issues/1866)
- [#1867 - Validate VM services integration: SSH, PostgreSQL, Valkey, OpenVSCode, Docker](https://github.com/ryanmaclean/vibecode/issues/1867)

## Future Considerations

- **Windows support**: WSL2 or QEMU/WHPX acceleration
- **Cloud CI**: GitHub Actions with nested virtualization on larger runners
- **Container-based testing**: Lightweight alternative to full VMs for service testing
- **ASIF format**: Custom disk format for faster VM provisioning

## Appendix: Quick Reference

| Method | Platform | Performance | Cross-arch | Complexity |
|--------|----------|-------------|------------|------------|
| Apple VZ (vfkit) | macOS | Excellent | Limited | Low |
| QEMU/KVM | Linux | Excellent | Via emulation | Medium |
| QEMU/HVMF | macOS | Good | Via emulation | Medium |
| QEMU emulation | All | Poor | Yes | Medium |
| Lima | macOS/Linux | Varies | Via backend | Low |

**Legend**:
- Performance: Excellent (near-native), Good (80-90%), Poor (<50%)
- Cross-arch: Can run ARM64 on x86_64 or vice versa
- Complexity: Low (simple config), Medium (some flags), High (many options)
