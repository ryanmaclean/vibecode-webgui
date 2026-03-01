# ADR: Desktop Runtime — Tauri (canonical), Electron (optional/legacy)

## Status
Accepted

## Date
2026-02-25

---

## Context

VibeCode has two desktop runtime paths:

1. **Tauri** (`platforms/tauri/`) — Rust-backed, lightweight, native OS webview, built into the primary CI and release pipeline.
2. **Electron** (`platforms/electron-vibecode/`) — Chromium-backed, heavier, added for extension-compatibility experiments; **not actively shipped** in production releases.

Maintaining both desktop runtimes increases:

- CI matrix complexity (Rust toolchain + Electron build matrix)
- Release engineering surface (two separate DMG/installer outputs)
- Dependency exposure (Electron brings its own bundled Chromium; security patches land independently)
- Cognitive overhead for contributors deciding which path to extend

## Decision

**Tauri is the one canonical desktop runtime for VibeCode.**

- All desktop-related build scripts, CI jobs, and release automation target Tauri.
- `platforms/electron-vibecode/` is preserved in the repository for reference and optional local experimentation but is **not shipped, not CI-tested, and not supported**.
- New desktop features are implemented against the Tauri path only.

## Consequences

- Contributors must not add new desktop features to `platforms/electron-vibecode/` without first discussing the decision with the team.
- The `start:electron` npm script in the root `package.json` remains available for local use but carries no support guarantee.
- `platforms/electron-vibecode/README.md` documents its legacy/optional status to avoid confusion.
- If the team later decides to revive Electron for a specific use-case (e.g., full VS Code extension host), a new ADR should supersede this one.

## Alternatives Considered

| Option | Rationale for rejection |
|--------|-------------------------|
| Remove `platforms/electron-vibecode/` entirely | Premature; the code may be useful as a reference or for future experiments. Archiving in-place is lower risk. |
| Keep both paths equally supported | Doubles maintenance cost with no current user-facing benefit. |
| Migrate fully to Electron | Electron is heavier and the Tauri path is further along in CI/release tooling. |
