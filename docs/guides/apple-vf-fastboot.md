# Apple VF Micro-VM Fast Boot Experiment

This document describes the fast boot optimization experiment for Apple Virtualization Framework (VF) using EFI-stub kernel and trimmed BusyBox initramfs.

## Goals

- **Target**: Sub-3 second cold boot to `/healthz` endpoint
- **Method**: EFI-stub kernel (no GRUB) + minimal BusyBox initramfs
- **Platform**: Apple Silicon (M1/M2/M3/M4) with macOS Virtualization.framework

## Background

Current OpenVSCode microVM boot times:
- ~6.1s on macOS HVF (x86_64 QEMU)
- ~19.5s on arm64 TCG emulation (Intel host)
- ~6.5s on native vfkit (Apple Silicon)

The overhead comes from:
1. GRUB bootloader initialization
2. Large initramfs (~69MB gzipped with glibc + OpenVSCode)
3. Full userspace initialization

## Optimization Strategy

### 1. EFI-Stub Kernel

Instead of GRUB → Kernel boot sequence, EFI-stub kernels boot directly:

```
Traditional: EFI firmware → GRUB → Kernel → /init
EFI-Stub:    EFI firmware → Kernel (EFI app) → /init
```

Benefits:
- Eliminates GRUB boot time (~0.5-1s savings)
- Kernel is loaded directly as an EFI application
- Apple VF natively supports this via `VZLinuxBootLoader`

Kernel config additions:
```
CONFIG_EFI=y
CONFIG_EFI_STUB=y
CONFIG_EFI_GENERIC_STUB=y
```

### 2. Trimmed BusyBox Initramfs

Minimal initramfs with only:
- Static BusyBox binary (~1.5MB)
- Simple `/init` script
- BusyBox httpd for `/healthz` endpoint

Target size: < 2MB compressed (vs 69MB current)

### 3. Fast Init Script

Optimized `/init` that:
- Mounts only essential filesystems (proc, sys, dev, tmp)
- Configures network with static IP (skips DHCP)
- Starts httpd immediately for `/healthz`

## Implementation

### Files Created

| File | Purpose |
|------|---------|
| `scripts/benchmarks/kernel-configs/efi-stub-arm64.config` | EFI-stub kernel configuration |
| `scripts/benchmarks/build-minimal-initramfs.sh` | Builds trimmed BusyBox initramfs |
| `scripts/benchmarks/build-efi-stub-kernel.sh` | Builds EFI-stub kernel for arm64 |
| `scripts/benchmarks/applevf_fastboot_bench.sh` | Benchmarking script for Apple VF |

### Build Instructions

#### Prerequisites

```bash
# Install vfkit
brew install vfkit

# For kernel builds, use a Linux VM (Lima recommended)
brew install lima
limactl start kernel-builder
```

#### Build Minimal Initramfs

```bash
./scripts/benchmarks/build-minimal-initramfs.sh arm64
# Output: bench-images/apple-vf-fastboot/initramfs-minimal.cpio.gz
```

#### Build EFI-Stub Kernel

```bash
# Run in Lima or native Linux
lima kernel-builder -- ./scripts/benchmarks/build-efi-stub-kernel.sh arm64 6.12.10
# Output: bench-images/apple-vf-fastboot/vmlinux-efi-stub
```

#### Run Benchmarks

```bash
./scripts/benchmarks/applevf_fastboot_bench.sh bench 5
```

## Expected Results

| Configuration | Boot to /healthz | Notes |
|---------------|------------------|-------|
| Current (GRUB + full initramfs) | ~6.1s | Baseline |
| EFI-stub + minimal initramfs | < 3s | Target |
| EFI-stub + static IP + httpd only | < 2s | Optimal |

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  curl http://localhost:3000/healthz                  │
├─────────────────────────────────────────────────────┤
│  Minimal Alpine VM                                   │
│  ├─ BusyBox httpd (port 3000)                       │
│  ├─ /init (fast boot script)                        │
│  └─ EFI-stub kernel (direct EFI boot)               │
├─────────────────────────────────────────────────────┤
│  Apple Virtualization.framework (vfkit)             │
│  ├─ VZLinuxBootLoader (EFI-stub support)            │
│  ├─ virtio-net (NAT networking)                     │
│  └─ virtio-rng (fast entropy)                       │
├─────────────────────────────────────────────────────┤
│  macOS + Apple Silicon                               │
└─────────────────────────────────────────────────────┘
```

## Benchmarking Methodology

1. **Cold boot measurement**: Time from `vfkit` process start to `/healthz` HTTP 200
2. **Iterations**: 5 runs minimum for statistical significance
3. **Polling interval**: 50ms for accurate measurement
4. **Warm-up**: First run discarded (cache effects)

Results are saved to `docs/reports/benchmarks/applevf-fastboot-*.json`.

## Comparison with Other Runtimes

| Runtime | Platform | Boot Time | Notes |
|---------|----------|-----------|-------|
| vfkit (current) | Apple Silicon | ~6.5s | GRUB + full initramfs |
| vfkit (optimized) | Apple Silicon | < 3s | EFI-stub + minimal |
| QEMU HVF | Intel Mac | ~6.1s | x86_64 guest |
| QEMU TCG | Any | ~19.5s | Emulation |
| Firecracker | Linux | ~125ms | Reference target |
| Docker | macOS | ~0.3s | Container (not VM) |

## Future Optimizations

1. **Kernel size reduction**: Further config trimming for < 5MB kernel
2. **Embedded initramfs**: Build initramfs into kernel binary
3. **virtio-vsock**: Use vsock instead of TCP for lower latency
4. **Memory balloon**: Start with minimal RAM, expand as needed
5. **Snapshot/restore**: Save VM state for instant resume

## References

- [Apple Virtualization.framework](https://developer.apple.com/documentation/virtualization)
- [Linux EFI Stub Documentation](https://www.kernel.org/doc/html/latest/admin-guide/efi-stub.html)
- [vfkit GitHub](https://github.com/crc-org/vfkit)
- [Firecracker microVM](https://firecracker-microvm.github.io/) (reference architecture)
