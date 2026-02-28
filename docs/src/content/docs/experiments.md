---
title: "Experiments"
description: "Experimental features and performance benchmarking for VibeCode"
sidebar:
  order: 60
---

# Experiments

The `experiments/` directory contains experimental features, performance optimizations, and benchmarking tools for VibeCode. These experiments explore cutting-edge virtualization technologies and performance optimization strategies.

## Overview

Experiments are isolated development areas where new ideas, technologies, and optimizations are tested before being integrated into the main platform. This allows for rapid prototyping and performance validation without impacting the stable codebase.

## Active Experiments

### Apple Virtualization Framework Fast-Boot microVM

**Location**: `experiments/microvm/`

A specialized experiment focusing on building minimal ARM64 kernels optimized for ultra-fast boot times on Apple Silicon using the Apple Virtualization Framework.

#### Purpose

- Minimize VM boot time for development workflows
- Optimize kernel size and startup performance
- Provide fast, ephemeral development environments
- Benchmark Apple Virtualization Framework capabilities

#### Quick Start

```bash
# Build kernel (requires Docker)
cd experiments/microvm
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

#### Using the Benchmark Harness

```bash
export MICROVM_ARCH=arm64 MICROVM_RUNTIME=applevf MICROVM_PORT=4600
./scripts/benchmarks/vscode_microvm.sh start
./scripts/benchmarks/vscode_microvm.sh measure 5
```

#### Dependencies

- Docker or Colima (for kernel builds)
- vfkit >= 0.6.0 (Apple Virtualization Framework CLI)
- gvproxy (network proxy for VMs)

#### Key Features

- **Minimal Kernel**: Custom-built Linux kernels with only essential drivers
- **Fast Boot**: Optimized for sub-second boot times
- **ARM64 Native**: Built specifically for Apple Silicon
- **Development Ready**: Includes tools for benchmarking and testing

## Benchmarking Scripts

The `scripts/benchmarks/` directory contains a comprehensive suite of performance testing tools:

### Kernel Building

- **`build-applevf-fastboot-assets.sh`** - Build complete fast-boot kernel assets
- **`build-minimal-initramfs.sh`** - Create minimal initramfs images
- **`build-busybox-musl.sh`** - Compile BusyBox with musl libc for smaller binaries
- **`build-efi-stub-kernel.sh`** - Build EFI stub kernels for direct boot

### Performance Testing

- **`applevf_fastboot_bench.sh`** - Benchmark Apple Virtualization Framework boot times
- **`m-series-performance-test.sh`** - Test performance on M-series processors
- **`noisy-neighbor-experiment.sh`** - Measure VM interference and resource contention
- **`alpine_chromium_bench.sh`** - Browser performance benchmarks in Alpine Linux

### Development Tools

- **`vscode_microvm.sh`** - VS Code server benchmarking in microVMs
- **`openvscode-benchmark.sh`** - OpenVSCode Server performance tests
- **`compare-vscode-builds.sh`** - Compare different VS Code build configurations

### Specialized Environments

- **`build-neovim-initramfs.sh`** - Build Neovim-equipped initramfs
- **`build-neovim-avante-initramfs.sh`** - Neovim with Avante AI integration
- **`test-neovim-minimal.sh`** - Test minimal Neovim configurations

## Running Benchmarks

### Prerequisites

Before running benchmarks, ensure you have:

```bash
# Check dependencies
which docker vfkit gvproxy
```

### Basic Benchmark Workflow

1. **Build kernel assets**
   ```bash
   ./scripts/benchmarks/build-applevf-fastboot-assets.sh
   ```

2. **Run performance tests**
   ```bash
   ./scripts/benchmarks/applevf_fastboot_bench.sh
   ```

3. **Analyze results**
   Results are typically output to `bench-results/` or logged to console

### Specialized Benchmarks

#### VS Code Server Performance

```bash
# Start microVM with VS Code
export MICROVM_ARCH=arm64 MICROVM_RUNTIME=applevf
./scripts/benchmarks/vscode_microvm.sh start

# Run measurements (5 iterations)
./scripts/benchmarks/vscode_microvm.sh measure 5

# Clean up
./scripts/benchmarks/vscode_microvm.sh stop
```

#### M-Series Processor Testing

```bash
# Run comprehensive M-series performance tests
./scripts/benchmarks/m-series-performance-test.sh
```

## Performance Metrics

Experiments track several key performance indicators:

- **Boot Time**: Time from VM start to init process running
- **Memory Footprint**: RAM usage for kernel and userspace
- **Kernel Size**: Compressed kernel image size
- **I/O Performance**: Disk and network throughput
- **CPU Utilization**: Processor efficiency under various workloads

## Best Practices

### When Running Experiments

1. **Isolate Tests**: Close unnecessary applications to reduce interference
2. **Repeat Measurements**: Run benchmarks multiple times for statistical significance
3. **Document Changes**: Record configuration changes and their impact
4. **Use Consistent Hardware**: Run comparisons on the same machine

### Contributing Experiments

To add a new experiment:

1. **Create Directory**: `experiments/your-experiment/`
2. **Add README**: Document purpose, setup, and usage
3. **Include Scripts**: Provide automation for building and testing
4. **Add Benchmarks**: Create measurement scripts in `scripts/benchmarks/`
5. **Update This Doc**: Add your experiment to this documentation

## Integration Path

Successful experiments follow this path:

1. **Prototype** - Prove concept in `experiments/`
2. **Benchmark** - Validate performance improvements
3. **Refine** - Optimize based on measurements
4. **Review** - Code review and testing
5. **Integrate** - Merge into main codebase
6. **Document** - Update production documentation

## Current Focus Areas

### Active Research

- **Boot Time Optimization**: Reducing VM startup latency
- **Memory Efficiency**: Minimizing RAM footprint for development VMs
- **Kernel Customization**: Tailoring kernels for specific workloads
- **Apple Silicon Integration**: Maximizing M-series processor capabilities

### Future Directions

- **GPU Pass-through**: Direct GPU access for ML workloads
- **Network Optimization**: High-performance VM networking
- **Storage Performance**: Fast disk I/O for development workflows
- **Multi-VM Orchestration**: Efficient management of multiple VMs

## Troubleshooting

### Common Issues

**Docker build failures**
- Ensure Docker or Colima is running
- Check available disk space (kernel builds can be large)
- Verify internet connection for downloading kernel sources

**vfkit not found**
- Install vfkit: `brew install vfkit`
- Ensure version >= 0.6.0: `vfkit --version`

**Slow boot times**
- Check kernel configuration for unnecessary drivers
- Verify SSD is being used (not spinning disk)
- Reduce initramfs size by removing unused tools

**Permission errors**
- Some scripts may need execution permissions: `chmod +x script.sh`
- Docker commands may need sudo or proper group membership

## Related Documentation

- **[Build Guide](./build-guide/)** - Complete build instructions
- **[Developer Guide](./developer-guide/)** - Development workflow
- **[Performance Optimization](./developer-guide/#performance-optimization)** - General optimization strategies

## Resources

- **[Apple Virtualization Framework](https://developer.apple.com/documentation/virtualization)** - Official Apple documentation
- **[vfkit Documentation](https://github.com/crc-org/vfkit)** - vfkit usage and examples
- **[Linux Kernel Documentation](https://www.kernel.org/doc/)** - Kernel configuration and building

---

Experiments represent the cutting edge of VibeCode development. Contributions and new ideas are always welcome!
