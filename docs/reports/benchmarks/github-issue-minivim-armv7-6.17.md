# MiniVim kernel refresh – armv7 6.17.x

**Owner:** Atlas → Velocity hand-off

## Summary
- Extend the MiniVim refresh to 32-bit armv7 (Raspberry Pi class) so benchmark payloads cover the full matrix.
- Use cross-compilation with `arm-linux-gnueabihf-` or a Pi builder, recording clean vs. incremental times for comparison against the Intel/arm64 baselines.

## Tasks
- [ ] Update `scripts/benchmarks/kernel-configs/minivim-armv7.config` for 6.17.x; remove unnecessary drivers (DRM, SATA, etc.) while keeping virtio + serial.
- [ ] Build using: `PATH="/usr/local/opt/make/libexec/gnubin:$PATH" CC="ccache clang" KCFLAGS=-pipe MINIVIM_JOBS=$(nproc) ./scripts/benchmarks/build-minivim-kernel.sh armv7 6.17`.
- [ ] Capture clean vs. incremental wall-clock times; store logs under `artifacts/minivim/`.
- [ ] Validate boot in QEMU (`vim_qemu_bench.py`) and note console output for HyperKit if applicable.
- [ ] Attach artifacts (zImage, initramfs, benchmark JSON) to the release bundle and update docs.

## Acceptance Criteria
- armv7 zImage + BusyBox initramfs produced and benchmarked.
- Timing table in `docs/virtualization/minivim-kernel.md` updated with armv7 columns.
- Issue comments include builder specs and timings so we can compare across architectures.

## References
- `docs/virtualization/minivim-kernel.md`
- Issues #573, #574 (x86_64/arm64 counterparts)
- `reports/benchmarks/vim_qemu_results_2025-10-02.json`
