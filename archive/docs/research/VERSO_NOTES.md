# Verso Research Notes

**Date:** November 3, 2025  
**Researcher:** Desktop Platform Team  
**Status:** Initial triage complete

## Quick Findings
- Verso is currently archived and unmaintained; latest notice recommends relying on Servo directly when possible.
- Builds target Servo via `cargo run` across macOS, Windows, and Linux (Flatpak/Nix). macOS requires Xcode + Homebrew deps (`cmake`, `harfbuzz`, `pkg-config`).
- Flatpak workflow generates manifests with `flatpak-cargo-generator.py` before invoking `flatpak-builder`.
- Nightly binaries are unsigned; macOS users manually remove quarantine attributes.

## Compatibility Questions
- Servo revisions have outpaced Verso; integration risk if we embed the archived UI without forking/maintenance.
- Need to inspect Servo's current embedding APIs to decide whether to fork Verso for UI shell or use Servo directly.

## Next Actions (Week 1)
1. Catalogue Verso crates and top-level modules—identify reusable embed layers vs. UI code.
2. Test `cargo run` on macOS within a fresh dev container to gauge dependency footprint.
3. Document Servo API surfaces Verso relies on; compare with Servo head to assess breakage.
4. Draft integration experiment plan (standalone Tauri window embedding Verso webview).

## References
- https://github.com/versotile-org/verso (README, build instructions)
- https://wusyong.github.io/posts/verso-ui/ (background on Servo integration)
