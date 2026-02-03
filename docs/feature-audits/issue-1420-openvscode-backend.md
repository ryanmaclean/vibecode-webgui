# Feature Audit: OpenVSCode Server Backend (Issue #1420)

## Scope
Confirm “OpenVSCode Server backend with native Rust CLI (no Docker required)” from v1.5.0 release notes is present in current mainline.

## Evidence (repo scan)
- VM/CLI tooling: `tools/nodejs-vm/`, `tools/cli/`, `scripts/`
- OpenVSCode references: `tools/nodejs-vm/README.md`, `infrastructure/packer/*`

## Current Status
- **OpenVSCode references present**, but **native Rust CLI path not validated** in this audit.

## TODO
- [ ] Locate Rust CLI entrypoint (if any) used to launch OpenVSCode.
- [ ] Confirm no-Docker path works in current mainline build.
- [ ] Add a CLI smoke test that exercises OpenVSCode startup.

## Missing Info / Questions
- Which CLI binary is referenced in the release notes and where is it built?
- Is the no-Docker path still the supported default in current mainline?

## Notes
Acceptance requires feature present in mainline, docs updated if needed, tests added/updated if applicable.
