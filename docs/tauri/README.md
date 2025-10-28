# Tauri Desktop Application Documentation

## Overview

VibeCode includes a Tauri desktop application that wraps the Next.js web interface in a native application shell. This provides better desktop integration, Docker management capabilities, and a more seamless user experience compared to running in a web browser.

## What is Tauri?

Tauri is a framework for building desktop applications with web technologies. Unlike Electron, Tauri uses the system's native webview (WebKit on macOS, WebView2 on Windows, WebKitGTK on Linux), resulting in:

- **Smaller Bundle Size**: 10-20MB vs 100MB+ for Electron
- **Better Performance**: Native webview with lower memory overhead
- **Rust Backend**: High-performance, type-safe backend with access to system APIs
- **Security First**: Built-in security features and sandboxing

## Architecture

```
┌─────────────────────────────────────────┐
│         VibeCode Desktop App            │
├─────────────────────────────────────────┤
│  Frontend (Next.js)                     │
│  - Web UI in static export mode         │
│  - React components                     │
│  - Monaco editor                        │
│  - Tauri invoke() API calls             │
├─────────────────────────────────────────┤
│  Tauri Core (Rust)                      │
│  - IPC bridge                           │
│  - Window management                    │
│  - System tray integration              │
│  - Command handlers                     │
├─────────────────────────────────────────┤
│  Native Modules (Rust)                  │
│  - Docker integration (bollard)         │
│  - mDNS service discovery               │
│  - File system operations               │
│  - System commands                      │
├─────────────────────────────────────────┤
│  System WebView                         │
│  - WebKit (macOS)                       │
│  - WebView2 (Windows)                   │
│  - WebKitGTK (Linux)                    │
└─────────────────────────────────────────┘
```

## Key Features

### Desktop Integration

- **Native Window**: Full native window with system menu bar, minimize, maximize, close
- **System Tray**: Background running with tray icon for quick access
- **Notifications**: Native system notifications for build status, container events
- **File System Access**: Direct file system access for workspace management

### Docker Management

- **Connection Check**: Automatic Docker availability detection on startup
- **Version Info**: Display Docker daemon version and configuration
- **Container Control**: Start, stop, restart containers directly from desktop app
- **Status Monitoring**: Real-time container status updates via native APIs

### Performance Optimizations

- **Static Export**: Next.js app built as static HTML/CSS/JS for faster loading
- **Native WebView**: System webview instead of bundled Chromium
- **Rust Backend**: High-performance backend for heavy operations
- **Efficient IPC**: Type-safe IPC between frontend and backend

## Documentation Structure

### Desktop Application
- **[Getting Started](GETTING_STARTED.md)** - Setup, installation, and first run
- **[Architecture](ARCHITECTURE.md)** - Technical architecture and design decisions
- **[Development Guide](DEVELOPMENT.md)** - Building, testing, and debugging
- **[API Reference](API_REFERENCE.md)** - Tauri commands and frontend integration
- **[Deployment](DEPLOYMENT.md)** - Building releases, code signing, distribution
- **[Troubleshooting](TROUBLESHOOTING.md)** - Common issues and solutions

### Embedded Systems
- **[Embedded Systems Guide](EMBEDDED_SYSTEMS.md)** - Comprehensive guide to Tauri on embedded hardware
- **[STM32 Implementation](STM32_EMBEDDED.md)** - Bare-metal Tauri on ARM Cortex-M microcontrollers
- **[Serial Communication](SERIAL_COMMUNICATION.md)** - Serial port support for IoT and embedded devices
- **[Serial Automation](../infrastructure/SERIAL_CONSOLE_AUTOMATION.md)** - Device provisioning pattern

### Strategic
- **[Embedded VibeCode Vision](../concepts/EMBEDDED_VIBECODE.md)** - Strategic vision and market opportunity

## Quick Links

### Setup and Development

```bash
# Install Tauri CLI
cargo install tauri-cli

# Run in development mode
cargo tauri dev

# Build for production
cargo tauri build
```

See [Getting Started](GETTING_STARTED.md) for detailed setup instructions.

### Project Structure

```
src-tauri/
├── src/
│   ├── main.rs           # Application entry point
│   ├── commands.rs       # Tauri command handlers
│   └── docker.rs         # Docker integration module
├── icons/                # Application icons
├── Cargo.toml           # Rust dependencies
├── tauri.conf.json      # Tauri configuration
└── build.rs             # Build script
```

### Configuration

Key configuration files:

- `src-tauri/tauri.conf.json` - Tauri app configuration
- `src-tauri/Cargo.toml` - Rust dependencies and metadata
- `next.config.mjs` - Next.js static export configuration
- `.github/workflows/tauri-release.yml` - CI/CD for releases

## Current Implementation

### Version: 0.1.0

**Status**: Beta - Active development

