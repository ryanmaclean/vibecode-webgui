# VibeCode v0.9-beta

Native macOS VM Management with Apple Virtualization.framework

## 🎯 What's Included

- ✅ Native Swift 5 + SwiftUI macOS application  
- ✅ Apple Virtualization.framework integration
- ✅ 6 Alpine Linux VMs with UEFI boot
- ✅ 2/6 VMs fully working (Pgvector, Ide)
- ✅ Automated testing (27/33 tests passing - 82%)
- ✅ Datadog observability integration
- ✅ Complete documentation

## 📦 Installation

### Build from Source

```bash
git clone https://github.com/ryanmaclean/vibecode-webgui.git
cd vibecode-webgui
./scripts/launch-vibecode.sh
```

See [BUILD.md](docs/releases/v0.9-beta/BUILD.md) for detailed instructions.

## 📊 Status

- **Feature Completion**: 86%
- **Test Coverage**: 27/33 (82%)
- **VMs Working**: 2/6 (33%)
- **Infrastructure**: 100%

## 🐛 Known Issues

- 4/6 VMs need bootloader configuration
- Services not installed (PostgreSQL, Valkey, Node.js, VSCode)
- Tauri integration pending

## 📖 Documentation

- [README](docs/releases/v0.9-beta/README.md) - Overview
- [BUILD](docs/releases/v0.9-beta/BUILD.md) - Build guide
- [USAGE](docs/releases/v0.9-beta/USAGE.md) - Usage instructions
- [VMS_WORKING_STATUS](VMS_WORKING_STATUS.md) - Complete status

## 🗺️ Roadmap to v1.0

- Fix bootloader for all VMs
- Install services
- SSH access
- 100% test coverage

## ⚠️ Requirements

- macOS 15+ (Sequoia or later)
- Bare metal (no nested virtualization)
- 16GB RAM minimum

---

**No pre-built binaries provided** - Build from source for your system.
