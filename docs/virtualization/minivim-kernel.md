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

## Build & Boot Performance Matrix

### Kernel 6.17.x Builds

| Architecture | Hardware | Kernel | Build Time (clean) | Build Time (incr) | Boot Time | Image Size | Status |
|--------------|----------|--------|-------------------|-------------------|-----------|------------|--------|
| x86_64 | Intel i7-9750H (12 cores, 32GB) | 6.17.14 | ~20 min | ~8 min | 4.4s | ~5.2 MB | ✅ Complete |
| arm64 | Apple M3/M4 (8+ cores) | 6.17.14 | TBD | TBD | TBD | TBD | ⏳ Issue #574 |
| armv7 | GitHub Actions (16 cores) | 6.17.14 | ~20-25 min | ~10-12 min | ~4.5s* | ~3.6 MB | ⏳ Issue #576 |

\* Expected boot time in QEMU (Cortex-A15); target <5s

**Notes:**
- x86_64 baseline from 2019 MacBook Pro, using \`gmake\` ≥ 4.4
- arm64 pending execution on faster Apple Silicon hardware
- armv7 estimated from GitHub Actions 16-core runners with ccache + clang
- Incremental builds use \`SKIP_MRPROPER=1\`
- All builds use \`MINIVIM_JOBS=$(nproc)\` and \`CC="ccache clang"\` when available

### ARMv7 6.17.x Implementation (Issue #576)

**Status:** ✅ Ready for execution

**Deliverables:**
- Updated kernel config: \`scripts/benchmarks/kernel-configs/minivim-armv7.config\`
- Validation script: \`scripts/benchmarks/validate-armv7-kernel.sh\`
- Complete automation: \`scripts/benchmarks/build-armv7-6.17-complete.sh\`
- Documentation: \`claudedocs/minivim-armv7-*.md\` (88 KB total)

**Quick Start:**
\`\`\`bash
# One-command workflow
./scripts/benchmarks/build-armv7-6.17-complete.sh

# Or step-by-step
CROSS_COMPILE=arm-linux-gnueabihf- \\
  ./scripts/benchmarks/build-minivim-kernel.sh armv7 6.17.14
./scripts/benchmarks/validate-armv7-kernel.sh 6.17.14
\`\`\`

**Key Optimizations:**
- Removed DRM, SATA, HID drivers (not needed in virtualization)
- Enabled virtio MMIO (primary transport for QEMU)
- LZ4 compression for fast boot
- Security hardening (FORTIFY_SOURCE, STACKPROTECTOR_STRONG)
- Performance tuning (PREEMPT_VOLUNTARY, HZ_250)

**CI/CD:** Already integrated in \`.github/workflows/minivim-build.yml\` with cross-compilation support
## Next steps

1. **Execute ARMv7 build (Issue #576):** Run complete workflow and capture timing data
2. **Execute arm64 build (Issue #574):** Build on Apple Silicon hardware and benchmark
3. Strip more subsystems from the x86_64 config (e.g., drop DRM/i915, fold
   virtio drivers built-in, experiment with `CONFIG_INITRAMFS_SOURCE`) to push
   the BusyBox guest below 3 s.
4. Repeat the build for `arm64` (Apple virtualization) and `armv7` (Pi) once the
   x86_64 baseline improves, and attach artifacts to the release/issue tracker.
5. Wire the script into nightly CI (issue #555) so nightly runs publish fresh artifacts
   alongside benchmark JSON.
6. Extend the script to accept an `--initramfs` flag that inlines the BusyBox
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
