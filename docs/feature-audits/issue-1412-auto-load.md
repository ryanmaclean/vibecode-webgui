# Feature Audit: Auto-Load Extension (Issue #1412)

## Scope
Confirm “Extension loads automatically at OpenVSCode startup” from v3.2.1 release notes is present in current mainline.

## Evidence (repo scan)
- OpenVSCode references: `tools/nodejs-vm/README.md`, `infrastructure/packer/*`
- VS Code extension definitions: `extensions/vibecode-ai-assistant/`, `extensions/vibecode-inline-edit/`

## Current Status
- **Extension code exists**, but **auto-load behavior not verified** in this audit.

## TODO
- [ ] Locate OpenVSCode startup config that installs/enables extensions.
- [ ] Add a startup check or doc that confirms auto-load behavior.
- [ ] Add a VM/CLI smoke test that validates extension activation.

## Missing Info / Questions
- Where is the OpenVSCode extension install/enable step defined (init script, packer step, or runtime hook)?
- Which extension(s) are expected to auto-load?

## Notes
Acceptance requires feature present in mainline, docs updated if needed, tests added/updated if applicable.
