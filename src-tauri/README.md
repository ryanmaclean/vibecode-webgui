# Tauri Backend - VibeCode Desktop

Rust backend for the VibeCode desktop application using Tauri 2.x.

## Prerequisites

- Rust: https://rustup.rs/
- Tauri CLI: Already installed via `@tauri-apps/cli` in devDependencies

## Quick Start

```bash
# Initialize Tauri project (once scaffolding is complete)
npx tauri init

# Run in development mode
npm run tauri:dev

# Build for production
npm run tauri:build
```

## Project Structure (After Init)

```
src-tauri/
├── Cargo.toml           # Rust dependencies
├── tauri.conf.json      # Tauri configuration
├── entitlements.plist   # macOS entitlements (ready)
├── src/
│   └── main.rs          # Rust entry point
└── icons/               # App icons
```

## CI/CD Pipeline

The DMG packaging pipeline is ready and configured in:
- `.github/workflows/tauri-release.yml` - Production builds
- `.github/workflows/tauri-test.yml` - CI testing
- `.github/TAURI_SECRETS.md` - Secrets configuration

## Next Steps

1. Complete Tauri scaffolding (Issue #489)
2. Configure secrets for code signing (see `.github/TAURI_SECRETS.md`)
3. Test pipeline: `gh workflow run tauri-release.yml`

## Related Issues

- #488 - VibeCode.app Design (Parent Epic)
- #489 - Tauri Scaffolding & Project Setup
- #492 - DMG Packaging Pipeline (this pipeline)
