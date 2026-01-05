# VibeCode - Sample Repository

**This is a sample/demo VibeCode repository for testing GitHub workflows and tracing.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![CI](https://github.com/ryanmaclean/vibecode-webgui/workflows/CI/badge.svg)](https://github.com/ryanmaclean/vibecode-webgui/actions/workflows/ci.yml)
[![Build macOS](https://github.com/ryanmaclean/vibecode-webgui/workflows/Build%20macOS/badge.svg)](https://github.com/ryanmaclean/vibecode-webgui/actions/workflows/build-macos.yml)
[![Release](https://img.shields.io/github/v/release/ryanmaclean/vibecode-webgui)](https://github.com/ryanmaclean/vibecode-webgui/releases/latest)
[![Platform](https://img.shields.io/badge/platform-macOS-blue.svg)](https://github.com/ryanmaclean/vibecode-webgui/releases/latest)
[![codecov](https://codecov.io/gh/ryanmaclean/vibecode-webgui/branch/main/graph/badge.svg)](https://codecov.io/gh/ryanmaclean/vibecode-webgui)
[![Tests](https://img.shields.io/badge/tests-2796%20total-blue)](./TESTING.md)
[![Coverage](https://img.shields.io/badge/coverage-60%25+-brightgreen)](https://codecov.io/gh/ryanmaclean/vibecode-webgui)
[![Node](https://img.shields.io/badge/node-18%20%7C%2020%20%7C%2022-brightgreen)](https://nodejs.org)

Experimental desktop code editor with code-server running in Tauri + AI integrations.

## What It Is

A sample project demonstrating code-server integration with native macOS features:

- **Code-server in Tauri** - Running but using webkit (has GUI bugs)
- **Alpine VM with ASIF** - Docker VM (45MB) with native Apple Virtualization.framework
- **Swift + Rust** - Native macOS integration experiments
- **AI Integrations** - OpenRouter, OpenAI, Claude API examples

**Note:** This is an experimental/sample repository. Code-server GUI has known issues due to webkit limitations.

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
- [Testing Guide](./TESTING.md) - Comprehensive testing documentation
- [Release Notes](./RELEASE_NOTES.md) - What's new in v1.5.0
- [Architecture Diagram](./docs/ARCHITECTURE_DIAGRAM.md) - System overview
- [Documentation Index](./docs/README.md) - Complete doc catalog

---

## Documentation

### Core
- [Desktop Build](./docs/DESKTOP_BUILD_GUIDE.md) - Build from source
- [Testing Guide](./TESTING.md) - Comprehensive testing documentation
- [Test Guidelines](./TEST_GUIDELINES.md) - Writing tests for contributors
- [Test Summary](./TEST_SUMMARY.md) - Test infrastructure overview
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

# Run tests
npm test                  # All tests
npm run test:coverage     # With coverage report

# Build desktop app
npm run tauri:build

# Platform-specific scripts
./scripts/desktop/build-macos.sh      # macOS
./scripts/desktop/build-linux.sh      # Linux
.\scripts\desktop\build-windows.ps1   # Windows
```

## Testing

We maintain a comprehensive test suite with 2,796+ tests covering unit, integration, and end-to-end scenarios.

### Quick Start

```bash
# Run all tests
npm test

# Run specific test types
npm run test:unit           # Unit tests only
npm run test:integration    # Integration tests
npm run test:e2e           # End-to-end tests

# Development workflow
npm run test:watch         # Watch mode
npm run test:coverage      # With coverage report
```

### Test Infrastructure

- **2,796 total tests** across the project
- **60%+ code coverage** (targeting 70%+)
- **Multi-version CI/CD** - Node.js 18, 20, 22
- **Automatic infrastructure detection** - Skips Docker/K8s when unavailable
- **Comprehensive documentation** - See [TESTING.md](./TESTING.md)

### For Contributors

Before submitting a PR:
1. Write tests for new features
2. Ensure existing tests pass: `npm test`
3. Check coverage: `npm run test:coverage`
4. Follow the [Test Guidelines](./TEST_GUIDELINES.md)

See [TESTING.md](./TESTING.md) for detailed testing documentation.

## License

MIT
