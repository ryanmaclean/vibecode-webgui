# GitHub Release Upload (Manual)

1. Sign in with a PAT that has `repo` scope (or use `gh auth login`).
2. Run: `gh release upload v1.5.0-desktop-alpha dist/artifacts/VibeCode_1.5.0_aarch64.dmg`.
3. Attach `src-tauri/target/release/bundle/macos/VibeCode.app` (zipped) if you prefer the source-built bundle.
4. Paste the notes from `docs/releases/CHECKPOINT_2025-11-03.md` into the release description.
