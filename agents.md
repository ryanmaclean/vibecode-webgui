# Agent Quick Reference

## Three-Tier VM Strategy (2025-10-02)

VibeCode now supports **three complementary VM runtimes** optimized for different platforms:

| Platform | Runtime | Boot Time | Status | Issues |
|----------|---------|-----------|--------|--------|
| **Linux** | Cloud Hypervisor | <2s | ✅ Released | #542-#546 |
| **macOS** | Virtualization.framework | <2s | ✅ Implemented | #547 |
| **Portable** | OpenVSCode microVM | 0.5s | ✅ Prototyped | #552-#553 |

**Key Documents**:
- `MERGE_SUMMARY_2025-10-02.md` - Complete merge analysis
- `archive/agents/2025-10-02-macos-vm-handoff.md` - macOS VM coordination
- `archive/agents/2025-10-02-firecracker-bench-hand-off.md` - Benchmarking
- `archive/agents/2025-10-02-openvscode-microvm.md` - OpenVSCode prototype

---

## macOS Native VM Workflow (NEW - Issue #547)

1. **Installation** (One command)
   - Run `./scripts/macos-vm/install.sh` to download kernel, build binary, and configure service
   - Binary: `bin/vibecode-vm` (85KB ARM64)
   - Kernel: Reuses cloud-hypervisor release (34MB vmlinuz + 8.3MB initramfs)

2. **Usage**
   - Manual: `./bin/vibecode-vm`
   - Service: `launchctl load ~/Library/LaunchAgents/com.vibecode.vm.plist`
   - Access: http://localhost:8080

3. **Documentation**
   - `macos-vm/README.md` - Complete user guide
   - `macos-vm/VERIFIED.md` - Build verification
   - `macos-vm/RELATED_ISSUES.md` - Issue cross-references

4. **Status**: Implementation complete, needs boot testing

---

## Fast OpenVSCode MicroVM Workflow

1. **Stable release available**
   - Fetch the packaged image from GitHub release `fast-openvscode-vm-v0.1.0`.
   - Rebuild locally with `scripts/release/package-fast-openvscode-vm.sh`; the script generates `<timestamp>.tar.gz` + `.sha256` in `dist/`.

2. **Nightly/insiders build**
   - `fast-openvscode-vm-insiders/` mirrors the stable tree and is ready for the latest `openvscode-server-insiders` tarball.
   - Issue #554 tracks replacing the contents and releasing a prerelease (e.g., `fast-openvscode-vm-v0.2.0-pre`).

3. **Keep large assets out of git**
   - `.gitignore` excludes both VM directories. Package with the script and upload artifacts to releases; do not commit binaries.

4. **Documentation links**
   - `demos/README.md` explains where to download releases and how to rebuild/upload.
   - `archive/agents/2025-10-02-firecracker-bench-hand-off.md` summarizes completed work and outstanding tasks.

5. **Open issues to monitor**
   - #555 Automate the VM release pipeline in CI.
   - #556 Document the stable + insiders workflow.
   - #557 Define nightly VM verification checklist.
   - #554 Prep insiders prerelease (nightly build).
   - #552 / #553 cover HTTP handshake fixes and automated benchmarking.

6. **Benchmark tooling**
   - `scripts/benchmarks/boot_latency_bench.py` and `firecracker_bench.py` emit DogStatsD metrics via `--dogstatsd`.
   - `scripts/benchmarks/emit_to_datadog.py` forwards JSON outputs (with dry-run support). Dashboards/monitors are tracked in #550 and noisy-neighbor tests in #551.

7. **Nightly build checklist (once defined)**
   - Swap in new insiders bits under `fast-openvscode-vm-insiders/`.
   - Run `scripts/release/package-fast-openvscode-vm.sh`.
   - Execute the verification checklist (issue #557 once complete).
   - Publish release artifacts and update docs with download link + SHA256.

Keep this file updated when major workflow changes land so new agents can hit the ground running.
