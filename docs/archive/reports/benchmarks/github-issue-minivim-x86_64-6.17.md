# MiniVim kernel refresh – x86_64 6.17.x

**Owner:** Flux → Nexus hand-off

## Summary
- Track the Linux 6.17.x upgrade for the MiniVim x86_64 kernel used in vi launch benchmarks.
- Keep the 2019 MacBook Pro i7-9750H (12 threads, 32 GB RAM) as the reference hardware until faster builders are scheduled.
- Record the existing clean build timing (~20 minutes) and tune the config/flags to shrink it before pushing artifacts to releases.

## Tasks
- [ ] Bump the default in `scripts/benchmarks/build-minivim-kernel.sh` to `6.17.x` once new fragments compile.
- [ ] Regenerate `scripts/benchmarks/kernel-configs/minivim-base.config` and `minivim-x86_64.config`; trim any new drivers brought in by 6.17.
- [ ] Run a **clean** build on the Intel baseline using:
  ```bash
  PATH="/usr/local/opt/make/libexec/gnubin:$PATH" \
  CC="ccache clang" KCFLAGS=-pipe \
  MINIVIM_JOBS=$(sysctl -n hw.logicalcpu) \
  ./scripts/benchmarks/build-minivim-kernel.sh x86_64 6.17
  ```
  Log wall-clock time for clean vs. incremental (`SKIP_MRPROPER=1`).
- [ ] Capture benchmark deltas via `python3 scripts/benchmarks/vim_qemu_bench.py --runs 3` and stash JSON under `reports/benchmarks/`.
- [ ] Update `docs/virtualization/minivim-kernel.md` with new timings, trimmed options, and link to the release artifact.

## Acceptance Criteria
- Fresh 6.17.x `bzImage` + BusyBox initramfs published to the release bundle.
- GitHub issue leaves explicit clean/incremental timings for the Intel host **and** identifies which faster AMD64 builder (if available) will be used next.
- Docs reflect the new config, performance notes, and the `SKIP_MRPROPER/MINIVIM_JOBS/ccache` guidance.

## References
- `docs/virtualization/minivim-kernel.md`
- `reports/virtualization-20251002.md`
- `reports/benchmarks/vim_qemu_results_2025-10-02.json`
