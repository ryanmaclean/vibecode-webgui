# Feature Audit 1295: vibecode-ide (50GB)

Source release: VibeCode Desktop v1.2.0 - Apple Virtualization Framework (1.2.0-2)

## Expected Feature
- Full IDE environment VM image (50GB).

## Current Repo Touchpoints (to verify)
- VM image build scripts for IDE environment
- Launch/registry manifests
- Docs referencing vibecode-ide image

## Audit Checklist
- [ ] Locate IDE VM image build pipeline and configs
- [ ] Confirm disk size target (50GB)
- [ ] Verify IDE components (code-server / extensions / tooling) are installed
- [ ] Update docs if paths or sizes changed
- [ ] Add/adjust tests or validation scripts

## Missing Info / Questions
- What IDE stack is expected (code-server vs OpenVSCode vs other)?
- Where is the image stored (repo artifact vs registry)?
- Is 50GB still required or has sizing changed?

## Tests / Validation (TODO)
- Add validation to ensure IDE image exists and main IDE service is reachable after boot.
