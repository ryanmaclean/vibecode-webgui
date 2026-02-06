# Feature Audit: DMG Size (Issue #1415)

## Scope
Confirm “DMG size 253 MB (compression ratio differences from v3.2.0)” from v3.2.1 release notes is present in current mainline.

## Evidence (repo scan)
- Release artifacts not stored in repo; tags include `v3.2.1`.
- Build scripts under `infrastructure/packer/` and `scripts/`.

## Current Status
- **DMG size claim not verifiable** from repo source alone.

## TODO
- [ ] Identify build pipeline that produces DMG for v3.2.x.
- [ ] Capture current DMG size and compression settings.
- [ ] Add build artifact size summary to release notes or CI report.

## Missing Info / Questions
- Which build target produced the 253 MB DMG and where is the artifact stored?
- Compression settings used for v3.2.1 vs v3.2.0.

## Notes
Acceptance requires feature present in mainline, docs updated if needed, tests added/updated if applicable.
