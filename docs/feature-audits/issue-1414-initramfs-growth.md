# Feature Audit: Initramfs Growth (Issue #1414)

## Scope
Confirm “Initramfs growth +3 MB (117 MB → 120 MB)” from v3.2.1 release notes is present in current mainline.

## Evidence (repo scan)
- VM build scripts: `infrastructure/packer/`, `scripts/`, `tools/nodejs-vm/`
- Build artifacts not tracked in repo.

## Current Status
- **Size claim not verifiable** from repo source alone.

## TODO
- [ ] Identify build pipeline that produces initramfs.
- [ ] Capture current initramfs size and compare to v3.2.1 release note.
- [ ] Add a build report/metric artifact that records initramfs size.

## Missing Info / Questions
- Which VM image / build target produced the 117→120 MB change?
- Are sizes measured compressed or uncompressed, and from which environment?

## Notes
Acceptance requires feature present in mainline, docs updated if needed, tests added/updated if applicable.
