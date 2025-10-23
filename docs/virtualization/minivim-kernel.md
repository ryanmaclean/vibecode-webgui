# MiniVim Kernel Build Notes (2025-10-02)

This guide captures the current state of the slim "MiniVim" kernel/guest payload
used for Lima vi launch benchmarks.

## Goals

- Keep boot-to-vi under **3 seconds** on Intel Macs by coupling a minimal kernel
  with the BusyBox initramfs from `bench-images/busybox/`.
- Allow architecture-specific tuning: Intel x86_64 (AVX/AVX512 aware), Apple
  Silicon (`arm64`), and Raspberry Pi class devices (`armv7`).
- Generate reproducible Kconfig fragments so CI or GitHub Actions can rebuild
  artifacts on demand.

## What changed

- Added common + per-architecture config fragments under
  `scripts/benchmarks/kernel-configs/`:
  - `minivim-base.config` – shared minimal features (virtio, serial console,
    `CONFIG_MODULES=n`, no USB/sound, etc.).
  - `minivim-x86_64.config` – enables Intel microcode, AVX/XSAVE helpers,
    SGX/x2APIC, and EFI for Virtualization.framework/HVF paths.
  - `minivim-arm64.config` – toggles PAN/BTI/SVE for M-series hosts and keeps the
    Apple SoC errata knobs on.
  - `minivim-armv7.config` – targets Pi-style BCM283x systems with NEON and PSCI
    enabled.
- New helper script `scripts/benchmarks/build-minivim-kernel.sh` downloads the
  requested kernel version, merges fragments, and builds the image matching the
  chosen arch. The script logs `lscpu`/`sysctl` output (when available) so we can
  see which CPU features were detected.
- BusyBox initramfs from `bench-images/busybox/` remains the boot payload; no
  changes were required there yet.

## Current status

- The script now runs end-to-end on the Intel host we use for flux/nexus work: a
  2019 MacBook Pro (Intel(R) Core(TM) i7-9750H @ 2.60 GHz, 12 logical cores,
  32 GB RAM). A completely clean `x86_64` build of `6.12.10` (download, merge
  configs, full `bzImage`) takes **≈20 minutes wall time** with
  `PATH="/usr/local/opt/make/libexec/gnubin:$PATH"` so that `gmake` ≥ 4.4 is
  used. Incremental rebuilds drop below 8 minutes when we skip `make mrproper`.
- Artifacts land under `bench-images/minivim/bzImage-x86_64-6.12.10` and are
  mirrored to `artifacts/minivim/` for convenient uploads.
- Re-running `python3 scripts/benchmarks/vim_qemu_bench.py --runs 3` with the
  trimmed kernel keeps BusyBox boot-to-vi at **4.38 s** (TinyCore 16.2 15.1 s,
  Yocto 12.9 s, OpenWrt 18.8 s); further trimming is still required to hit the
  ≤ 3 s goal.
- Lima/native comparisons remain ~2.0 s vs. 2.05 s (`python3
  scripts/benchmarks/vim_hypervisor_bench.py --runs 3`).

## Next steps

1. Strip more subsystems from the x86_64 config (e.g., drop DRM/i915, fold
   virtio drivers built-in, experiment with `CONFIG_INITRAMFS_SOURCE`) to push
   the BusyBox guest below 3 s.
2. Repeat the build for `arm64` (Apple virtualization) and `armv7` (Pi) once the
   x86_64 baseline improves, and attach artifacts to the release/issue tracker.
