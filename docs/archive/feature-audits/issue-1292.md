# Feature Audit 1292: vibecode-nodejs (50GB)

Source release: VibeCode Desktop v1.2.0 - Apple Virtualization Framework (1.2.0-2)

## Expected Feature
- Pre-configured Node.js development environment VM image (50GB).

## Current Repo Touchpoints (to verify)
- VM image build scripts for Node.js environment
- Launch/registry manifests
- Docs referencing vibecode-nodejs image

## Audit Checklist
- [ ] Locate Node.js VM image build pipeline and configs
- [ ] Confirm disk size target (50GB)
- [ ] Verify image is referenced by runtime/launcher
- [ ] Update docs if paths or sizes changed
- [ ] Add/adjust tests or validation scripts

## Missing Info / Questions
- Where is the image stored (repo artifact vs registry)?
- What Node.js version(s) are expected?
- Is 50GB still required or has sizing changed?

## Tests / Validation (TODO)
- Add validation to ensure Node.js VM image exists and boots with expected size.
