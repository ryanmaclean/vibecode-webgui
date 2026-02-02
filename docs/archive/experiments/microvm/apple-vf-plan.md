# Apple Virtualization Framework Fast-Boot Plan

## Objective
Deliver a micro-VM that boots to an OpenVSCode (or code-server) web UI in under 10 seconds on Apple Silicon by combining:
- Minimal BusyBox initramfs with pre-baked editor payload
- EFI-stubbed arm64 kernel trimmed for Apple Virtualization Framework
- Updated benchmark harness (`scripts/benchmarks/vscode_microvm.sh`) supporting `MICROVM_ARCH=arm64` and VF execution

## Steps
1. Kernel + initramfs
   - Use `scripts/benchmarks/build-minivim-kernel-6.17.sh` as baseline, clone config for Apple VF (virtio-net, virtio-blk, EFI stub, LZ4 compression).
   - Ensure the kernel defconfig enables `CONFIG_BLK_DEV_INITRD=y` so the initramfs boots without requiring an external root disk.
   - Generate BusyBox initramfs (based on existing `fast-openvscode-vm` rootfs) with minimal services: udhcpc, dropbear optional, code-server bundle, health proxy.
   - Embed initramfs via kernel `CONFIG_INITRAMFS_SOURCE` or package alongside.
   - Practical note: run the build inside the `kernel-builder` Lima VM (`limactl start kernel-builder`), then `limactl copy kernel-builder:/workspace/...` to pull the resulting kernel image (`Image-arm64-6.12.10`) and BusyBox rootfs tarball.

2. Host harness
   - Extend `scripts/benchmarks/vscode_microvm.sh` to detect `MICROVM_RUNTIME=applevf` (default to vfkit/qemu when unavailable).
   - Use `vz` CLI or Swift helper to boot the EFI-stub kernel with virtio devices; mount shared directory for logs if needed.
   - Add `measure` support that records time from `vz` start to `/healthz` 200 to JSON.

3. Benchmark + document
   - Run on Apple Silicon host (M-series) and capture cold-boot times vs existing x86 HVF numbers.
   - Update `docs/virtualization/openvscode-microvm.md` with instructions + table of readiness metrics.

4. Packaging
   - Reuse `scripts/release/package-fast-openvscode-vm.sh` with new arm64 artifacts.
   - Attach results to TODO in docs/planning/TODO.md and prep GitHub release.

## Open Questions
- Should we switch payload to VS Code for Web (insiders) or keep openvscode-server?
- Evaluate bun-based init fallback once BusyBox pipeline is stable.
