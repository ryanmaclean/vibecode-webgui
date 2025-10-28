# VibeCode

[![Desktop Build](https://github.com/ryanmaclean/vibecode-webgui/actions/workflows/desktop-build.yml/badge.svg)](https://github.com/ryanmaclean/vibecode-webgui/actions/workflows/desktop-build.yml)
[![Tauri Release](https://github.com/ryanmaclean/vibecode-webgui/actions/workflows/tauri-release.yml/badge.svg)](https://github.com/ryanmaclean/vibecode-webgui/actions/workflows/tauri-release.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Native desktop app wrapping code-server with AI assistance.

**Simple**: VS Code in the browser, wrapped with Tauri for native desktop.

## What It Is

VibeCode wraps code-server (VS Code in browser) with a native Tauri app to provide a desktop experience.

### Features

- ✅ **VS Code in Browser** - code-server with full VS Code features
- ✅ **Native Desktop** - Tauri wrapper for macOS/Windows/Linux
- ✅ **Embedded Systems** - Deploy to STM32, ESP32, Raspberry Pi (see [Embedded Docs](./docs/tauri/EMBEDDED_SYSTEMS.md))
- ✅ **Serial Provisioning** - Automate device provisioning at scale
- ✅ **AI Assistant Extension** - Multi-provider AI coding assistance
- ✅ **Portable** - Small bundle size (~2.5MB)

## Quick Start

### Install Extension

```bash
# Already compiled and ready
cd extensions/vibecode-ai-assistant
npm install
npm run compile
```

### Run Desktop App

```bash
npm run tauri:dev
```

### Use Extension

Extension is already installed in code-server when it starts.

## Architecture

```
code-server (VS Code in browser)
    ↓
Wrapped with Tauri (native desktop)
    ↓
VibeCode AI Assistant extension
```

That's it. Simple wrapper around code-server.

## Extension Features

- AI Code Generation
- 321+ AI Models via OpenRouter
- Project Templates
- Cloud Deployment
- Real-time Collaboration

## Desktop Application

### Download

Get the latest desktop builds for your platform:

**[Download Latest Release](https://github.com/ryanmaclean/vibecode-webgui/releases/latest)**

### Supported Platforms

| Platform | Architectures | Package Formats |
|----------|--------------|-----------------|
| **macOS** | Intel (x86_64), Apple Silicon (ARM64), Universal | `.dmg`, `.app` |
| **Linux** | x86_64, ARM64 | `.deb`, `.AppImage`, `.rpm` |
| **Windows** | x86_64 | `.msi`, `.exe` |

### Quick Installation

**macOS:**
```bash
# Download and open the DMG
# Drag VibeCode.app to Applications
```

**Linux (Debian/Ubuntu):**
```bash
sudo dpkg -i VibeCode_*_amd64.deb
```

**Linux (AppImage):**
```bash
chmod +x VibeCode_*_amd64.AppImage
./VibeCode_*_amd64.AppImage
```

**Windows:**
```powershell
# Run the MSI installer
msiexec /i VibeCode_*.msi
```

### Features

- **Native Performance** - Compiled Rust backend with Tauri
- **Cross-Platform** - Single codebase for macOS, Linux, and Windows
- **Lightweight** - Small bundle size (~2.5MB core app)
- **Code Signed** - Signed and notarized for macOS and Windows
- **Auto-Updates** - Built-in updater support (coming soon)

### Build from Source

See [Desktop Build Guide](./docs/DESKTOP_BUILD_GUIDE.md) for detailed instructions.

**Quick build:**
```bash
# Install dependencies
npm install --legacy-peer-deps

# Build for your platform
npm run tauri:build

# Or use platform scripts
./scripts/desktop/build-macos.sh      # macOS
./scripts/desktop/build-linux.sh      # Linux
.\scripts\desktop\build-windows.ps1   # Windows
```

### System Requirements

| Platform | Minimum Version |
|----------|----------------|
| macOS | 10.13+ (High Sierra) |
| Linux | Ubuntu 20.04+, Debian 11+, Fedora 35+ |
| Windows | Windows 10 (build 1809+) or Windows 11 |

### Documentation

- [Desktop Build Guide](./docs/DESKTOP_BUILD_GUIDE.md) - Comprehensive build instructions
- [Testing Guide](./docs/DESKTOP_BUILD_TESTING.md) - QA testing procedures
- [Cross-Platform Builds](./docs/ISSUE_686_CROSS_PLATFORM_BUILDS.md) - Implementation details

## VM Provider Support

VibeCode includes a unified VM provider abstraction layer for seamless virtualization across platforms.

### Supported Providers

| Provider | Platform | Status | Best For |
|----------|----------|--------|----------|
| **vfkit** | macOS (Apple Silicon) | ✅ Implemented | Native macOS development |
| **QEMU+KVM** | Linux | ✅ Implemented | Linux servers, production |
| **Lima** | macOS, Linux | ✅ Implemented | Cross-platform development |
| **WSL2** | Windows | ✅ Implemented | Windows development |
| **Docker** | All platforms | ✅ Implemented | Testing, CI/CD |

### Quick Start with VMs

```bash
# Auto-detect best provider
import { ProviderFactory } from '@/lib/vm/provider-factory';
const provider = await ProviderFactory.detectProvider();

# Create a VM
const vm = await provider.create({
  name: 'dev-vm',
  cpus: 4,
  memory: '8GB',
  disk: '50GB',
  image: 'alpine-3.22'
});

# Execute commands
const result = await provider.exec(vm.id, 'echo "Hello VM"');
console.log(result.stdout);
```

### VM Documentation

- [VM Provider API Design](./docs/vm-provider-abstraction-api-design.md) - Complete API specification
- [Implementation Guide](./docs/vm-provider-implementation-guide.md) - How to add new providers
- [Provider Comparison](./docs/vm-provider-comparison.md) - Feature matrix and benchmarks

### Performance

| Provider | Boot Time | Memory Overhead | Best Platform |
|----------|-----------|-----------------|---------------|
| vfkit | 2-5s | ~100MB | macOS Apple Silicon |
| QEMU+KVM | 3-8s | ~150MB | Linux |
| Lima | 5-15s | ~200MB | macOS, Linux |
| WSL2 | 1-3s | ~50MB | Windows |
| Docker | <1s | ~30MB | All (containers) |

## Embedded Systems

VibeCode extends Tauri to embedded hardware platforms, from microcontrollers to industrial systems.

### Supported Platforms

| Platform | Status | Hardware Examples | Use Cases |
|----------|--------|-------------------|-----------|
| **STM32** | ✅ Documented | STM32H7, STM32F7, STM32MP1 | Industrial HMI, motor control |
| **ESP32** | 🚧 Planned | ESP32-S3, ESP32-C6 | IoT devices, WiFi gateways |
| **Raspberry Pi** | ✅ Documented | Pi 4, Pi 5, Compute Module 4 | Edge computing, robotics |
| **Industrial HMI** | ✅ Documented | Advantech, Siemens panels | Factory automation |

### Key Features

- **Serial Provisioning**: Mass provision 1000s of devices in parallel via serial console
- **OTA Updates**: Built-in firmware update system with rollback
- **Bare-Metal + Linux**: Choose LVGL (MCU) or WebView (Linux) based on requirements
- **AI-Assisted Development**: Generate embedded code with VibeCode AI

### Quick Start (Embedded)

**STM32 (Bare-Metal)**:
```bash
# Install embedded toolchain
rustup target add thumbv7em-none-eabihf
cargo install probe-rs-tools

# Build and flash
cd examples/stm32-tauri
cargo build --release
probe-rs run --chip STM32H750VBTx
```

**Raspberry Pi (Linux)**:
```bash
# Cross-compile from x86_64
rustup target add aarch64-unknown-linux-gnu
cargo build --release --target aarch64-unknown-linux-gnu

# Or build natively on Pi
./scripts/embedded/build-raspberry-pi.sh
```

### Documentation

- **[Embedded Systems Guide](./docs/tauri/EMBEDDED_SYSTEMS.md)** - Comprehensive guide with market analysis
- **[STM32 Implementation](./docs/tauri/STM32_EMBEDDED.md)** - Bare-metal Tauri on ARM Cortex-M
- **[Serial Automation](./docs/infrastructure/SERIAL_CONSOLE_AUTOMATION.md)** - Device provisioning pattern
- **[Strategic Vision](./docs/concepts/EMBEDDED_VIBECODE.md)** - Business case and roadmap

### Use Cases

1. **Industrial Automation**: Replace expensive HMI software ($10k-100k) with open-source Tauri apps
2. **IoT Device Management**: Web-based UI for configuring and monitoring edge devices
3. **Robotics**: ROS integration with real-time sensor visualization
4. **Edge AI**: Deploy ML models with inference monitoring and OTA updates
5. **Building Automation**: HVAC control, energy management (BACnet/KNX integration)

**Market Opportunity**: $482B TAM across industrial automation, IoT, edge computing, and robotics

## Development

See 🛠️ [VibeCode CLI](./scripts/VIBECODE_CLI.md) - Unified development toolkit

## License

MIT