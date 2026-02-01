# OpenVSCode Micro-VM Prototype (2025-10-02)

This document captures the current state of the BusyBox + glibc initramfs that
hosts OpenVSCode Server inside a tiny KVM guest. The latest build exposes a
proxy-backed HTTP surface so `/` and `/healthz` respond immediately while the
editor continues to load in the background. Cold boots on macOS HVF reach HTTP
readiness in ~6.1 s and the port can now be fronted directly by MCP demos.

## What was built
- BusyBox-based initramfs (`fast-openvscode-vm/openvscode-initramfs.cpio.gz`,
  ~69 MB gzipped) with manually copied glibc/libstdc++ and the
  `openvscode-server-v1.105.1` payload.
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
# Build or copy the Apple VF artifacts into bench-images/apple-vf/
# (run these from the `kernel-builder` Lima VM or a Debian container)
lima kernel-builder -- ./scripts/benchmarks/build-minivim-kernel.sh arm64 6.12.10
lima kernel-builder -- ./scripts/benchmarks/build-busybox-musl.sh arm64
# (optional) assemble initramfs
cd bench-images/apple-vf
find rootfs -print0 | cpio --null -ov --format=newc | gzip -9 > openvscode-initramfs.cpio.gz

# Launch via QEMU
MICROVM_ARCH=arm64 MICROVM_RUNTIME=qemu scripts/benchmarks/vscode_microvm.sh start
curl -s http://127.0.0.1:4600/healthz   # -> ok
curl -I http://127.0.0.1:4600/          # -> HTTP/1.1 200 OK
MICROVM_ARCH=arm64 MICROVM_RUNTIME=qemu scripts/benchmarks/vscode_microvm.sh stop

# Apple VF fast-boot assets (EFI-stub + minimal BusyBox initramfs)
./scripts/benchmarks/build-efi-stub-kernel.sh arm64 6.12.10
./scripts/benchmarks/build-minimal-initramfs.sh arm64

# Launch via Apple Virtualization Framework (experimental)
# 1. Point MICROVM_APPLEVF_CMD at a launcher that calls `vz`, `macvz`, `vfkit`, etc.
#    The helper exports these env vars for the launcher:
#      MICROVM_KERNEL, MICROVM_INITRD, MICROVM_CMDLINE
#      MICROVM_CPUS, MICROVM_MEMORY_MB
#      MICROVM_HOST, MICROVM_PORT
#      MICROVM_PID_FILE, MICROVM_SERIAL_LOG
# 2. Ensure the launcher keeps running until the VM exits and writes its PID to
#    MICROVM_PID_FILE (optional, but enables `stop` / `measure`).
MICROVM_ARCH=arm64 MICROVM_RUNTIME=applevf \
  MICROVM_APPLEVF_CMD=./scripts/benchmarks/applevf-vfkit-launcher.sh \
  scripts/benchmarks/vscode_microvm.sh start
```

The launcher can be a thin bash script that shells out to `vz`, `macvz`, or
`vfkit`. Read the exported environment variables to build the command line,
keep the VM process running, and record the background PID in
`$MICROVM_PID_FILE` so the `stop` helper can terminate it cleanly.

The helper script records a PID file in `${TARGET_DIR}/.microvm.pid` and
captures console output in `${TARGET_DIR}/qemu-console.log` for debugging.

## Benchmarks
| Host | Arch | Runtime | Kernel/initramfs | Avg port-ready | Notes |
| --- | --- | --- | --- | --- | --- |
| macOS 14.6.1 (Intel) | x86_64 | QEMU HVF | vmlinux-fast + openvscode-initramfs | ~6.1 s | `/healthz` ready, HTTP proxy in initramfs |
| macOS 14.x (M-series) | arm64 | Apple VF (vfkit) | EFI-stub kernel + openvscode-initramfs | TBD (<10 s target) | Run `scripts/benchmarks/applevf_fastboot_bench.sh` + `vscode_microvm.sh measure` |

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

## Swift helper for Lima (Intel macOS experimentation)

- The new `swift/lima-launcher` package wraps `limactl` via a Swift CLI so Intel
  hosts can boot the `vm-assets/ide-lima.yaml` profile without juggling the
  larger bash toolkit. You can call it directly (`swift run --package-path swift/lima-launcher lima-launcher …`) or via the npm scripts below.
- Quick helpers:
  - `npm run lima:start`
  - `npm run lima:status`
  - `npm run lima:stop`
- Use `swift run --package-path swift/lima-launcher lima-launcher forward --port 8080` (or hand-wire an ssh tunnel) to expose code-server inside the Lima guest at `http://127.0.0.1:8080`—handy when testing Tauri or hypervisor orchestration that expects the classic port 8080 workflow.
- Want a Chrome/Chromium kiosk view? Run `npm run ide:kiosk` (optionally set `CHROMIUM_APP_PATH=/Applications/Chromium.app`). The script boots Lima, waits for `/healthz`, and opens the IDE fullscreen with a dedicated profile under `.chrome-code-server`.
- Need the tool to pick the fastest stack automatically? `npm run ide:universal` checks for vfkit on Apple Silicon, falls back to Lima on Intel, and finally to host-only mode when no hypervisor is available. Whichever path it chooses, Chromium/Chrome runs in kiosk mode with GPU acceleration.
- Need a redistributable macOS app? Execute `scripts/dev/package-lima-kiosk.sh` to build `dist/VibeCodeLima.app` (wraps the Swift lima-launcher + kiosk script). Ship the resulting `.app`/`.dmg` via GitHub releases for teammates who just want to double-click and land in the IDE.
