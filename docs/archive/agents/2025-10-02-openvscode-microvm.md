# Agent Log — 2025-10-02 (OpenVSCode Micro-VM)

## Summary
- Installed `qemu-system-x86` and built a BusyBox+glibc initramfs that boots
  OpenVSCode Server. The compressed artifact lives at
  `fast-openvscode-vm/openvscode-initramfs.cpio.gz` (~69 MB).
- Enhanced `/init` with timestamped logging, DHCP setup, readiness polling, and
  automatic power-off after the editor exits.
- Verified boot via KVM: the VM acquires a lease and the port forward becomes
  reachable in ~0.5 s (`{'port_ready_ms': 492}` via `nc`).
- HTTP GET against `/` still resets; filed [issue #552] to track the fix.
- Created follow-up [issue #553] to automate the benchmark and deliver an arm64
  build for Apple virtualization tests.

## Key Artifacts
- `fast-openvscode-vm/rootfs/init` — init script with logging + readiness probe.
- `fast-openvscode-vm/openvscode-initramfs.cpio.gz` — gzipped initramfs
  (ignored by git; regenerate using instructions in
  `docs/virtualization/openvscode-microvm.md`).
- `fast-openvscode-vm/qemu.log` — sample boot output (ignored).
- `docs/virtualization/openvscode-microvm.md` — new doc capturing the build
  process, limitations, and next steps.
- TODO entry “Agent Update (2025-10-02 21:19 UTC)” summarises today’s work.

## Follow-up Issues
- [#552](https://github.com/ryanmaclean/vibecode-webgui/issues/552) — Fix HTTP
  handshake so `/` returns landing page rather than connection reset.
- [#553](https://github.com/ryanmaclean/vibecode-webgui/issues/553) — Automate
  benchmark script, document rebuild, and produce arm64 initramfs.

## Notes for Next Agent
- Git keeps the initramfs tree ignored; keep using `fast-openvscode-vm/` as the
  working directory and create release assets if you need to share binaries.
- The prototype uses OpenVSCode Server v1.103.1 (current upstream release as of
  today). Update the payload by replacing the tarball under
  `fast-openvscode-vm/downloads/` and rebuilding the initramfs.
- Health polling is currently hardwired to `/healthz`; adjust once issue #552 is
  resolved to test the real landing page.
- Consider adding a `scripts/benchmarks/vscode_microvm.sh` helper before the
  next performance study.
