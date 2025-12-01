# MiniVim Kernel Images

This directory contains minimal kernel images built for MiniVim benchmarks.

## Files

After building, you'll find:
- `bzImage-x86_64-<version>` - x86_64 kernel image
- `Image-arm64-<version>` - ARM64 kernel image
- `zImage-armv7-<version>` - ARMv7 kernel image
- `cpuinfo-<arch>.txt` - CPU information from the build host

## Building

Use the build script:

```bash
# Build for x86_64
./scripts/benchmarks/build-minivim-kernel.sh x86_64 6.17

# Build for ARM64
./scripts/benchmarks/build-minivim-kernel.sh arm64 6.17

# Build for ARMv7
./scripts/benchmarks/build-minivim-kernel.sh armv7 6.17
```

## CI/CD

The GitHub Actions workflow `.github/workflows/minivim-build.yml` automatically builds all architectures on push to the `minivim-refresh` branch.

## Configuration

Kernel configurations are stored in `scripts/benchmarks/kernel-configs/`:
- `minivim-base.config` - Base configuration for all architectures
- `minivim-x86_64.config` - x86_64 specific settings
- `minivim-arm64.config` - ARM64 specific settings
- `minivim-armv7.config` - ARMv7 specific settings

## Performance Goals

- Boot-to-vi: < 3 seconds
- Minimal kernel size
- Virtio support for virtualization
- No unnecessary drivers or subsystems