3. Wire the script into CI (issue #560) so nightly runs publish fresh artifacts
   alongside benchmark JSON.
4. Extend the script to accept an `--initramfs` flag that inlines the BusyBox
   payload (`CONFIG_INITRAMFS_SOURCE`) for truly single-file guests.

## GitHub follow-ups for 6.17.x

Create or update tracking issues so the 6.17 cycle is covered on both major
architectures. Suggested structure (feel free to paste directly into GitHub):

- **Issue (#573):** “MiniVim kernel refresh – x86_64 6.17.x” (Flux/Nexus)
  - baseline hardware + timing: 2019 MBP i7-9750H, 12 threads, 32 GB, clean
    build ≈20 minutes.
  - tasks: bump `build-minivim-kernel.sh` default to 6.17.x once the fragments
    compile, trim new Kconfig options introduced post-6.12, document any
    removals in this file.
  - build flags: export `PATH="/usr/local/opt/make/libexec/gnubin:$PATH"`, run
    `CC="ccache clang" KCFLAGS=-pipe make ARCH=x86_64 LLVM=1 -j12 bzImage`.
- **Issue (#574):** “MiniVim kernel refresh – arm64 6.17.x” (Velocity)
  - run on faster arm64 hardware (Apple M3/M4 preferred) and log wall-clock for
    both clean and incremental builds to compare against the Intel baseline.
  - tasks: refresh `minivim-arm64.config`, trim new drivers, confirm the BusyBox
    initramfs boots under Virtualization.framework and HyperKit, attach logs.
  - build flags: `PATH="/usr/local/opt/make/libexec/gnubin:$PATH" CC="ccache
    clang" make ARCH=arm64 LLVM=1 -j$(sysctl -n hw.logicalcpu) Image`.

Both issues are live and link back here and to
`reports/virtualization-20251002.md`, and call out that faster hardware is
available so the job can be scheduled off the dev laptops.

## Useful commands (from repo root)

```bash
# Build Intel-optimised kernel (run on a glibc-based host for now)
SKIP_MRPROPER=1 MINIVIM_JOBS=$(sysctl -n hw.logicalcpu) \
  PATH="/usr/local/opt/make/libexec/gnubin:$PATH" \
  ./scripts/benchmarks/build-minivim-kernel.sh x86_64 6.12.10

# Build the BusyBox initramfs used by the guest
python3 scripts/benchmarks/vim_qemu_bench.py --runs 1 --output bench-images/vim_qemu_results.json

# Re-run Lima/native comparison
python3 scripts/benchmarks/vim_hypervisor_bench.py --runs 3 --output bench-images/vim_hypervisor_results.json
```

### Tweaks that help on slower hardware

- Set `SKIP_MRPROPER=1` for incremental rebuilds once the tree is configured.
- Override `MINIVIM_JOBS` if you want to limit cores when testing thermal
  throttling side effects.
- Export `CC="ccache clang" KCFLAGS=-pipe` to trim wall time on machines with
  slower storage.

### CI workflow

- Workflow `MiniVim Kernel Builds` (`.github/workflows/minivim-build.yml`) runs on
  the `minivim-refresh` branch or via manual dispatch. It cross-compiles
  `x86_64`, `arm64`, and `armv7` kernels on GitHub-hosted Ubuntu runners,
  packages the resulting images, CPU info, and BusyBox initrd, and uploads
  per-arch artifacts (`minivim-<arch>`). The job installs required cross
  toolchains (`gcc-aarch64-linux-gnu`, `gcc-arm-linux-gnueabihf`) so no
  self-hosted runners are needed.

## arm64 6.17.x Build Notes

Updated for Linux 6.17.x on Apple Silicon (M1/M2/M3/M4) systems.

### Configuration Updates for 6.17.x

The `minivim-arm64.config` has been enhanced with Apple Silicon-specific optimizations:

**Apple-specific drivers:**
- `CONFIG_APPLE_AIC=y` - Apple Interrupt Controller for M-series processors
- `CONFIG_APPLE_PMGR_PWRSTATE=y` - Power management state driver
- `CONFIG_ARM_APPLE_SOC_CPUFREQ=y` - CPU frequency scaling for Apple SoC

**Performance features:**
- CPU frequency governors (performance, powersave, ondemand) for dynamic scaling
- Thermal management with power allocator governor
- Performance/Efficiency core detection via `CONFIG_ARM64_PSEUDO_NMI=y`

**Pruned subsystems:**
- Disabled 25+ ARM64 SoC platforms (Qualcomm, Rockchip, MediaTek, etc.)
- Disabled unnecessary PCIe controllers (HyperKit/Lima use virtio)
- Disabled GPIO/PHY drivers not needed for virtualization
- Optimized for HZ=100 to reduce timer interrupts

### Build Command for arm64 6.17.x

```bash
# Clean build (first time or after config changes)
PATH="/usr/local/opt/make/libexec/gnubin:$PATH" \
CC="ccache clang" KCFLAGS=-pipe \
MINIVIM_JOBS=$(sysctl -n hw.logicalcpu) \
./scripts/benchmarks/build-minivim-kernel.sh arm64 6.17.14

# Incremental build (faster)
SKIP_MRPROPER=1 \
PATH="/usr/local/opt/make/libexec/gnubin:$PATH" \
CC="ccache clang" KCFLAGS=-pipe \
MINIVIM_JOBS=$(sysctl -n hw.logicalcpu) \
./scripts/benchmarks/build-minivim-kernel.sh arm64 6.17.14

# Or use the convenience wrapper (defaults to 6.17.14)
./scripts/benchmarks/build-minivim-kernel-6.17.sh arm64
```

### Expected Performance (Projected)

Based on M-series processor improvements over Intel:

| Metric | Intel i7-9750H | Apple M1 Max (8P+2E) | Improvement |
|--------|----------------|----------------------|-------------|
| Clean Build | ~20 minutes | ~10-12 minutes | ~2x faster |
| Incremental Build | ~8 minutes | ~4-5 minutes | ~2x faster |
| Kernel Size | ~12 MB | ~8-10 MB | 20% smaller |
| Boot Time (est.) | 4.38s | 2.5-2.8s | 43% faster |

**Note:** Actual timings depend on hardware (M1/M2/M3/M4), ccache state, and thermal conditions.

### Validation Steps

**1. Build verification:**
```bash
# Check output exists
ls -lh bench-images/minivim/Image-arm64-6.17.14

# Verify CPU info captured
cat bench-images/minivim/cpuinfo-arm64.txt
```

**2. Boot test with Lima (vmType=vz):**
```bash
limactl start --name=minivim-test-617 \
  --vm-type=vz \
  --arch=aarch64 \
  --kernel=bench-images/minivim/Image-arm64-6.17.14 \
  --initrd=bench-images/busybox/busybox-neovim-initrd.cpio.gz
```

**3. HyperKit validation (once permissions available):**
```bash
python3 scripts/benchmarks/vim_hypervisor_bench.py \
  --kernel bench-images/minivim/Image-arm64-6.17.14 \
  --runs 3 \
  --output reports/benchmarks/arm64-6.17-hyperkit.json
```

### Known Differences from x86_64

- **Image format:** `Image` (uncompressed) vs `bzImage` (compressed)
- **Boot loader:** Direct kernel load in Virtualization.framework (no GRUB needed)
- **Serial console:** Uses `CONFIG_SERIAL_AMBA_PL011` instead of `CONFIG_SERIAL_8250`
- **Interrupt controller:** Apple AIC instead of x2APIC
- **No ACPI:** ARM64 uses Device Tree instead

### Troubleshooting

**Build fails with "merge_config.sh not found":**
Ensure you're in the repository root and the kernel source tree structure is intact.

**"CONFIG_APPLE_AIC" not recognized:**
Update to kernel 6.17+ which includes Apple Silicon mainline support.

**Lima boot hangs:**
- Verify `--vm-type=vz` is set (not `qemu`)
- Check kernel console output for serial driver issues
- Ensure initrd is compatible with arm64 busybox

**Performance lower than expected:**
- Verify ccache is installed and working: `ccache -s`
- Check thermal throttling: `sudo powermetrics --samplers smc -n 1`
- Use Performance mode on laptops when building

### References

- Issue #574: MiniVim kernel refresh – arm64 6.17.x
- `reports/benchmarks/` - Build timing logs and CPU profiles
- `reports/virtualization-20251002.md` - Baseline benchmarks
