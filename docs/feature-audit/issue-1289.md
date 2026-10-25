# Feature Audit 1289: Native VM Images (Alpine 3.22 service VMs)

Source release: VibeCode Desktop v1.2.0 - Apple Virtualization Framework (1.2.0-2)

## Expected Feature
- Pre-configured Alpine Linux 3.22 VM images for various services.

## Current Repo Touchpoints (to verify)
- VM image build scripts: `scripts/`, `docker/`, `vm/`, `images/` (confirm actual paths)
- Release artifacts / image manifests (if any)
- Docs referencing pre-built images

## Audit Checklist
- [ ] Locate any Alpine 3.22 image build pipeline
- [ ] Confirm image naming and storage (local/registry)
- [ ] Verify images are referenced by runtime/launch scripts
- [ ] Update docs if feature exists with new paths/usage
- [ ] Add/adjust tests or validation scripts

## Missing Info / Questions
- Where are the Alpine 3.22 images supposed to live (repo vs registry)?
- Are these images versioned with tags (e.g., `vibecode-<service>:<version>`)?
- Which services are expected (postgres/valkey/node/etc.)?

## Tests / Validation (TODO)
- Add a lightweight validation script or CI check that asserts expected image manifests exist.
