# MiniVim Kernel Build Benchmarks

This directory contains build timing logs and CPU profiles for MiniVim kernel builds across different architectures and hardware configurations.

## Directory Structure

```
reports/benchmarks/
├── README.md                          # This file
├── arm64-6.17-build-report.json       # Build timing for arm64 6.17.x
├── arm64-6.17-cpu-profile.txt         # CPU info from M-series hardware
├── arm64-6.17-hyperkit.json          # HyperKit boot validation results
├── arm64-6.17-lima-vz.json           # Lima vmType=vz boot results
└── x86_64-6.17-build-report.json     # Build timing for x86_64 6.17.x (reference)
```

## Expected Metrics

### Build Timing Report Format

```json
{
  "arch": "arm64",
  "kernel_version": "6.17.14",
  "hardware": {
    "model": "Apple M1 Max",
    "cores_performance": 8,
    "cores_efficiency": 2,
    "memory_gb": 64
  },
  "build": {
    "clean_build_seconds": 650,
    "clean_build_minutes": 10.8,
    "incremental_build_seconds": 280,
    "incremental_build_minutes": 4.7,
    "compiler": "ccache clang",
    "jobs": 8,
    "kcflags": "-pipe"
  },
  "output": {
    "image_path": "bench-images/minivim/Image-arm64-6.17.14",
    "image_size_bytes": 9437184,
    "image_size_mb": 9.0
  },
  "timestamp": "2025-10-23T04:20:00Z"
}
```

### Boot Validation Report Format

```json
{
  "test": "lima_vz_boot",
  "kernel": "bench-images/minivim/Image-arm64-6.17.14",
  "initrd": "bench-images/busybox/busybox-neovim-initrd.cpio.gz",
  "runs": 3,
  "boot_times_seconds": [2.51, 2.48, 2.53],
  "average_boot_seconds": 2.51,
  "vm_type": "vz",
  "arch": "aarch64",
  "success": true,
  "timestamp": "2025-10-23T04:25:00Z"
}
```

## How to Generate Reports

### Build Timing

The build script automatically captures basic information. For detailed timing:

```bash
# Clean build with timing
time (
  PATH="/usr/local/opt/make/libexec/gnubin:$PATH" \
  CC="ccache clang" KCFLAGS=-pipe \
  MINIVIM_JOBS=$(sysctl -n hw.logicalcpu) \
  ./scripts/benchmarks/build-minivim-kernel.sh arm64 6.17.14
) 2>&1 | tee reports/benchmarks/arm64-6.17-build.log

# Incremental build with timing
time (
  SKIP_MRPROPER=1 \
  PATH="/usr/local/opt/make/libexec/gnubin:$PATH" \
  CC="ccache clang" KCFLAGS=-pipe \
  MINIVIM_JOBS=$(sysctl -n hw.logicalcpu) \
  ./scripts/benchmarks/build-minivim-kernel.sh arm64 6.17.14
) 2>&1 | tee reports/benchmarks/arm64-6.17-incremental-build.log
```

### CPU Profile

```bash
# macOS (Apple Silicon)
sysctl -a | grep -E "hw\.(logicalcpu|physicalcpu|cpufrequency|memsize|machine)" \
  > reports/benchmarks/arm64-6.17-cpu-profile.txt

# Also capture detailed CPU info
system_profiler SPHardwareDataType >> reports/benchmarks/arm64-6.17-cpu-profile.txt
```

### Boot Validation

```bash
# Lima boot test
python3 scripts/benchmarks/vim_hypervisor_bench.py \
  --kernel bench-images/minivim/Image-arm64-6.17.14 \
  --runs 3 \
  --output reports/benchmarks/arm64-6.17-lima-vz.json
```

## Comparison Baselines

### Intel Reference (x86_64 6.12.10)
- **Hardware:** 2019 MacBook Pro, Intel i7-9750H @ 2.60GHz, 12 threads, 32GB RAM
- **Clean Build:** ~20 minutes (1200 seconds)
- **Incremental Build:** ~8 minutes (480 seconds)
- **Kernel Size:** ~12 MB
- **Boot Time:** 4.38 seconds

### Apple Silicon Target (arm64 6.17.14)
- **Hardware:** M1 Max or newer (8P+2E cores preferred)
- **Expected Clean Build:** 10-12 minutes (600-720 seconds)
- **Expected Incremental Build:** 4-5 minutes (240-300 seconds)
- **Expected Kernel Size:** 8-10 MB (20% smaller)
- **Expected Boot Time:** 2.5-2.8 seconds (43% improvement)

## Notes

- All timing measurements should include ccache state (cold/warm)
- Clean builds require `SKIP_MRPROPER=0` (default)
- Incremental builds require `SKIP_MRPROPER=1`
- Boot times measured from kernel load to shell prompt
- Use `--runs 3` minimum for boot benchmarks to account for variance
