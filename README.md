# VibeCode

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Native desktop app wrapping code-server with AI assistance.

## What It Is

VS Code in browser (code-server) wrapped with Tauri for native desktop experience.

```
code-server → Tauri wrapper → VibeCode Desktop + AI Assistant
```

## Features

- **VS Code in Browser** - Full code-server features
- **Native Desktop** - macOS, Windows, Linux support
- **AI Assistant** - 321+ models via OpenRouter
- **VM Providers** - vfkit, QEMU, Lima, WSL2, Docker
- **Embedded Systems** - STM32, ESP32, Raspberry Pi support
- **Portable** - Small bundle (~2.5MB core)

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

Extension auto-installs when code-server starts.

## Download

**[Latest Releases](https://github.com/ryanmaclean/vibecode-webgui/releases/latest)**

| Platform | Formats | Architectures |
|----------|---------|---------------|
| macOS | `.dmg`, `.app` | Intel, Apple Silicon, Universal |
| Linux | `.deb`, `.AppImage`, `.rpm` | x86_64, ARM64 |
| Windows | `.msi`, `.exe` | x86_64 |

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
