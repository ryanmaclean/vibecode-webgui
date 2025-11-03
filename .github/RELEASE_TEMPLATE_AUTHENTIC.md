# VibeCode v0.9-beta

A native macOS VM manager built with Swift and Apple's Virtualization framework.

## Current State

**Honest assessment**: This is early beta. The infrastructure works well, but only 2 of 6 VMs boot successfully, and services aren't installed yet.

### What Works

- Native Swift app for managing VMs
- 2 VMs (Pgvector and Ide) boot and run
- Good automated test suite (27 of 33 tests passing)
- Network infrastructure functional
- Comprehensive documentation

### What Doesn't Work Yet

- 4 VMs have bootloader configuration issues
- No services installed (PostgreSQL, Valkey, Node.js, OpenVSCode aren't available)
- Can't actually use the VMs for development yet
- Tauri integration incomplete

## Should You Use This?

**If you want to**:
- Explore native macOS virtualization
- Learn about Apple's Virtualization framework
- Contribute to VM management tools
- Help debug bootloader issues

**Don't use if you need**:
- Working PostgreSQL/Valkey/Node.js right now
- Production-ready services
- Guaranteed stability

## Installation

```bash
git clone https://github.com/ryanmaclean/vibecode-webgui.git
cd vibecode-webgui
./scripts/launch-vibecode.sh
```

See [BUILD.md](docs/releases/v0.9-beta/BUILD.md) for details.

## Known Issues

The main problems we're aware of:

1. **Bootloader errors** - 4 of 6 VMs won't boot due to EFI configuration
2. **Missing services** - VMs boot but have no applications installed
3. **Limited testing** - Haven't validated actual service usage

Workarounds and fixes are in the docs, but honestly, this is still rough around the edges.

## Requirements

- macOS 15 or later (Sequoia)
- Physical Mac (nested virtualization isn't supported by Apple)
- 16GB RAM (32GB better if running multiple VMs)
- Patience with beta software

## What's Next

We're working on v1.0 with:
- All VMs booting reliably
- Services actually installed
- Full functionality testing

No timeline promises - we'll release it when it's ready.

## Documentation

- [Build Guide](docs/releases/v0.9-beta/BUILD.md) - How to build from source
- [Usage](docs/releases/v0.9-beta/USAGE.md) - What works and how to use it
- [Full Notes](docs/releases/v0.9-beta/RELEASE_NOTES.md) - Complete details
- [Status](VMS_WORKING_STATUS.md) - Honest assessment of current state

## Contributing

We'd appreciate help with:
- Fixing the bootloader issues (main blocker)
- Testing on different Mac configurations
- Improving documentation
- Adding service installation automation

See CONTRIBUTING.md if interested.

## Architecture Note

This uses the same approach as Podman (Apple Virtualization framework, UEFI boot, VirtIO devices) but with native Swift instead of Electron. The architecture is sound - we just need to finish the implementation.

---

**This is beta software.** It's incomplete but the foundation is solid. Use at your own risk, and contributions are welcome.

