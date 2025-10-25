# MiniVim kernel refresh – arm64 6.17.x

**Owner:** Velocity → Nexus hand-off

## Summary
- Mirror the MiniVim upgrade on Apple Silicon (arm64) so HyperKit, Virtualization.framework, and Lima guests share the same BusyBox payload.
- Use an Apple M3/M4 workstation (or faster) as the target builder and record both clean and incremental wall times to compare against the Intel baseline (~20 minutes on MBP i7-9750H).

## Tasks
- [ ] Refresh `scripts/benchmarks/kernel-configs/minivim-arm64.config` for 6.17.x, pruning new SoC/PCIe drivers that aren’t required for HyperKit/Lima.
- [ ] Execute the build with performance flags:
  ```bash
  PATH="/usr/local/opt/make/libexec/gnubin:$PATH" \
  CC="ccache clang" KCFLAGS=-pipe \
  MINIVIM_JOBS=$(sysctl -n hw.logicalcpu) \
  ./scripts/benchmarks/build-minivim-kernel.sh arm64 6.17
  ```
  - First pass: clean tree
  - Second pass: `SKIP_MRPROPER=1` to capture incremental timing
- [ ] Validate boot under both HyperKit (`scripts/benchmarks/vim_hypervisor_bench.py` once HyperKit perms land) and Lima `vmType=vz`.
- [ ] Attach benchmark JSON and CPU info to `reports/benchmarks/` and mention the hardware profile used.
- [ ] Update `docs/virtualization/minivim-kernel.md` with arm64-specific notes, timings, and any differing config trims.

## Acceptance Criteria
- arm64 `Image` + BusyBox initramfs uploaded alongside x86_64 assets for the release.
- Issue comments include the clean/incremental timing comparison vs. the Intel reference system.
- Documentation calls out ARM-specific config removes and any HyperKit/Lima quirks.

## References
- `docs/virtualization/minivim-kernel.md`
- `reports/virtualization-20251002.md`
- `wiki/FAST_OPENVSCODIUM_RELEASE_FLOW.md`
