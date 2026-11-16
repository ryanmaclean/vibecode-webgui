# Contributing to VibeCode VM

Thank you for your interest in contributing to VibeCode VM! This document provides guidelines and instructions for contributing.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Building from Source](#building-from-source)
- [Customizing the VM](#customizing-the-vm)
- [Testing](#testing)
- [Submitting Changes](#submitting-changes)
- [Documentation](#documentation)
- [Release Process](#release-process)

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to the project maintainers.

### Our Standards

- Be respectful and inclusive
- Welcome newcomers and help them learn
- Focus on constructive feedback
- Prioritize the community's best interests
- Show empathy toward others

## Getting Started

### Ways to Contribute

- **Report bugs**: Open an issue with details and reproduction steps
- **Suggest features**: Propose new features or improvements
- **Write documentation**: Improve or add documentation
- **Fix bugs**: Submit pull requests for known issues
- **Add features**: Implement new functionality
- **Optimize**: Improve performance, reduce size, or enhance efficiency

### Before You Start

1. Check [existing issues](https://github.com/yourusername/vibecode-vm/issues) to avoid duplicates
2. For major changes, open an issue first to discuss your approach
3. Read this guide completely
4. Set up your development environment

## Development Setup

### Prerequisites

You'll need:

- **macOS**: 12.0 (Monterey) or later with Apple Silicon
- **vfkit**: v0.6.1 or later
- **Development tools**:
  - Xcode Command Line Tools: `xcode-select --install`
  - Homebrew (recommended): `/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"`
  - Docker (optional, for building some components)
  - wget or curl
  - Python 3.8+

### Clone the Repository

```bash
git clone https://github.com/yourusername/vibecode-vm.git
cd vibecode-vm
```

### Understanding the Project Structure

```
vibecode-vm/
├── azure/                          # Build scripts and VM components
│   ├── build-unified-services-with-datadog.sh  # Main build script
│   ├── linux-kernel-arm64          # Linux kernel binary
│   ├── unified-services-static.cpio.gz         # VM image (compressed)
│   └── test-*.sh                   # Test scripts
├── docs/                           # Documentation
├── scripts/                        # Utility scripts
├── README.md                       # User-facing documentation
├── INSTALL.md                      # Installation guide
├── CONTRIBUTING.md                 # This file
└── LICENSE                         # MIT License
```

## Building from Source

### Quick Build

The simplest way to build the VM:

```bash
cd azure
./build-unified-services-with-datadog.sh
```

This creates `unified-services-static.cpio.gz` (approximately 90MB compressed).

Build time: 15-30 minutes depending on your system and network speed.

### Build Options

```bash
# Fast build (minimal services)
./build-unified-services-with-datadog.sh --fast

# With VS Code extensions
./build-unified-services-with-datadog.sh --with-extensions
```

## Customizing the VM

### Modifying the Init Script

The init script controls VM boot and service startup:

1. Extract the initramfs:
```bash
mkdir /tmp/vm-work
cd /tmp/vm-work
gunzip -c unified-services-static.cpio.gz | cpio -idm
```

2. Edit the init script:
```bash
vim init
```

3. Rebuild:
```bash
find . | cpio -o -H newc | gzip -9 > ../custom-vm.cpio.gz
```

## Testing

### Manual Testing

1. Build the VM
2. Launch with vfkit
3. Verify all services work

### Automated Testing

Run the test suite:

```bash
# Boot time test
./AGENT-Q-TIME-TO-EDITOR-TEST.sh

# Volume mounting test
cd azure
./test-volume-mounting.sh
```

## Submitting Changes

### Pull Request Process

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/your-feature`
3. **Make your changes** and test thoroughly
4. **Commit**: Use conventional commits (`feat:`, `fix:`, `docs:`, etc.)
5. **Push**: `git push origin feature/your-feature`
6. **Open a Pull Request** with a clear description

## Documentation

### Writing Documentation

Good documentation:
- Is clear and concise
- Includes examples
- Uses proper markdown formatting
- Targets the appropriate audience

### Documentation Style

- Use active voice
- Include code examples
- Add screenshots where helpful
- Use clear headings and structure

## Release Process

We use [Semantic Versioning](https://semver.org/):
- MAJOR.MINOR.PATCH (e.g., 1.0.0)
- MAJOR: Breaking changes
- MINOR: New features (backward compatible)
- PATCH: Bug fixes

## Getting Help

- **Questions**: Use [GitHub Discussions](https://github.com/yourusername/vibecode-vm/discussions)
- **Bugs**: Open an [issue](https://github.com/yourusername/vibecode-vm/issues)
- **Security**: Email security issues to maintainers

## Recognition

Contributors will be:
- Listed in the project README
- Credited in release notes
- Thanked in the community

## Additional Resources

- [vfkit documentation](https://github.com/crc-org/vfkit)
- [BusyBox documentation](https://busybox.net/downloads/BusyBox.html)
- [Linux kernel documentation](https://www.kernel.org/doc/html/latest/)

---

**Thank you for contributing to VibeCode VM!**

