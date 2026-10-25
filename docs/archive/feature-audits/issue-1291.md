# Feature Audit 1291: vibecode-valkey (10GB)

Source release: VibeCode Desktop v1.2.0 - Apple Virtualization Framework (1.2.0-2)

## Expected Feature
- Pre-configured Valkey (Redis-compatible) VM image (10GB).

## Current Repo Touchpoints (to verify)
- VM image build scripts for Valkey/Redis
- Launch/registry manifests
- Docs referencing vibecode-valkey image

## Audit Checklist
- [ ] Locate Valkey VM image build pipeline and configs
- [ ] Confirm disk size target (10GB)
- [ ] Verify image is referenced by runtime/launcher
- [ ] Update docs if paths or sizes changed
- [ ] Add/adjust tests or validation scripts

## Missing Info / Questions
- Where is the image stored (repo artifact vs registry)?
- What version of Valkey is expected?
- Is 10GB still required or has sizing changed?

## Tests / Validation (TODO)
- Add validation to ensure Valkey VM image exists and boots with expected size.
