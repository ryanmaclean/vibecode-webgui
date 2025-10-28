# MiniVim ARMv7 Quick Reference

**Target:** Linux 6.17.14 ARMv7 kernel  
**Time:** 2-3 hours  

## One-Liner Commands

### Complete Workflow (Automated)
```bash
./scripts/benchmarks/build-armv7-6.17-complete.sh
```

### Build Only
```bash
CROSS_COMPILE=arm-linux-gnueabihf- \
  MINIVIM_JOBS=$(nproc) \
  ./scripts/benchmarks/build-minivim-kernel.sh armv7 6.17.14
```

### Validate Only
```bash
./scripts/benchmarks/validate-armv7-kernel.sh 6.17.14
```

### QEMU Boot Test
```bash
qemu-system-arm -machine virt -cpu cortex-a15 -m 512M \
  -kernel bench-images/minivim/zImage-armv7-6.17.14 \
  -initrd bench-images/busybox/busybox-vi-initrd.cpio.gz \
  -nographic -serial mon:stdio -append "console=ttyAMA0"
```

## Environment Setup

### Required Dependencies
```bash
sudo apt-get install -y build-essential gcc-arm-linux-gnueabihf \
  clang lld llvm curl bc flex bison libncurses-dev libssl-dev \
  libelf-dev dwarves ccache qemu-system-arm
```

### Environment Variables
```bash
export ARCH=arm
export CROSS_COMPILE=arm-linux-gnueabihf-
export MINIVIM_JOBS=$(nproc)
export CC="ccache clang"
export KCFLAGS="-pipe"
```

## Performance Targets

| Metric | Target | Expected |
|--------|--------|----------|
| Build Time (GitHub Actions) | <30 min | 20-25 min |
| Build Time (8 cores) | <45 min | 30-40 min |
| Boot Time (QEMU) | <5 s | 4-4.5 s |
| Kernel Size | 3-4 MB | 3.6 MB |

## File Locations

| File | Purpose |
|------|---------|
| `scripts/benchmarks/kernel-configs/minivim-armv7.config` | Kernel config |
| `scripts/benchmarks/build-minivim-kernel.sh` | Build script |
| `scripts/benchmarks/validate-armv7-kernel.sh` | Validation |
| `scripts/benchmarks/build-armv7-6.17-complete.sh` | Complete workflow |
| `bench-images/minivim/zImage-armv7-6.17.14` | Kernel image |
| `artifacts/minivim/` | Build artifacts |

## Common Options

### Complete Build Script
```bash
# Skip build (validation only)
./scripts/benchmarks/build-armv7-6.17-complete.sh --skip-build

# Skip validation
./scripts/benchmarks/build-armv7-6.17-complete.sh --skip-validate

# Custom kernel version
./scripts/benchmarks/build-armv7-6.17-complete.sh --kernel-version 6.17.15
```

### Build Script
```bash
# Incremental build (skip mrproper)
SKIP_MRPROPER=1 ./scripts/benchmarks/build-minivim-kernel.sh armv7 6.17.14

# Use GCC instead of clang
unset CC
./scripts/benchmarks/build-minivim-kernel.sh armv7 6.17.14
```

## Validation Checklist

- [ ] Kernel image exists: `bench-images/minivim/zImage-armv7-6.17.14`
- [ ] Image size 3-4 MB
- [ ] File type shows ARM kernel
- [ ] QEMU boots successfully
- [ ] Console output shows "Linux version 6.17.14"
- [ ] Validation JSON generated
- [ ] Build manifest created
- [ ] CPU info captured

## Troubleshooting

### Build Issues

**Missing cross-compiler:**
```bash
sudo apt-get install gcc-arm-linux-gnueabihf
export CROSS_COMPILE=arm-linux-gnueabihf-
```

**Clang errors:**
```bash
unset CC
# Rebuild with GCC
```

### Runtime Issues

**QEMU hangs:**
```bash
# Verify serial console in config
grep SERIAL_AMBA_PL011 .config

# Use correct QEMU flags
-nographic -serial mon:stdio -append "console=ttyAMA0"
```

**Kernel panic:**
```bash
# Verify initramfs
ls -lh bench-images/busybox/busybox-vi-initrd.cpio.gz

# Pass to QEMU
-initrd bench-images/busybox/busybox-vi-initrd.cpio.gz
```

## Output Artifacts

```
artifacts/minivim/
├── zImage-armv7-6.17.14                    # Kernel image
├── cpuinfo-armv7.txt                       # CPU info
├── armv7-validation-6.17.14.json           # Validation report
├── build-manifest-armv7-6.17.14.txt        # Build metadata
└── qemu-boot-test-armv7.log                # QEMU test log
```

## CI/CD

### Trigger GitHub Actions
```bash
git checkout minivim-refresh
git push origin minivim-refresh

# Or manually: GitHub UI → Actions → MiniVim Kernel Builds → Run workflow
```

### Download Artifacts
```bash
gh run download <run-id> -n minivim-armv7
```

## Documentation

- **Architecture:** `claudedocs/minivim-armv7-6.17-architecture.md`
- **Implementation:** `claudedocs/minivim-armv7-implementation-guide.md`
- **Summary:** `claudedocs/issue-576-implementation-summary.md`
- **This Guide:** `claudedocs/minivim-armv7-quick-reference.md`

## Related Issues

- #573: x86_64 6.17.x
- #574: arm64 6.17.x
- #576: armv7 6.17.x (this)
- #555: Automate VM release pipeline
- #557: Define nightly verification checklist

---

**Version:** 1.0 | **Updated:** October 2025
