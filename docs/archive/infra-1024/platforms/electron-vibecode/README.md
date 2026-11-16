# VibeCode Electron Desktop (optional / legacy)

> **Status: optional / not actively shipped**
>
> This directory contains an Electron-based desktop wrapper for VibeCode.
> It is **not part of the primary release pipeline** and is not CI-tested.
> See [`docs/ADR/desktop-runtime.md`](../../docs/ADR/desktop-runtime.md) for the decision record.

## Background

The Electron path was created to explore Chromium-engine compatibility for VS Code extensions. The Tauri-based desktop (`platforms/tauri/`) was selected as the canonical runtime because it is lighter-weight and further along in the release pipeline.

## Using This Path (local experimentation only)

```bash
cd platforms/electron-vibecode
npm install
npm start
```

Or from the repo root:

```bash
npm run start:electron
```

## Caveats

- Security patches for the bundled Electron/Chromium version are not actively tracked.
- This path is **not tested** in CI and may fall behind the main application.
- No new features should be added here without a team discussion and a new ADR.

## Canonical Desktop Path

For production desktop builds, use **Tauri**:

```bash
npm run tauri:dev    # development
npm run tauri:build  # production build
```

See [`platforms/tauri/README.md`](../tauri/README.md) and [`docs/DESKTOP_BUILD_GUIDE.md`](../../docs/DESKTOP_BUILD_GUIDE.md) for full instructions.
