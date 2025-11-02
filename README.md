# VibeCode - DEMO GITHUB WORKFLOW REPOSITORY - APP BUILDS AS SAMPLES FOR TRACING

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![CI](https://github.com/ryanmaclean/vibecode-webgui/workflows/CI/badge.svg)](https://github.com/ryanmaclean/vibecode-webgui/actions/workflows/ci.yml)
[![Build macOS](https://github.com/ryanmaclean/vibecode-webgui/workflows/Build%20macOS/badge.svg)](https://github.com/ryanmaclean/vibecode-webgui/actions/workflows/build-macos.yml)
[![Release](https://img.shields.io/github/v/release/ryanmaclean/vibecode-webgui)](https://github.com/ryanmaclean/vibecode-webgui/releases/latest)
[![Platform](https://img.shields.io/badge/platform-macOS-blue.svg)](https://github.com/ryanmaclean/vibecode-webgui/releases/latest)
[![codecov](https://codecov.io/gh/ryanmaclean/vibecode-webgui/branch/main/graph/badge.svg)](https://codecov.io/gh/ryanmaclean/vibecode-webgui)

Native desktop app built on OpenVSCode Server with AI assistance and macOS native integration.

## What It Is

OpenVSCode Server with native macOS integration via Swift 5 + Rust FFI + Virtualization Framework SDK.

```
OpenVSCode Server (Rust CLI + Node) → Swift 5 Wrapper → VibeCode Desktop + AI Assistant
```

## Features

- **Native VS Code** - OpenVSCode Server with native Rust CLI
- **macOS Native** - Swift 5, Virtualization Framework SDK, no Docker
- **AI Assistant** - 321+ models via OpenRouter
- **VM Integration** - Native vfkit, QEMU, Lima support
- **Rust + Swift** - Native performance and system integration
- **Open-VSX** - Community extension registry

## Quick Start

### Run Desktop App
```bash
npm install --legacy-peer-deps
npm run tauri:dev
```

### Install AI Extension
```bash
cd extensions/vibecode-ai-assistant
npm install && npm run compile
```

Extension auto-installs when OpenVSCode Server starts.

## Download

**[Latest Releases](https://github.com/ryanmaclean/vibecode-webgui/releases/latest)**

| Platform | Formats | Architectures |
|----------|---------|---------------|
| macOS | `.dmg`, `.app` | Intel, Apple Silicon, Universal |
| Linux | `.deb`, `.AppImage`, `.rpm` | x86_64, ARM64 |
| Windows | `.msi`, `.exe` | x86_64 |

## Implementation Status

### Phase Progress

| Phase | Status | Completion | Documentation |
|-------|--------|------------|---------------|
| **Phase 1: Backend Decision** | ✅ Complete | 100% | [BACKEND_DECISION.md](./docs/BACKEND_DECISION.md) |
| **Phase 2: Build Stabilization** | ✅ Complete | 100% | [BUILD_STATUS.md](./docs/BUILD_STATUS.md) |
| **Phase 3: Rebrand** | 🔄 In Progress | ~30% | REBRAND_PLAN.md (TBD) |
| **Phase 4: Swift Integration** | 🔄 In Progress | ~20% | SWIFT_RUST_FFI_INTEGRATION.md (TBD) |
| **Phase 5: Authentication Strategy** | ✅ Design Complete | 100% | [AUTHENTICATION_STRATEGY.md](./security/AUTHENTICATION_STRATEGY.md) |
| **Phase 6: Dashboard Design** | ✅ Design Complete | 100% | [DASHBOARD_DESIGN.md](./docs/DASHBOARD_DESIGN.md) |

**Master Roadmap:** [IMPLEMENTATION_ROADMAP.md](./docs/IMPLEMENTATION_ROADMAP.md)

### Key Achievements
- ✅ **OpenVSCode Server** chosen as definitive backend (no Docker required)
- ✅ **Native ARM64 build** successful in 4 minutes 17 seconds
- ✅ **Comprehensive authentication** architecture designed (hybrid Swift + Caddy)
- ✅ **Dashboard design** complete with React + Zustand + Tauri
- 🔄 **Rebranding** in progress (VibeCode identity)
- 🔄 **Swift-Rust FFI** bridge under development

### Quick Links
- [Quick Start Guide](./QUICKSTART.md) - Get started in 5 minutes
- [Installation Guide](./INSTALL.md) - Complete installation instructions
- [User Guide](./USER_GUIDE.md) - Full user documentation
- [Release Notes](./RELEASE_NOTES.md) - What's new in v1.5.0
- [Architecture Diagram](./docs/ARCHITECTURE_DIAGRAM.md) - System overview
- [Documentation Index](./docs/README.md) - Complete doc catalog

---

## Documentation

### Core
- [Desktop Build](./docs/DESKTOP_BUILD_GUIDE.md) - Build from source
- [Testing](./docs/DESKTOP_BUILD_TESTING.md) - QA procedures
- [CLI Tools](./scripts/VIBECODE_CLI.md) - Development toolkit

### Advanced
- [VM Providers](./docs/vm-provider-abstraction-api-design.md) - API specification
- [Embedded Systems](./docs/tauri/EMBEDDED_SYSTEMS.md) - STM32, ESP32, Raspberry Pi
- [Serial Automation](./docs/infrastructure/SERIAL_CONSOLE_AUTOMATION.md) - Device provisioning

### Architecture
- [Cross-Platform](./docs/ISSUE_686_CROSS_PLATFORM_BUILDS.md) - Build system
- [Implementation Guide](./docs/vm-provider-implementation-guide.md) - Add VM providers
- [Strategic Vision](./docs/concepts/EMBEDDED_VIBECODE.md) - Embedded roadmap

## System Requirements

- **macOS**: 10.13+ (High Sierra)
- **Linux**: Ubuntu 20.04+, Debian 11+, Fedora 35+
- **Windows**: 10 (build 1809+) or 11

## Build from Source

```bash
# Install dependencies
npm install --legacy-peer-deps

# Build desktop app
npm run tauri:build

# Platform-specific scripts
./scripts/desktop/build-macos.sh      # macOS
./scripts/desktop/build-linux.sh      # Linux
.\scripts\desktop\build-windows.ps1   # Windows
```

## License

MIT
