# M-Series Testing Guide

Complete guide for testing and validating on Apple Silicon (M1/M2/M3/M4).

## Hardware Detection

```bash
# Verify Apple Silicon
sysctl hw.optional.arm64  # Should return 1
sysctl machdep.cpu.brand_string  # Shows M1/M2/M3/M4

# Check cores
sysctl hw.ncpu  # Total cores
sysctl hw.perflevel0.physicalcpu  # Performance cores
sysctl hw.perflevel1.physicalcpu  # Efficiency cores
```

## Testing Suite

### 1. Performance Benchmarks (#545)

**Script**: `scripts/benchmarks/m-series-performance-test.sh`

```bash
# Run full suite
./scripts/benchmarks/m-series-performance-test.sh

# Results in: artifacts/m-series-benchmarks/
```

**Tests**:
- Apple Virtualization.framework boot time (target: <5s)
- arm64 kernel build performance
- Container runtime comparison
- Memory bandwidth
- eBPF/BTF support detection

### 2. Native VM Testing (#547)

**Code**: `macos-vm/Sources/main.swift`

```bash
# Build VM
cd macos-vm
swift build

# Run (requires kernel files)
.build/debug/macos-vm
```

**Requirements**:
- Linux kernel for arm64
- initramfs
- 20GB disk space

**Expected**:
- Boot in <5s on M-Series
- 4GB RAM, 4 CPU cores
- VirtIO devices functional

### 3. Custom Kernel Builds (#543)

**Script**: `scripts/benchmarks/build-minivim-kernel.sh`

```bash
# Build arm64 kernel on M-Series
MINIVIM_JOBS=$(sysctl -n hw.ncpu) \
  ./scripts/benchmarks/build-minivim-kernel.sh arm64 6.17.14

# Expected build time: <10 minutes on M2 Ultra
```

**Optimizations**:
- Use all cores: `MINIVIM_JOBS=$(sysctl -n hw.ncpu)`
- Enable ccache: `CC="ccache clang"`
- Skip clean builds: `SKIP_MRPROPER=1`

### 4. Container Runtime (#544)

**Test Docker vs alternatives**:

```bash
# Docker Desktop (x86_64 emulation)
time docker run --rm alpine:latest echo "test"

# Colima (native arm64)
colima start --arch arm64
time docker run --rm alpine:latest echo "test"

# Compare results
./scripts/benchmarks/compare-vscode-builds.sh
```

**Expected on M-Series**:
- Native arm64: <2s startup
- x86_64 emulation: 3-5s startup

### 5. Cloud Hypervisor (#542)

**Install**:
```bash
# Install via Homebrew
brew install cloud-hypervisor

# Or build from source
git clone https://github.com/cloud-hypervisor/cloud-hypervisor
cd cloud-hypervisor
cargo build --release --features kvm
```

**Test**:
```bash
# Create VM
cloud-hypervisor \
  --kernel bzImage-arm64 \
  --disk path=rootfs.img \
  --cpus boot=4 \
  --memory size=4G \
  --console off \
  --serial tty
```

### 6. eBPF Observability (#546)

**Install BPF tools**:
```bash
# Install via Homebrew
brew install bpftool bpftrace

# Verify
bpftool version
bpftrace --version
```

**Test BTF Support**:
```bash
# Check if kernel has BTF
ls -la /sys/kernel/btf/vmlinux

# Run simple trace
sudo bpftrace -e 'tracepoint:syscalls:sys_enter_openat { printf("%s\n", comm); }'
```

**Note**: macOS doesn't have native eBPF support. Test in Linux VM on M-Series hardware.

## Performance Targets

### Boot Times
- **Native macOS VM**: <5s (Virtualization.framework)
- **Linux microVM**: <10s (Firecracker/Cloud Hypervisor)
- **Container**: <2s (arm64 native)

### Build Times (M2 Ultra, 24 cores)
- **Kernel build**: <10 minutes
- **OpenVSCode build**: <5 minutes
- **Docker image**: <3 minutes

### Memory Usage
- **Idle VM**: <512MB
- **OpenVSCode**: <650MB
- **Full dev environment**: <2GB

## Validation Checklist

### Hardware
- [ ] M-Series chip detected (M1/M2/M3/M4)
- [ ] Performance cores: 4-8
- [ ] Efficiency cores: 4-8
- [ ] Total RAM: ≥8GB

### Software
- [ ] Xcode Command Line Tools installed
- [ ] Homebrew available
- [ ] Swift toolchain (for VM testing)
- [ ] Docker Desktop or Colima

### Tests
- [ ] Performance suite passes
- [ ] VM builds successfully
- [ ] Kernel compiles for arm64
- [ ] Container startup <2s
- [ ] All scripts executable

### Benchmarks
- [ ] Boot time within targets
- [ ] Memory usage acceptable
- [ ] Build times reasonable
- [ ] No x86_64 emulation warnings

## Troubleshooting

### VM Won't Start
```bash
# Check entitlements
codesign -d --entitlements :- macos-vm/.build/debug/macos-vm

# Should show: com.apple.security.virtualization
```

### Kernel Build Fails
```bash
# Clean build
SKIP_MRPROPER=0 ./scripts/benchmarks/build-minivim-kernel.sh arm64 6.17.14

# Check toolchain
which clang  # Should be Apple clang
clang --version  # Should support arm64
```

### Poor Performance
```bash
# Check Rosetta isn't running
pgrep -lf rosetta  # Should be empty

# Verify native arch
file /usr/local/bin/docker  # Should show arm64
```

### Permission Errors
```bash
# VM creation needs full disk access
# System Settings → Privacy & Security → Full Disk Access
# Add Terminal/IDE
```

## Continuous Integration

### GitHub Actions
```yaml
# .github/workflows/m-series-test.yml
name: M-Series Tests
on: [push]
jobs:
  test:
    runs-on: macos-14  # M1 runners
    steps:
      - uses: actions/checkout@v4
      - name: Run M-Series tests
        run: ./scripts/benchmarks/m-series-performance-test.sh
```

### Local CI
```bash
# Run all tests
make test-m-series

# Or individual tests
./scripts/benchmarks/m-series-performance-test.sh
./scripts/benchmarks/build-minivim-kernel.sh arm64
```

## References

- Apple Virtualization: https://developer.apple.com/documentation/virtualization
- M-Series Performance: https://eclecticlight.co/m1-series/
- arm64 Kernel: https://www.kernel.org/doc/html/latest/arm64/
- Performance Script: `scripts/benchmarks/m-series-performance-test.sh`

## Related Issues

- #542: Cloud Hypervisor integration
- #543: Custom M-Series kernel
- #544: Container runtime migration
- #545: Performance benchmarking (✅ Script created)
- #546: eBPF observability
- #547: macOS native VM (✅ Code exists)
