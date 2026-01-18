# OpenVSCodium Server Roadmap (October 2025)

Use these issue outlines when filing work items in GitHub. Link them to the `fast-openvscode` project board and reference this doc in the issue description for context.

---

## Issue: Replace Gitpod Binary With Maintained OpenVSCodium Build
- **Type**: enhancement
- **Summary**: Fork the VSCodium build pipeline to produce a telemetry-clean `openvscodium-server` bundle that matches upstream VS Code releases within 24 hours.
- **Scope**:
  - Clone VSCodium’s build scripts, enable the `server` target, and configure brand assets.
  - Strip unused language servers and Electron artifacts to slim the archive.
  - Embed our default extensions and settings.
  - Emit SBOM + cosign attestations for the generated tarball.
- **Acceptance**:
  - CI job publishes `openvscodium-server-<version>-linux-x64.tar.gz` + `.sha256` and attaches them to `dist/` artifacts.
  - README packaging instructions cover switching between Gitpod and the new build.

## Issue: Automate Fast-OpenVSCode Package Version Tracking
- **Type**: chore
- **Summary**: Extend `scripts/release/package-fast-openvscode-vm.sh` to resolve the latest OpenVSCode version via GitHub API before repacking.
- **Scope**:
  - Add helper to fetch release metadata and download the matching tarball into `fast-openvscode-vm/downloads/`.
  - Support overriding the version with `OPENVSCODE_VERSION` for reproducible builds.
  - Update checksums recorded in `dist/*.sha256`.
- **Acceptance**:
  - Running the script with no args pulls the current release.
  - `git status` stays clean except for regenerated artifacts.

## Issue: Benchmark Custom Build vs Gitpod Baseline
- **Type**: task
- **Summary**: Compare cold-boot latency and image size between the Gitpod tarball and the new OpenVSCodium build on both QEMU (hvf) and vfkit + gvproxy.
- **Scope**:
  - Use `scripts/benchmarks/vscode_microvm.sh measure` to collect 10-run samples for each build.
  - Record archive and initramfs sizes.
  - Publish results under `performance-results/fast-openvscode/2025-10-XX.json`.
- **Acceptance**:
  - Report shared in `docs/virtualization/openvscodium-benchmarks.md`.
  - Regression budget defined (e.g., ≤5% slower than Gitpod baseline).

## Issue: Track Apple Silicon Arm64 Artifact (#553 follow-up)
- **Type**: enhancement
- **Summary**: Produce an arm64 initramfs using the OpenVSCodium build, validate under Apple’s `container` CLI and vfkit.
- **Scope**:
  - Generate arm64 tarball during the same CI job.
  - Update README instructions with arm64 boot steps.
- **Acceptance**:
  - Apple Silicon host boots microVM and passes `/healthz` in <7 s (cold).
  - Release asset includes both x86_64 and arm64 bundles plus checksums.

## Issue: Add Supply Chain Attestations
- **Type**: security
- **Summary**: Publish SBOM and cosign attestations for OpenVSCodium artifacts and microVM packages.
- **Scope**:
  - Integrate `syft`/`cosign` into the release job.
  - Store SBOM under `dist/fast-openvscode-vm-<timestamp>.sbom.json`.
- **Acceptance**:
  - Attestations verified during release (`cosign verify-attestation`).
  - README documents how to validate.

---

## Quick Filing Checklist
1. Copy the issue block into GitHub → Issues → New Issue.
2. Set the milestone “OpenVSCodium v0.2.0”.
3. Add labels: `virtualization`, `fast-openvscode`, `security` (for attestations).
4. Link to related items (#552, #553, #554) and this roadmap.

