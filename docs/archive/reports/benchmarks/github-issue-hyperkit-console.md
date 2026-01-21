# HyperKit BusyBox vi console output missing

## Summary
- HyperKit boots the MiniVim BusyBox guest (kernel 6.12.10) but the serial console stays silent, so uptime samples never populate.
- Every run exits cleanly in ~0.01 s; the PTY logs in `/tmp/hyperkit-vi/` are empty, and `reports/benchmarks/hyperkit_busybox_vi_2025-10-02.json` shows `uptime_start` / `uptime_end` as `null`.
- Need to restore console visibility before collecting vi timings for Flux/Nexus and closing the MiniVim benchmarking loop.

## Evidence
- Command: `sudo /usr/local/opt/hyperkit/bin/hyperkit -w -A -H -U <uuid> -m 256M -s 0:0,hostbridge -s 31,lpc -l com1,autopty -f kexec,bench-images/minivim/bzImage-x86_64-6.12.10,bench-images/minivim/busybox-vi-initrd.cpio.gz,"console=ttyS0 panic=-1"`
- Result: HyperKit prints `COM1 connected to /dev/ttys00x` then exits with code `0`; no `[init]` lines captured.
- JSON artefact: `reports/benchmarks/hyperkit_busybox_vi_2025-10-02.json` (five runs, `uptime_delta` null).

## Tasks
- [ ] Re-run with `-l com1,stdio` and observe boot live; ensure BusyBox init script prints before `poweroff -f`.
- [ ] Keep the autopty handle open (e.g., `cat` on the slave) during boot to confirm HyperKit isn’t closing before the guest writes.
- [ ] Add temporary `set -x` / extra logging in `artifacts/minivim/work/root/init` to prove the init script executes.
- [ ] Once console output is restored, rerun the 5× harness so `reports/benchmarks/hyperkit_busybox_vi_2025-10-02.json` contains real uptime deltas.

## Links
- Docs: `docs/virtualization/minivim-kernel.md`
- Prior results: `reports/benchmarks/vim_qemu_results_2025-10-02.json`, `reports/benchmarks/vim_hypervisor_results_2025-10-02.json`
