# Feature Audit: Tauri 2.9.1 Integration (Issue #1419)

## Scope
Confirm “Tauri 2.9.1 integration” from v1.5.0 release notes is present in current mainline.

## Evidence (repo scan)
- Tauri config files: `next.config.tauri.js`, `src/app/*`, `src-tauri/` (if present)
- Tauri-related docs under `docs/`

## Current Status
- **Tauri integration presence not validated** in this audit (version not confirmed).

## TODO
- [ ] Locate Tauri config and confirm version (2.9.1) used in current build.
- [ ] Add a version check or build doc snippet.
- [ ] Add a minimal Tauri build smoke test (if applicable).

## Missing Info / Questions
- Where is the authoritative Tauri version pinned (Cargo.toml / package.json / build config)?
- Is 2.9.1 still the target version in current mainline?

## Notes
Acceptance requires feature present in mainline, docs updated if needed, tests added/updated if applicable.
