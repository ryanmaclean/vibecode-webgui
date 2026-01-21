# Publish MiniVim multi-arch release bundle

**Owner:** Nexus → Release automation

## Summary
- Once x86_64/arm64/armv7 MiniVim kernels are refreshed, produce a consolidated release (tarball + checksums) mirroring `minivim-20251002` with updated artefacts and benchmark JSON.
- Provide one-click downloads per architecture for Lima/Colima/HyperKit users and document SHA256 values in `docs/virtualization/minivim-kernel.md` + `demos/README.md`.

## Tasks
- [ ] Gather latest artefacts from `bench-images/minivim/` and `artifacts/minivim/` (bzImage/Image/zImage + initramfs + CPU info + benchmark JSON).
- [ ] Update `scripts/release/package-fast-openvscode-vm.sh` or add a dedicated packager to emit `minivim-<arch>-<timestamp>.tar.gz` bundles.
- [ ] Generate SHA256 sums, upload to GitHub Releases, and link from documentation.
- [ ] Refresh `demos/README.md` with download links and rebuild instructions.
- [ ] Note wall-clock build times & hardware in the release notes for comparison against Issue #573/#574/#576 reports.

## Acceptance Criteria
- New release entry published with artefacts for all supported architectures (x86_64, arm64, armv7).
- Docs point to the new release and include checksum table.
- Release notes capture timing baselines and reference Issues #573, #574, #576.

## References
- `docs/virtualization/minivim-kernel.md`
- `demos/README.md`
- Issues #573, #574, #576, #575
