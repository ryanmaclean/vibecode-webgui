# Feature Audit 1511: Sandboxing - Tauri security sandbox for web content

## Source
- Release: VibeCode Desktop v1.5.0 - Apple Virtualization Framework & Performance (v1.5.0)
- Issue: #1511

## Summary
Audit status: **TBD**

This audit will confirm Tauri security sandbox configuration for web content
and document any gaps.

## Plan
- Locate Tauri security configuration (allowlist/CSP/sandbox settings).
- Verify current behavior matches release notes.
- Update docs if any drift is found.
- Add/update tests once entrypoints are confirmed.

## Missing Info / Questions
- Where is the authoritative Tauri security config in mainline?
- Are there platform-specific sandbox constraints?

## Tests
- TODO: Add unit/integration coverage once entrypoints are confirmed.
