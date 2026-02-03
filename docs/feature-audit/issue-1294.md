# Feature Audit 1294: vibecode-pgvector (20GB)

Source release: VibeCode Desktop v1.2.0 - Apple Virtualization Framework (1.2.0-2)

## Expected Feature
- Pre-configured PostgreSQL VM with pgvector extension (20GB).

## Current Repo Touchpoints (to verify)
- VM image build scripts for pgvector
- Extension install scripts
- Launch/registry manifests
- Docs referencing vibecode-pgvector image

## Audit Checklist
- [ ] Locate pgvector VM image build pipeline and configs
- [ ] Confirm disk size target (20GB)
- [ ] Verify pgvector extension installation and runtime checks
- [ ] Update docs if paths or sizes changed
- [ ] Add/adjust tests or validation scripts

## Missing Info / Questions
- Where is the image stored (repo artifact vs registry)?
- What pgvector version is expected?
- Is 20GB still required or has sizing changed?

## Tests / Validation (TODO)
- Add validation to ensure image exists and pgvector extension loads successfully.