**Supported Platforms**:
- macOS 10.13+ (Intel and Apple Silicon)
- Windows 10+ (planned)
- Linux (planned)

**Current Features**:
- ✅ Native window with Next.js frontend
- ✅ Docker availability check
- ✅ Docker version detection
- ✅ Development mode with hot reload
- ✅ Production build with code signing
- ✅ DMG packaging for macOS
- 🚧 Container management UI
- 🚧 System tray integration
- 🚧 Notifications
- 🚧 Auto-updates

### Dependencies

**Rust Dependencies**:
- `tauri` - Desktop application framework
- `tauri-plugin-shell` - Shell command execution
- `bollard` - Docker API client
- `mdns-sd` - mDNS service discovery
- `tokio` - Async runtime
- `serde` - Serialization framework
- `thiserror` - Error handling

**Frontend Dependencies**:
- Next.js (static export mode)
- React
- Monaco Editor
- Tailwind CSS

## Development Workflow

### Local Development

1. **Start Next.js dev server**: `npm run dev`
2. **Start Tauri dev mode**: `cargo tauri dev`
3. **Make changes**: Frontend changes hot-reload automatically
4. **Backend changes**: Requires Tauri restart

### Building Releases

1. **Update version**: `src-tauri/tauri.conf.json` and `src-tauri/Cargo.toml`
2. **Build Next.js**: `npm run build:export`
3. **Build Tauri app**: `cargo tauri build`
4. **Sign and notarize**: Automated via CI/CD
5. **Create release**: Tag with `app-v*` format

See [Deployment Guide](DEPLOYMENT.md) for detailed release process.

## CI/CD Pipeline

**Workflow**: `.github/workflows/tauri-release.yml`

**Triggers**:
- Push to tags matching `app-v*` (e.g., `app-v1.0.0`)
- Push to `feature/dmg-packaging` branch
- Pull requests affecting `src-tauri/**`
- Manual workflow dispatch

**Build Steps**:
1. Checkout repository
2. Setup Rust toolchain
3. Setup Node.js environment
4. Install dependencies
5. Build Next.js static export
6. Build Tauri application
7. Code sign application (macOS)
8. Notarize with Apple (macOS)
9. Create DMG installer
10. Upload artifacts and create release

**Artifacts**:
- macOS DMG installer
- Application bundle (.app)
- Update manifests
- Build logs

## Security

### Code Signing

**macOS**:
- Developer ID Application certificate required
- Hardened runtime enabled
- Entitlements configured for sandbox restrictions
- Notarization via Apple notary service

**Windows** (planned):
- Code signing certificate required
- Microsoft SmartScreen compatibility

### Content Security Policy

Configured in `tauri.conf.json`:

```json
{
  "security": {
    "csp": "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://trusted-cdn.com; ..."
  }
}
```

### Sandboxing

- Network access restricted to configured domains
- File system access limited to user-selected directories
- Shell commands require explicit whitelist
- IPC commands require explicit handler registration

## Contributing

### Prerequisites

- Rust 1.70+
- Node.js 18+
- Tauri CLI
- Platform-specific tools (Xcode for macOS, Visual Studio for Windows)

### Development Setup

See [Getting Started](GETTING_STARTED.md) for detailed setup instructions.

### Pull Request Guidelines

1. Test on all supported platforms
2. Update documentation if adding features
3. Follow Rust and TypeScript style guides
4. Add tests for new functionality
5. Update CHANGELOG.md

## Resources

### Official Documentation

- [Tauri Documentation](https://tauri.app/v2/)
- [Tauri API Reference](https://tauri.app/v2/reference/)
- [Tauri Guides](https://tauri.app/v2/guides/)

### VibeCode Specific

- [Project Repository](https://github.com/ryanmaclean/vibecode-webgui)
- [Issue Tracker](https://github.com/ryanmaclean/vibecode-webgui/issues)
- [Discussions](https://github.com/ryanmaclean/vibecode-webgui/discussions)

### Community

- [Tauri Discord](https://discord.com/invite/tauri)
- [Rust Forum](https://users.rust-lang.org/)

## Roadmap

### v0.2.0 (Q4 2025)
- Windows support
- System tray integration
- Native notifications
- Container management UI

### v0.3.0 (Q1 2026)
- Linux support
- Auto-update functionality
- Menu bar customization
- Keyboard shortcuts

### v1.0.0 (Q2 2026)
- Production-ready release
- Full platform coverage
- Comprehensive testing
- Documentation complete

## License

Same as main VibeCode project.

## Support

For Tauri-specific issues:

1. Check [Troubleshooting Guide](TROUBLESHOOTING.md)
2. Search existing [GitHub Issues](https://github.com/ryanmaclean/vibecode-webgui/issues?q=label%3Atauri)
3. Open new issue with `tauri` label
4. Join discussions in project Discord/Slack

---

**Last Updated**: 2025-10-01
**Version**: 0.1.0
**Status**: Beta
