# Tauri Backend - VibeCode Desktop

Rust backend for the VibeCode desktop application using Tauri 2.x.

## Platform Support

**⚠️ Currently ARM64 (Apple Silicon) Only**

The VibeCode desktop app currently supports **macOS Apple Silicon (M1/M2/M3)** only. Intel Mac (x86_64) builds are not available due to the missing vibecode-vm sidecar binary for x86_64 architecture.

**Supported:**
- ✅ macOS ARM64 (aarch64-apple-darwin) - Apple Silicon Macs

**Not Supported:**
- ❌ macOS Intel (x86_64-apple-darwin) - Missing vibecode-vm sidecar binary
- ❌ Universal Binary - Requires both ARM64 and x86_64 sidecar binaries

### Technical Details

The app depends on the `vibecode-vm` sidecar binary for container management. This binary is currently only available for ARM64 architecture (`platforms/tauri/binaries/vibecode-vm-aarch64-apple-darwin`). To enable Intel Mac support, the vibecode-vm binary would need to be compiled for x86_64-apple-darwin.

See [Tauri Sidecar Documentation](https://v2.tauri.app/develop/sidecar/) for more details on external binary handling.

## Prerequisites

- Rust: https://rustup.rs/
- Tauri CLI: Already installed via `@tauri-apps/cli` in devDependencies
- **macOS Apple Silicon (M1/M2/M3)** - Required for current build

## Quick Start

```bash
# Build for Apple Silicon (production)
npm run build:macos:local

# Build in dev/debug mode
npm run build:macos:local:dev

# Skip frontend rebuild (use existing build artifacts)
npm run build:macos:local:skip-frontend
```

## Project Structure (After Init)

```text
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
