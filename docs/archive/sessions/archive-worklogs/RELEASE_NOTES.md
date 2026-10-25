# VibeCode WebGUI Desktop v1.1.0 Release Notes

**Release Date:** November 1, 2025
**Tauri Version:** 2.9.1
**Platform:** macOS, Linux, Windows

## What's New in v1.1.0

This is the inaugural stable release of VibeCode WebGUI Desktop, bringing native desktop integration to the VibeCode AI-powered development platform. This release transforms the web-based VibeCode experience into a fully native desktop application with macOS Virtualization Framework integration, Rust performance optimizations, and Swift 5 native UI components.

### Major Features

#### Native Desktop Application
- **Tauri 2.9.1 Integration** - Native desktop application built with Rust + Swift
- **OpenVSCode Server Backend** - Full VS Code experience with native Rust CLI (no Docker required)
- **Cross-Platform Support** - macOS (Intel + Apple Silicon), Linux (x86_64 + ARM64), Windows (x86_64)
- **Native System Integration** - Platform-native menus, notifications, and system tray support

#### Apple Virtualization Framework Integration
- **Apple VF Runtime Support** - Native Apple Virtualization Framework for running Linux VMs
- **vfkit Integration** - Fast, native VM management without heavy virtualization layers
- **VM Discovery System** - Automatic detection and management of VM images
- **Auto-Start Functionality** - Designated VMs start automatically on application launch
- **Lima VM Support** - Integration with Lima for lightweight Linux VM management

#### AI-Powered Development
- **321+ AI Models** - Access to OpenAI GPT-4, Anthropic Claude, Google Gemini, Mistral via OpenRouter
- **Multi-Provider Support** - Intelligent routing between AI providers based on task type
- **Model Orchestration Dashboard** - Complete management interface with usage analytics
- **Monacopilot Integration** - AI-powered code completion in Monaco editor (v1.2.7)
- **Context-Aware Suggestions** - Intelligent code completion using project context

#### Monaco Editor Experience
- **Monaco Editor 0.53.0** - Full-featured code editor with IntelliSense
- **Syntax Highlighting** - Support for 50+ programming languages
- **TypeScript/JavaScript** - First-class support with full type checking
- **Git Integration** - Built-in version control operations
- **Multi-Language Support** - Python, Rust, Go, Java, and more

#### VM Management & Infrastructure
- **Native VM Images** - Pre-configured Alpine Linux 3.22 VMs for various services
  - vibecode-postgresql (10GB) - PostgreSQL database VM
  - vibecode-valkey (10GB) - Redis-compatible in-memory store
  - vibecode-nodejs (50GB) - Node.js development environment
  - vibecode-nodejs-codeserver (50GB) - Node.js + code-server
  - vibecode-pgvector (20GB) - PostgreSQL with vector extensions
  - vibecode-ide (50GB) - Full IDE environment
- **UEFI Boot Support** - Modern boot with VZEFIBootLoader
- **Virtio Block Devices** - High-performance disk I/O
- **NAT Networking** - Automatic network configuration

#### Observability & Monitoring
- **Datadog Integration** - Optional metrics and APM (3 integration methods: SSH, cloud-init, Lima)
- **OpenTelemetry Tracing** - Distributed tracing support with OTLP exporters
- **Prometheus Metrics** - Metrics export on port 9090
- **Performance Monitoring** - Real-time application performance tracking
- **Custom Dashboards** - Pre-configured monitoring visualizations

### Performance Improvements

This release includes significant performance optimizations across the application stack:

- **Faster Startup Time** - Native Rust backend reduces initialization overhead
- **Reduced Memory Footprint** - Tauri's Rust core uses 50-70% less memory than Electron
- **Native VM Performance** - Apple Virtualization Framework delivers near-native VM speeds
- **Optimized Asset Loading** - Static asset bundling with Tauri resource system
- **Efficient Networking** - Native HTTP/WebSocket implementations

### Bug Fixes

#### VM & Virtualization
- Fixed VZ disk attachment configuration (now uses synchronizationMode: .full)
- Resolved VM startup crashes by implementing dedicated serial dispatch queue
- Fixed EFI NVRAM file discovery with correct naming pattern (.nvram)
- Resolved app sandbox issues for VM image access
- Fixed SwiftUI state management for VM list updates

#### Build & Configuration
- Removed VM binaries from repository (added to .gitignore)
- Updated dependency management (13 automated dependency updates via Dependabot)
- Improved Babel configuration for consistent transpilation
- Enhanced ESLint configuration (0 warnings in production)

## Installation

### macOS

