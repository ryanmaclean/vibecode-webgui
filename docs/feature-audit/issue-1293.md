# Feature Audit 1293: vibecode-nodejs-codeserver (50GB)

Source release: VibeCode Desktop v1.2.0 - Apple Virtualization Framework (1.2.0-2)

## Expected Feature
- Pre-configured Node.js + code-server VM image (50GB).

## Current Repo Touchpoints (to verify)
- VM image build scripts for Node.js + code-server
- Launch/registry manifests
- Docs referencing vibecode-nodejs-codeserver image

## Audit Checklist
- [ ] Locate image build pipeline and configs
- [ ] Confirm disk size target (50GB)
- [ ] Verify code-server integration and launch config
- [ ] Update docs if paths or sizes changed
- [ ] Add/adjust tests or validation scripts

## Missing Info / Questions
- Where is the image stored (repo artifact vs registry)?
- What code-server version is expected?
- Is 50GB still required or has sizing changed?

## Tests / Validation (TODO)
- Add validation to ensure image exists, boots, and code-server is reachable.
