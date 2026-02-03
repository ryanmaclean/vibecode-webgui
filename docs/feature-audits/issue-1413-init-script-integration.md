# Feature Audit: Init Script Integration (Issue #1413)

## Scope
Confirm “Modified /etc/init.d/openvscode for seamless activation” from v3.2.1 release notes is present in current mainline.

## Evidence (repo scan)
- VM/build scripts live under `infrastructure/packer/` and `tools/nodejs-vm/`
- OpenVSCode references in VM docs: `tools/nodejs-vm/README.md`

## Current Status
- **Init script changes not yet located** in repo for this audit.

## TODO
- [ ] Locate init.d/openvscode modifications in build scripts or VM image sources.
- [ ] Document the startup path (what invokes openvscode, with which flags).
- [ ] Add a test or verification step in VM build to assert the init script changes are present.

## Missing Info / Questions
- Where is `/etc/init.d/openvscode` defined/maintained (repo path or external image)?
- Which build pipeline (packer, VM build) applies this modification?

## Notes
Acceptance requires feature present in mainline, docs updated if needed, tests added/updated if applicable.