#### Option 1: DMG Installer (Recommended)
1. Download `VibeCode-{version}.dmg` from the [Releases](https://github.com/ryanmaclean/vibecode-webgui/releases/latest) page
2. Open the downloaded DMG file
3. Drag `VibeCode.app` to your Applications folder
4. Eject the DMG
5. Open VibeCode from Applications
6. On first launch, right-click and select "Open" to bypass Gatekeeper

#### Option 2: App Bundle
1. Download `VibeCode.app.tar.gz` from the Releases page
2. Extract the archive: `tar -xzf VibeCode.app.tar.gz`
3. Move `VibeCode.app` to your Applications folder
4. Right-click and select "Open" (first time only)

### Linux

#### Debian/Ubuntu (.deb)
```bash
wget https://github.com/ryanmaclean/vibecode-webgui/releases/download/v1.1.0/vibecode_1.1.0_amd64.deb
sudo dpkg -i vibecode_1.1.0_amd64.deb
sudo apt-get install -f  # Install dependencies if needed
```

#### Fedora/RHEL (.rpm)
```bash
wget https://github.com/ryanmaclean/vibecode-webgui/releases/download/v1.1.0/vibecode-1.1.0-1.x86_64.rpm
sudo rpm -i vibecode-1.1.0-1.x86_64.rpm
```

#### AppImage (Universal)
```bash
wget https://github.com/ryanmaclean/vibecode-webgui/releases/download/v1.1.0/vibecode_1.1.0_amd64.AppImage
chmod +x vibecode_1.1.0_amd64.AppImage
./vibecode_1.1.0_amd64.AppImage
```

### Windows

#### MSI Installer (Recommended)
1. Download `VibeCode_1.1.0_x64.msi` from the Releases page
2. Double-click to run the installer
3. Follow the installation wizard
4. Launch from Start Menu

#### Portable Executable
1. Download `VibeCode_1.1.0_x64.exe` from the Releases page
2. Run the executable directly (no installation required)

## System Requirements

### macOS
- **Operating System:** macOS 13.0 (Ventura) or later
- **Architectures:** Apple Silicon (M1/M2/M3/M4) or Intel (x86_64)
- **RAM:** 4GB minimum, 8GB recommended
- **Disk Space:** 1GB for application, additional space for VMs (10-50GB per VM)
- **For VM Features:** macOS 13.0+ required for Virtualization Framework

### Linux
- **Operating System:** Ubuntu 20.04+, Debian 11+, Fedora 35+, or equivalent
- **Architectures:** x86_64 or ARM64
- **RAM:** 4GB minimum, 8GB recommended
- **Disk Space:** 1GB for application
- **Libraries:** GTK 3.24+, WebKit2GTK 4.1+

### Windows
- **Operating System:** Windows 10 (build 1809) or Windows 11
- **Architecture:** x86_64
- **RAM:** 4GB minimum, 8GB recommended
- **Disk Space:** 1GB for application
- **Runtime:** WebView2 (automatically installed if missing)

### Network Requirements
- **Internet Connection:** Required for AI model access and package downloads
- **Ports:** Default 3000 for web interface, 9090 for Prometheus metrics (configurable)

## Quick Start

### First Launch

1. **Launch VibeCode** from your Applications folder (macOS), Start Menu (Windows), or application launcher (Linux)
2. **Initial Configuration** - On first launch, VibeCode will:
   - Create configuration directories in `~/.vibecode`
   - Initialize default settings
   - Check for required dependencies
3. **Access the Interface** - The application opens with the main editor window
4. **Optional: Configure AI Providers**
   - Navigate to Settings > AI Providers
   - Add API keys for OpenAI, Anthropic, or other providers
   - Or use the built-in OpenRouter integration (321+ models)

### Basic Workflow

1. **Create or Open a Project**
   - File > Open Folder to open an existing project
   - File > New Project to create from templates

2. **Start Coding with AI Assistance**
   - Monaco editor provides syntax highlighting and IntelliSense
   - Use Monacopilot for AI-powered code completion
   - Access AI chat via the sidebar for code review and refactoring

3. **Manage VMs (macOS only)**
   - VM menu shows available VM images
   - Click to start/stop VMs
   - Configure auto-start in Preferences > VMs

4. **Monitor Performance**
   - View real-time metrics in the monitoring dashboard
   - Optional Datadog integration for production monitoring

## Features

### Development Environment

#### Code Editor
- **Monaco Editor** - Same editor core as VS Code
- **IntelliSense** - Intelligent code completion
- **Syntax Highlighting** - 50+ languages supported
- **Multi-File Editing** - Tabs and split views
- **Find & Replace** - Advanced search with regex support
- **Command Palette** - Keyboard-driven workflow (Cmd/Ctrl+Shift+P)

#### AI Features
- **Code Completion** - Monacopilot AI suggestions as you type
- **Code Review** - AI-powered code analysis and suggestions
- **Refactoring Assistance** - Intelligent code transformation
- **Documentation Generation** - Automatic docstring creation
- **Bug Detection** - AI-powered static analysis

#### Version Control
- **Git Integration** - Built-in Git operations
- **Visual Diff** - Side-by-side file comparison
- **Commit History** - Browse and search commits
- **Branch Management** - Create, switch, and merge branches

### VM Management (macOS)

#### Virtualization
- **Apple Virtualization Framework** - Native macOS VM support
- **Lima Integration** - Lightweight Linux VMs
- **vfkit Support** - Fast VM provisioning
- **Auto-Discovery** - Automatic VM image detection
- **Auto-Start** - Configure VMs to start with application

#### Pre-configured VMs
- **PostgreSQL** - Database development
- **Valkey/Redis** - Caching and pub/sub
- **Node.js** - JavaScript/TypeScript development
- **code-server** - Browser-based VS Code
- **pgvector** - Vector database for AI embeddings
- **Full IDE** - Complete development environment

### Observability (Optional)

#### Datadog Integration
- **APM Tracing** - Distributed request tracing
- **Metrics Collection** - Custom application metrics
- **Log Aggregation** - Centralized log management
- **Dashboards** - Pre-configured visualizations
- **Alerting** - Threshold-based alerts

#### OpenTelemetry
- **Traces** - OpenTelemetry Protocol (OTLP) export
- **Metrics** - Prometheus-compatible metrics on :9090
- **Context Propagation** - Distributed trace correlation
- **Multiple Backends** - Jaeger, Zipkin, Datadog support

### Security

#### API Key Management
- **Secure Storage** - Platform keychain integration (macOS Keychain, Windows Credential Manager, Linux Secret Service)
- **Environment Variables** - Support for `.env` configuration
- **Key Rotation** - Easy API key updates
- **Multi-Provider** - Manage keys for multiple AI providers

#### Content Security
- **CSP Headers** - Strict Content Security Policy
- **Domain Allowlisting** - Controlled external connections
- **Sandboxing** - Tauri security sandbox for web content
- **No Telemetry** - Privacy-first design (NEXT_TELEMETRY_DISABLED=1)

## Configuration

### Configuration Files

VibeCode stores configuration in:
- **macOS:** `~/Library/Application Support/com.vibecode.app/`
- **Linux:** `~/.config/vibecode/`
- **Windows:** `%APPDATA%\com.vibecode.app\`

### Environment Variables

Create a `.env` file in the application directory or set system environment variables:

```bash
# AI Provider Configuration
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
OPENROUTER_API_KEY=sk-or-v1-...

# Datadog (Optional)
DD_API_KEY=...
DD_SITE=datadoghq.com

# Application Settings
NEXT_TELEMETRY_DISABLED=1
NODE_ENV=production
```

### Customization

#### Editor Settings
- Font size, family, and line height
- Color themes (light/dark)
- Keyboard shortcuts
- Auto-save configuration

#### AI Settings
- Default AI provider
- Model selection per task type
- Temperature and response length
- Context window size

#### VM Settings (macOS)
- Auto-start VMs
- Memory allocation
- CPU core assignment
- Network configuration

## Known Issues

### macOS Specific
- **Virtualization Framework Requirement** - macOS 13.0+ required for VM features
- **App Sandbox Permissions** - First launch may prompt for file access permissions
- **Gatekeeper Warning** - Right-click + Open required on first launch (unsigned app)

### Cross-Platform
- **WebView2 on Windows** - Automatically downloads if missing (may require restart)
- **Memory Usage** - VMs require 2-8GB RAM each (plan accordingly)
- **First Launch Delay** - Initial configuration may take 10-30 seconds

### Workarounds
- **VM Won't Start (macOS)** - Ensure NVRAM file exists alongside disk image
- **AI Features Not Working** - Check API key configuration in Settings
- **High Memory Usage** - Close unused VMs, reduce VM memory allocation

### Reporting Issues
Please report bugs on our [GitHub Issues](https://github.com/ryanmaclean/vibecode-webgui/issues) page with:
- Operating system and version
- VibeCode version (Help > About)
- Steps to reproduce
- Expected vs actual behavior
- Relevant logs (Help > Show Logs)

## Upgrading from Beta

If you're upgrading from a pre-release version:

1. **Backup Configuration**
   ```bash
   # macOS
   cp -r ~/Library/Application\ Support/com.vibecode.app ~/vibecode-backup

   # Linux
   cp -r ~/.config/vibecode ~/vibecode-backup

   # Windows
   xcopy %APPDATA%\com.vibecode.app %USERPROFILE%\vibecode-backup /E /I
   ```

2. **Uninstall Old Version**
   - macOS: Delete old app from Applications
   - Linux: `sudo apt remove vibecode` or `sudo rpm -e vibecode`
   - Windows: Use Add/Remove Programs

3. **Install v1.0.0** - Follow installation instructions above

4. **Restore Configuration** - Settings should migrate automatically, or restore from backup if needed

## Changelog

### Added
- Native Tauri 2.9.1 desktop application
- Apple Virtualization Framework integration for macOS
- vfkit and Lima VM support
- VM discovery and auto-start functionality
- Datadog agent integration (3 deployment methods)
- OpenTelemetry tracing support
- Monacopilot AI code completion (v1.2.7)
- Monaco Editor 0.53.0 integration
- Multi-AI provider support (OpenAI, Anthropic, Google, Mistral)
- Platform keychain integration for API keys
- Pre-configured Alpine Linux VM images (6 variants)
- Swift 5 + Rust FFI native integration
- Cross-platform builds (macOS, Linux, Windows)

### Changed
- Migrated from Electron to Tauri for native performance
- Switched to OpenVSCode Server backend (no Docker dependency)
- Updated to Next.js 16.0.1 and React 19.1.1
- Upgraded to TypeScript 5.9.3
- Updated 13 dependencies via Dependabot

### Fixed
- VZ disk attachment configuration (synchronizationMode)
- VM startup crashes with proper dispatch queue management
- EFI NVRAM file discovery
- App sandbox permissions for VM access
- SwiftUI state management for VM list updates
- Removed VM binaries from git repository

### Security
- Platform-native API key storage (macOS Keychain, etc.)
- Strict Content Security Policy
- Sandboxed web content rendering
- No telemetry tracking (privacy-first)

## Roadmap

### Upcoming in v1.2.0
- **Windows VM Support** - Hyper-V and WSL2 integration
- **Linux VM Providers** - KVM/QEMU native support
- **Enhanced Monitoring** - More Datadog dashboard templates
- **Extension Marketplace** - VS Code extension compatibility
- **Cloud Sync** - Settings sync across devices

### Future Releases
- **Collaborative Editing** - Real-time multi-user editing
- **Container Management** - Docker/Podman integration
- **Kubernetes Integration** - Deploy to K8s clusters
- **Mobile Companion App** - iOS/Android code review
- **Self-Hosted AI** - Local LLM support (Ollama integration)

## Support & Community

### Documentation
- **User Guide:** [USER_GUIDE.md](./USER_GUIDE.md)
- **Quick Start:** [docs/QUICKSTART.md](./docs/QUICKSTART.md)
- **Desktop Build:** [docs/DESKTOP_BUILD_GUIDE.md](./docs/DESKTOP_BUILD_GUIDE.md)
- **Architecture:** [README.md](./README.md)

### Getting Help
- **GitHub Discussions:** [Ask questions and share feedback](https://github.com/ryanmaclean/vibecode-webgui/discussions)
- **GitHub Issues:** [Report bugs](https://github.com/ryanmaclean/vibecode-webgui/issues)
- **Documentation:** [Full documentation](https://github.com/ryanmaclean/vibecode-webgui/tree/main/docs)

### Contributing
We welcome contributions! See [docs/contributing.md](./docs/src/content/docs/contributing.md) for:
- Code contribution guidelines
- Development environment setup
- Testing requirements
- Pull request process

## Acknowledgments

VibeCode is built on the shoulders of giants. We're grateful to these open-source projects:

### Core Technologies
- **Tauri** (2.9.1) - Native desktop framework
- **Next.js** (16.0.1) - React framework
- **React** (19.1.1) - UI library
- **Monaco Editor** (0.53.0) - Code editor
- **TypeScript** (5.9.3) - Type-safe JavaScript

### AI & ML
- **OpenAI** - GPT-4 and other models
- **Anthropic** - Claude models
- **OpenRouter** - Multi-model API gateway
- **Monacopilot** (1.2.7) - AI code completion

### Infrastructure
- **Swift** (5.9+) - macOS native integration
- **Rust** - Tauri backend and performance-critical code
- **Apple Virtualization Framework** - macOS VM support
- **vfkit** - Lightweight VM management

### Monitoring & Observability
- **Datadog** - APM and monitoring
- **OpenTelemetry** - Distributed tracing
- **Prometheus** - Metrics collection

### Development Tools
- **ESLint** - Code quality
- **Jest** - Testing framework
- **Playwright** - E2E testing
- **Babel** - JavaScript transpilation

## License

VibeCode is licensed under the **MIT License**.

See [LICENSE](./LICENSE) file for full text.

---

**Full Changelog**: https://github.com/ryanmaclean/vibecode-webgui/commits/v1.1.0

Generated with [Claude Code](https://claude.com/claude-code)
