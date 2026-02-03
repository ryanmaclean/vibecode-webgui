# Feature Audit: Memory Usage (Issue #1417)

## Scope
Confirm “Extension uses ~50 MB when active” from v3.2.1 release notes is present in current mainline.

## Evidence (repo scan)
- Extension code in `extensions/vibecode-ai-assistant/` and `extensions/vibecode-inline-edit/`
- No memory profiling report checked in.

## Current Status
- **Memory usage claim not verified** in this audit.

## TODO
- [ ] Identify how memory usage was measured for the extension.
- [ ] Reproduce memory usage in current build (OpenVSCode or VS Code host).
- [ ] Add a lightweight profiling script or documentation note.

## Missing Info / Questions
- Which extension is referenced and under what workload/state?
- Measurement tool and environment (OS, host app, dataset).

## Notes
Acceptance requires feature present in mainline, docs updated if needed, tests added/updated if applicable.
