# Tauri Backend Setup

This directory will contain the Rust backend for the VibeCode desktop application.

## Prerequisites

Ensure you have the following installed:
- Rust (via rustup): https://rustup.rs/
- Tauri CLI: `npm install -g @tauri-apps/cli`

## Quick Start

### Initialize Tauri Project

```bash
# From project root
npx tauri init

# Follow the prompts:
# - App name: VibeCode
# - Window title: VibeCode
# - Web assets location: ../out (for Next.js static export)
# - Dev server URL: http://localhost:3000
# - Frontend dev command: npm run dev
# - Frontend build command: npm run build && npm run export
```

### Development Workflow

```bash
# Run in development mode (hot reload)
npm run tauri:dev

# Build for production
npm run tauri:build

# Build in debug mode (faster, for testing)
npm run tauri:build:debug
```

## Project Structure

```
src-tauri/
├── Cargo.toml           # Rust dependencies and metadata
├── tauri.conf.json      # Tauri configuration
├── entitlements.plist   # macOS entitlements (already created)
├── build.rs             # Build script (optional)
├── icons/               # Application icons
│   ├── icon.icns       # macOS icon
│   ├── icon.ico        # Windows icon
│   └── icon.png        # Linux icon
└── src/
    └── main.rs         # Rust entry point
```

## Required Dependencies

Add these to `Cargo.toml`:

```toml
[package]
name = "vibecode"
version = "0.1.0"
description = "VibeCode Desktop Application"
authors = ["VibeCode Team"]
license = "MIT"
repository = "https://github.com/vibecode/vibecode-webgui"
edition = "2021"

[build-dependencies]
tauri-build = { version = "2.0", features = [] }

[dependencies]
tauri = { version = "2.0", features = ["shell-open"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
tokio = { version = "1", features = ["full"] }

# Docker integration
bollard = "0.15"

# Bonjour/mDNS for network discovery
mdns-sd = "0.7"

# Logging
tracing = "0.1"
tracing-subscriber = "0.3"

[target.'cfg(target_os = "macos")'.dependencies]
cocoa = "0.25"
objc = "0.2"
```

## Tauri Configuration

Key settings in `tauri.conf.json`:

```json
{
  "build": {
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build",
    "devPath": "http://localhost:3000",
    "distDir": "../out",
    "withGlobalTauri": false
  },
  "package": {
    "productName": "VibeCode",
    "version": "0.1.0"
  },
  "tauri": {
    "allowlist": {
      "all": false,
      "shell": {
        "all": false,
        "open": true
      }
    },
    "bundle": {
      "active": true,
      "targets": "all",
      "identifier": "com.vibecode.app",
      "icon": [
        "icons/icon.icns",
        "icons/icon.ico",
        "icons/icon.png"
      ],
      "macOS": {
        "entitlements": "entitlements.plist",
        "exceptionDomain": "",
        "frameworks": [],
        "providerShortName": null,
        "signingIdentity": null,
        "minimumSystemVersion": "11.0"
      }
    },
    "security": {
      "csp": null
    },
    "windows": [
      {
        "fullscreen": false,
        "resizable": true,
        "title": "VibeCode",
        "width": 1200,
        "height": 800
      }
    ]
  }
}
```

## CI/CD Integration

The GitHub Actions workflows are already configured:

- `.github/workflows/tauri-release.yml` - Production builds and releases
- `.github/workflows/tauri-test.yml` - CI testing

See `.github/TAURI_CI_GUIDE.md` for complete documentation.

## Next Steps

1. **Initialize Tauri** (Issue #489)
   ```bash
   npx tauri init
   ```

2. **Configure Next.js for Tauri**
   - Enable static export in `next.config.js`
   - Set `output: 'export'`

3. **Create Basic Rust Commands**
   - Docker API integration
   - Bonjour/mDNS discovery
   - File system operations

4. **Test Development Workflow**
   ```bash
   npm run tauri:dev
   ```

5. **Configure Secrets** (Issue #492)
   - Follow `.github/TAURI_SECRETS.md`
   - Add Apple Developer credentials to GitHub

6. **Test CI Pipeline**
   ```bash
   git checkout -b feature/tauri-scaffolding-489
   git add .
   git commit -m "feat: initialize Tauri project"
   git push origin feature/tauri-scaffolding-489
   gh pr create
   ```

## Resources

- [Tauri Documentation](https://tauri.app/)
- [Tauri + Next.js Guide](https://tauri.app/v1/guides/getting-started/setup/next-js)
- [Rust Book](https://doc.rust-lang.org/book/)
- [CI/CD Guide](.github/TAURI_CI_GUIDE.md)
- [Secrets Configuration](.github/TAURI_SECRETS.md)

## Related Issues

- #488 - VibeCode.app Design (Parent Epic)
- #489 - Tauri Scaffolding & Project Setup
- #492 - DMG Packaging Pipeline (this issue)
