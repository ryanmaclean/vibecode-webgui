# VibeCode Rebrand Execution Plan

**Last updated:** November 3, 2025  
**Owner:** Desktop Platform Team  
**Status:** Draft (execution started)

---

## 1. Objectives
- Replace remaining "OpenVSCode Server" product surfaces with "VibeCode" branding.
- Align CLI, bundle identifiers, and data directories with the VibeCode identity.
- Ship a consistent icon set across desktop, web, and installer experiences.

---

## 2. Workstreams & Deliverables

### 2.1 Product Configuration (In Progress)
- [x] Update `openvscode-server/product.json` with VibeCode names, bundle identifier, and URLs.
- [ ] Review and rebrand user-facing strings in `openvscode-server/src` (welcome, about, settings).
- [ ] Update default data directory names and mutex identifiers to the `vibecode` prefix.

### 2.2 CLI & Binary Naming (In Progress)
- [x] Rename CLI binary output to `vibecode` in `openvscode-server/cli`.
- [ ] Update CLI help text, version banners, and log prefixes.
- [ ] Adjust scripts (`scripts/initramfs-builder/*.sh`, `src-tauri`) to call the new binary.
- [ ] Add migration notes for existing users upgrading from `code` binaries.

### 2.3 Icon & Visual Identity (Planned)
- [x] Register new icon filenames in `openvscode-server/product.json`.
- [ ] Export final icon assets (`.icns`, `.ico`, PNG sizes 16–512px).
- [ ] Update macOS bundle resources (`resources/darwin`) with VibeCode branding.
- [ ] Refresh web splash screen and about dialog artwork.

### 2.4 Documentation & Release Notes (Planned)
- [ ] Announce the rebrand in `CHANGELOG.md` and release notes.
- [ ] Document rebrand migration steps in `docs/REBRAND_GUIDE.md`.
- [ ] Update screenshots in README and marketing collateral.

---

## 3. Timeline
| Week | Focus | Outcomes |
|------|-------|----------|
| Week of Nov 3 | Configuration & CLI rename | Product JSON swap, CLI binary renamed, draft comms outline |
| Week of Nov 10 | Asset production | Final icon exports, installer/UI updates |
| Week of Nov 17 | Documentation & QA | Changelog, regression testing, go/no-go review |

---

## 4. Open Questions
- Do we retain legacy `code-server` compatibility binaries for downgrade paths?
- Should telemetry identifiers change alongside mutex/data-folder renames?
- Are there downstream scripts (CI, automation) that expect the legacy application names?

---

## 5. Next Actions
1. Sweep `openvscode-server/src` for textual references to "OpenVSCode" and rewrite to "VibeCode".
2. Update CLI help output (`--help`, `--version`) to display the new product name.
3. Coordinate with Design for final icon exports and update macOS bundle resources.
4. Draft migration notes for internal beta before public launch.
