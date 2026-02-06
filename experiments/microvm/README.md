# Apple Virtualization Framework Fast-Boot microVM

Tooling for building minimal ARM64 kernels optimized for fast boot on Apple Silicon
using Apple Virtualization Framework.

## Quick Start

```bash
# Build kernel (requires Docker)
./build-kernel.sh 6.12.10

# Build BusyBox (from project root)
./scripts/benchmarks/build-busybox-musl.sh arm64

# Run with vfkit
vfkit --cpus 4 --memory 2048 \
  --kernel bench-images/apple-vf/Image-arm64-6.12.10 \
  --initrd bench-images/busybox/initramfs.cpio.gz \
  --kernel-cmdline "console=hvc0 quiet rdinit=/init" \
  --device virtio-net,nat --device virtio-rng
```

## Using the Benchmark Harness

```bash
export MICROVM_ARCH=arm64 MICROVM_RUNTIME=applevf MICROVM_PORT=4600
./scripts/benchmarks/vscode_microvm.sh start
./scripts/benchmarks/vscode_microvm.sh measure 5
```

## Dependencies

- Docker/Colima, vfkit >= 0.6.0, gvproxy

See docs/vfkit-menu-structure.md for full vfkit command reference.
