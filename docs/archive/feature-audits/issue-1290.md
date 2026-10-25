# Feature Audit 1290: vibecode-postgresql (10GB)

Source release: VibeCode Desktop v1.2.0 - Apple Virtualization Framework (1.2.0-2)

## Expected Feature
- Pre-configured PostgreSQL database VM image (10GB).

## Current Repo Touchpoints (to verify)
- VM image build scripts for PostgreSQL
- Launch/registry manifests
- Docs referencing vibecode-postgresql image

## Audit Checklist
- [ ] Locate PostgreSQL VM image build pipeline and configs
- [ ] Confirm disk size target (10GB) in image or provisioning scripts
- [ ] Verify image is referenced by runtime or launcher
- [ ] Update docs if paths or sizes changed
- [ ] Add/adjust tests or validation scripts

## Missing Info / Questions
- Where is the image stored (repo artifact vs registry)?
- What is the current versioning/tagging scheme?
- Is 10GB still required or has sizing changed?

## Tests / Validation (TODO)
- Add validation step to ensure PostgreSQL VM image exists and launches with correct storage size.
