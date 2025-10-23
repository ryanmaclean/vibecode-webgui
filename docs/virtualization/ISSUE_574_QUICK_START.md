# Issue #574 Quick Start Guide

## MiniVim arm64 6.17.x Kernel Refresh for Apple Silicon

This guide provides step-by-step instructions for building and validating the MiniVim kernel on Apple Silicon (M1/M2/M3/M4).

### Prerequisites

**Hardware:**
- Apple Silicon Mac (M1 or newer)
- Recommended: M1 Max or better (8P+2E cores)
- Minimum 16GB RAM, 32GB+ recommended

**Software:**
```bash
# Install Homebrew (if not already installed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install build dependencies
brew install make ccache jq bc

# Optional: Install Lima for boot validation
brew install lima
```

### Option 1: Automated Build and Validation (Recommended)

Run the automated script that handles everything:

```bash
./scripts/benchmarks/build-and-validate-arm64-6.17.sh
```

This script will:
1. Detect your hardware (CPU cores, memory)
2. Save CPU profile to `reports/benchmarks/`
3. Run a clean build (10-12 min on M1 Max)
4. Run an incremental build (4-5 min on M1 Max)
5. Generate a JSON build report with timings
6. Optionally test boot with Lima

### Option 2: Manual Step-by-Step

#### Step 1: Clean Build

```bash
# Set environment for optimal performance
export PATH="/usr/local/opt/make/libexec/gnubin:$PATH"
export CC="ccache clang"
export KCFLAGS="-pipe"
export MINIVIM_JOBS=$(sysctl -n hw.logicalcpu)

# Build the kernel (first time)
time ./scripts/benchmarks/build-minivim-kernel-6.17.sh arm64
```

Expected time: **10-12 minutes** on M1 Max (8P+2E cores)

#### Step 2: Incremental Build

```bash
# Skip mrproper for faster rebuild
export SKIP_MRPROPER=1

# Rebuild
time ./scripts/benchmarks/build-minivim-kernel-6.17.sh arm64
```

Expected time: **4-5 minutes** on M1 Max

#### Step 3: Verify Output

```bash
# Check the kernel was built
ls -lh bench-images/minivim/Image-arm64-6.17.14

# Expected size: ~8-10 MB (20% smaller than x86_64)
```

#### Step 4: Capture CPU Profile

```bash
# Save hardware information
mkdir -p reports/benchmarks
sysctl -a | grep -E "hw\.(logicalcpu|physicalcpu|cpufrequency|memsize|machine|perflevel)" \
  > reports/benchmarks/arm64-6.17-cpu-profile.txt

system_profiler SPHardwareDataType >> reports/benchmarks/arm64-6.17-cpu-profile.txt
```

#### Step 5: Boot Validation with Lima

```bash
# Start a test VM with the new kernel
limactl start --name=minivim-test-617 \
  --vm-type=vz \
  --arch=aarch64 \
  --kernel=bench-images/minivim/Image-arm64-6.17.14 \
  --initrd=bench-images/busybox/busybox-neovim-initrd.cpio.gz

# Test boot time
time limactl shell minivim-test-617

# Cleanup when done
limactl stop minivim-test-617
limactl delete minivim-test-617
```

Expected boot time: **2.5-2.8 seconds** (43% faster than Intel)

### Performance Targets

| Metric | Intel i7-9750H | Apple M1 Max | Target Status |
|--------|----------------|--------------|---------------|
| Clean Build | 20 min | 10-12 min | 🎯 2x faster |
| Incremental Build | 8 min | 4-5 min | 🎯 2x faster |
| Kernel Size | 12 MB | 8-10 MB | 🎯 20% smaller |
| Boot Time | 4.38s | 2.5-2.8s | 🎯 43% faster |

### Configuration Changes

The arm64 config has been enhanced with:

**New M-series optimizations:**
- Apple Interrupt Controller (APPLE_AIC)
- Apple power management (APPLE_PMGR_PWRSTATE)
- CPU frequency scaling (ARM_APPLE_SOC_CPUFREQ)
- Thermal management with power allocator
- Performance/Efficiency core detection

**Removed unnecessary drivers:**
- 25+ ARM64 SoC platforms (Qualcomm, MediaTek, Rockchip, etc.)
- Unnecessary PCIe controllers (virtio used instead)
- GPIO/PHY drivers not needed for virtualization
- Timer optimized for HZ=100

### Troubleshooting

**Build fails with "merge_config.sh not found":**
```bash
# Ensure you're in the repository root
cd /path/to/vibecode-webgui
```

**ccache not working:**
```bash
# Check ccache is installed and in PATH
which ccache
ccache -s

# Install if missing
brew install ccache
```

**Lima boot hangs:**
```bash
# Ensure using Virtualization.framework, not QEMU
limactl start --vm-type=vz  # not --vm-type=qemu

# Check lima version
limactl --version  # Should be 0.17.0 or newer
```

**Build is slower than expected:**
```bash
# Check for thermal throttling
sudo powermetrics --samplers smc -n 1

# Ensure laptop is plugged in and in Performance mode
# Check Activity Monitor for background processes
```

### Reporting Results

After successful build and validation:

1. **Commit build artifacts:**
   ```bash
   git add reports/benchmarks/arm64-6.17-*.{json,txt,log}
   git commit -m "Add arm64 6.17 build results for [Your Hardware]"
   ```

2. **Update issue #574 with results:**
   - Hardware model (e.g., "MacBook Pro M1 Max, 64GB")
   - Clean build time
   - Incremental build time
   - Kernel size
   - Boot time (if tested)
   - Any issues encountered

3. **Upload kernel image (optional):**
   - For release, upload to GitHub release artifacts
   - Include SHA256 checksum

### Quick Commands Reference

```bash
# One-liner: full automated workflow
./scripts/benchmarks/build-and-validate-arm64-6.17.sh

# One-liner: clean build only
CC="ccache clang" KCFLAGS=-pipe MINIVIM_JOBS=$(sysctl -n hw.logicalcpu) \
  ./scripts/benchmarks/build-minivim-kernel-6.17.sh arm64

# One-liner: incremental build only
SKIP_MRPROPER=1 CC="ccache clang" KCFLAGS=-pipe MINIVIM_JOBS=$(sysctl -n hw.logicalcpu) \
  ./scripts/benchmarks/build-minivim-kernel-6.17.sh arm64

# One-liner: check ccache stats
ccache -s

# One-liner: clean ccache (if issues)
ccache -C
```

### Next Steps

After completing the build:

1. ✅ Verify kernel boots with Lima (vmType=vz)
2. ✅ Test with HyperKit (if available)
3. ✅ Run performance comparison vs Intel baseline
4. ✅ Document any platform-specific quirks
5. ✅ Attach results to issue #574
6. ✅ Update documentation if needed

### References

- **Issue**: #574 - MiniVim kernel refresh – arm64 6.17.x
- **Documentation**: `docs/virtualization/minivim-kernel.md`
- **Config**: `scripts/benchmarks/kernel-configs/minivim-arm64.config`
- **Build Script**: `scripts/benchmarks/build-minivim-kernel.sh`
- **Reports**: `reports/benchmarks/README.md`

### Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review build logs in `reports/benchmarks/`
3. Comment on issue #574 with details
4. Include hardware profile and error messages
