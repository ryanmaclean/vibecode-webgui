# Feature Audit: vibecode-postgresql (10GB) VM (Issue #1440)

Source release: VibeCode Desktop v1.5.0 - Apple Virtualization Framework & Performance (v1.5.0)
Status: Partial (config/scripts exist; image packaging not verified)

## Evidence in mainline
- `config/vfkit/postgresql-vm.yaml` defines the `vibecode-postgresql` VM.
- Build/boot scripts reference `vibecode-postgresql` (e.g., `scripts/build-vz-vms-parallel.sh`, `scripts/boot-all-vms.sh`).
- Docs and scripts reference a 10GB disk size for the VM.

## Gaps / Missing info
- No verified release artifact path for the 10GB PostgreSQL VM image.
- No automated test confirming the VM boots and PostgreSQL is reachable.

## TODO / Plan
- Confirm packaging path for `vibecode-postgresql.img` in release builds.
- Add a smoke test that boots the VM and checks port 5432.

## Tests
- Not added in this PR. Suggested: use existing VM test scripts to validate PostgreSQL VM startup.
