# OpenVSCode Micro-VM Prototype (2025-10-02)

This document captures the current state of the BusyBox + glibc initramfs that
hosts OpenVSCode Server inside a tiny KVM guest. The latest build exposes a
proxy-backed HTTP surface so `/` and `/healthz` respond immediately while the
editor continues to load in the background. Cold boots on macOS HVF reach HTTP
readiness in ~6.1 s and the port can now be fronted directly by MCP demos.

## What was built
- BusyBox-based initramfs (`fast-openvscode-vm/openvscode-initramfs.cpio.gz`,
  ~69 MB gzipped) with manually copied glibc/libstdc++ and the
  `openvscode-server-v1.103.1` payload.
- Custom `/init` script mounts proc/sys/dev/tmp, configures a static IP
  (10.0.2.15), launches OpenVSCode on port 3001, and starts an in-guest Node.js
  reverse proxy that serves `/healthz` / `/` with HTTP 200 responses before
  forwarding all other routes to the editor.
- `scripts/benchmarks/vscode_microvm.sh` controls the VM lifecycle (start/stop/
  status/measure) and emits JSON latency samples suitable for Datadog or local
  comparisons.
- `scripts/release/package-fast-openvscode-vm.sh` now excludes cached tarballs
  and logs, and `scripts/release/fetch-fast-openvscode-kernel.sh` fetches a
  trimmed Firecracker kernel. The harness still falls back to `vmlinuz-host`
  when no custom kernel is available.

## Quick start (macOS HVF or Linux)

### x86_64 guest (default)
```bash
# Ensure QEMU is installed (brew install qemu on macOS, apt install qemu-system-x86 on Linux)
scripts/benchmarks/vscode_microvm.sh start
curl -s http://127.0.0.1:3600/healthz   # -> ok
curl -I http://127.0.0.1:3600/          # -> HTTP/1.1 200 OK
scripts/benchmarks/vscode_microvm.sh stop

# Optional: expose HTTPS for Safari/iPad testing
npm run microvm:https   # -> proxies https://127.0.0.1:3443 to the microVM
```

### arm64 guest
```bash
MICROVM_ARCH=arm64 scripts/benchmarks/vscode_microvm.sh start
curl -s http://127.0.0.1:4600/healthz   # -> ok
curl -I http://127.0.0.1:4600/          # -> HTTP/1.1 200 OK
MICROVM_ARCH=arm64 scripts/benchmarks/vscode_microvm.sh stop
```

The helper script records a PID file in `${TARGET_DIR}/.microvm.pid` and
captures console output in `${TARGET_DIR}/qemu-console.log` for debugging.

## Benchmarks
```
$ scripts/benchmarks/vscode_microvm.sh measure 5
{"port_ready_ms": [6212, 6002, 6103, 6057, 6177]}

$ MICROVM_ARCH=arm64 scripts/benchmarks/vscode_microvm.sh measure 3
{"port_ready_ms": [19745, 19525, 19217]}
```
Average HTTP-ready time on macOS 14.6.1: ~6.1 s for the HVF-backed x86_64 guest
and ~19.5 s for the arm64 guest running under TCG on Intel hardware. Docker
start/stop on the same host averages ~0.29 s using `boot_latency_bench.py`, so
we still trail containers for cold launches; keep a warm VM running for demos to
avoid repeated cold boots. Once we validate on Apple Silicon with Virtualization
Framework passthrough we expect the arm64 numbers to drop substantially.

## Packaging
```bash
# x86_64 bundle
scripts/release/package-fast-openvscode-vm.sh fast-openvscode-vm

# arm64 bundle
scripts/release/package-fast-openvscode-vm.sh fast-openvscode-vm-arm64
```
Artifacts land in `dist/` with matching `.sha256` files. The script excludes
cached tarballs, QEMU logs, and pid files so uploads stay lean. To refresh the
kernel, either supply `MICROVM_KERNEL=/path/to/vmlinux` when starting the VM or
rebuild a kernel via Firecracker resources/`linux-image-arm64` and copy the
resulting `/boot/vmlinuz-*` plus `/lib/modules/*` into the tree before
repackaging.

For automated runs, `scripts/ci/package_microvm.sh` loops over the configured
architectures, calls `vscode_microvm.sh measure`, and packages the artifacts.
Wire this into CI/nightlies so both tarballs and JSON metrics publish together.

## Known issues
- Validate the arm64 build under Apple Virtualization/Colima on Apple Silicon
  and capture updated readiness metrics ([issue #553](https://github.com/ryanmaclean/vibecode-webgui/issues/553)).
- CI automation for nightly insiders builds remains open in
  [issue #554](https://github.com/ryanmaclean/vibecode-webgui/issues/554).
- The initramfs directories (`fast-openvscode-vm*/`) stay outside git; regenerate
  them via `find .../rootfs | cpio --null -ov --format=newc | gzip` whenever the
  rootfs tree changes.
