# OpenVSCode Micro-VM Prototype (2025-10-02)

This document captures the current state of the BusyBox + glibc initramfs that
hosts OpenVSCode Server inside a tiny KVM guest. The goal is to prove that we
can boot a VSIX-compatible editor in under a second and treat it like a
near-native tool when fronting Hypervisor.framework / Apple Containerization.

## What was built
- BusyBox-based initramfs (`fast-openvscode-vm/openvscode-initramfs.cpio.gz`,
  ~69 MB gzipped) with manually copied glibc/libstdc++ and the
  `openvscode-server-v1.103.1` payload.
- Custom `/init` script mounts proc/sys/dev/tmp, acquires DHCP with `udhcpc`,
  launches OpenVSCode Server using `--without-connection-token`, and emits
  log-style status messages (`[HH:MM:SS] ...`).
- Host-side harness (temporary shell one-liner) measures elapsed time between
  launching QEMU and the port listening; current best run reports
  `{'port_ready_ms': 492}` (≈0.5 s).

## How to reproduce (Linux host)
```bash
# 1. Install qemu-system-x86 (we use KVM acceleration).
sudo apt-get install qemu-system-x86

# 2. Copy host kernel for convenience.
sudo cp /boot/vmlinuz-$(uname -r) fast-openvscode-vm/vmlinuz-host
sudo chown $USER fast-openvscode-vm/vmlinuz-host

# 3. Launch the micro VM.
cd fast-openvscode-vm
qemu-system-x86_64 \
  -machine accel=kvm,type=pc \
  -cpu host -smp 4 -m 2048 \
  -kernel vmlinuz-host \
  -initrd openvscode-initramfs.cpio.gz \
  -append "rdinit=/init console=ttyS0 quiet" \
  -device virtio-net,netdev=n0 \
  -netdev user,id=n0,hostfwd=tcp::3600-:3000 \
  -nographic
```
The console will report DHCP success, server startup, and readiness. The
health-check thread polls `http://127.0.0.1:3000/healthz` and prints
`[HH:MM:SS] init: OpenVSCode ready` once the Node process is listening.

## Known issues
- Plain `curl http://127.0.0.1:3600/` still fails with `Connection reset by
  peer` even though the port is open. This is tracked in
  [issue #552](https://github.com/ryanmaclean/vibecode-webgui/issues/552); we
  need to tweak the launch flags or serve a static landing page.
- No arm64 image yet. [Issue #553](https://github.com/ryanmaclean/vibecode-webgui/issues/553)
  covers creating an Apple-friendly build and turning the benchmark harness
  into `scripts/benchmarks/vscode_microvm.sh`.
- The initramfs currently lives outside git (`fast-openvscode-vm/` is ignored).
  To rebuild it, reuse the instructions from this document or the TODO entry
  dated 2025-10-02 21:19 UTC.

## Next steps
1. Fix the HTTP handshake so `/` returns a 200 response.
2. Wrap the launch + probe logic in a reusable script and emit Datadog metrics.
3. Produce an arm64 image and validate under Apple Containerization /
   Virtualization.framework.
