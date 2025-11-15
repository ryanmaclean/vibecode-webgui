# VibeCode Release Build Scripts

This directory contains Python scripts for building and packaging VibeCode releases with full Datadog tracing integration.

## Scripts

### 1. `package_workspace_rag.py`

Packages the Workspace RAG extension as a `.vsix` file for distribution.

**Usage:**

```bash
# Interactive menu (recommended)
./package_workspace_rag.py

# Command line with arguments
./package_workspace_rag.py package                  # Package with tests
./package_workspace_rag.py package --skip-tests     # Package without tests
./package_workspace_rag.py check                    # Check prerequisites only
```

**Options:**
- `package` - Package the extension
- `check` - Check prerequisites only
- `--skip-tests` - Skip running tests during packaging
- `--project-root PATH` - Specify project root (auto-detected if not provided)

**Features:**
- Full Datadog tracing integration
- Automatic checksum generation (SHA256, SHA512)
- Interactive menu when run without arguments
- Prerequisites validation

### 2. `install_extensions_to_vm.py`

Installs packaged extensions to VM resources for pre-installation in VM images.

**Usage:**

```bash
# Interactive menu (recommended)
./install_extensions_to_vm.py

# Command line with arguments
./install_extensions_to_vm.py install               # Install extensions to VM
./install_extensions_to_vm.py view                  # View current manifest
```

**Options:**
- `install` - Copy extensions to VM resources and create installer scripts
- `view` - Display current extension manifest
- `--project-root PATH` - Specify project root (auto-detected if not provided)

**Features:**
- Creates systemd service for auto-installation on first boot
- Generates manifest with checksums
- Interactive menu interface
- Full Datadog tracing

### 3. `build_macos_release.py`

Complete macOS release builder that orchestrates the entire build process.

**Usage:**

```bash
# Interactive menu (recommended)
./build_macos_release.py

# Command line with arguments
./build_macos_release.py --build-type release       # Release build with DMG
./build_macos_release.py --build-type debug         # Debug build
./build_macos_release.py --no-dmg                   # Skip DMG creation
./build_macos_release.py --skip-tests               # Skip tests
./build_macos_release.py --check-only               # Check prerequisites only
```

**Options:**
- `--build-type {release,debug}` - Build type (default: release)
- `--no-dmg` - Skip DMG creation
- `--skip-tests` - Skip running tests
- `--check-only` - Only check prerequisites
- `--project-root PATH` - Specify project root (auto-detected if not provided)

**Build Steps:**
1. Check prerequisites (Node.js, npm, Rust, Swift, etc.)
2. Package Workspace RAG extension
3. Install extensions to VM resources
4. Build VM manager (Swift)
5. Build Tauri application (universal binary)
6. Create distribution artifacts (DMG, tarball)
7. Generate checksums
8. Create release documentation

**Features:**
- Full Datadog tracing for entire build pipeline
- Universal binary (Intel + Apple Silicon)
- Interactive menu with 6 options
- Automatic artifact generation
- Comprehensive error handling

## Prerequisites

### Required Tools

- **Python 3.8+**
- **Node.js 18+** and npm
- **Rust** (with rustup)
- **Swift** (Xcode Command Line Tools)
- **jq** (for JSON processing)

### Python Dependencies

```bash
pip install ddtrace
```

### macOS Tools

```bash
# Install via Homebrew
brew install jq

# Xcode Command Line Tools (for Swift)
xcode-select --install
```

## Datadog Integration

All scripts support full Datadog tracing when `ddtrace` is installed.

### Environment Variables

Set these environment variables to configure Datadog agent connection:

```bash
export DD_AGENT_HOST=localhost
export DD_TRACE_AGENT_PORT=8126
export DD_API_KEY=your_api_key_here
```

### Trace Tags

Scripts automatically tag traces with:
- `service` - Service name (extension-packager, vm-extension-installer, macos-release-builder)
- `command` - Commands being executed
- `build_type` - Build type (release/debug)
- `version` - Application version
- `exit_code` - Command exit codes
- File paths, sizes, and checksums
- Error messages and stack traces

### Viewing Traces

View traces in Datadog APM:
1. Go to APM > Traces
2. Filter by service:
   - `extension-packager`
   - `vm-extension-installer`
   - `macos-release-builder`
3. View detailed execution timeline and performance metrics

## Interactive Menus

All scripts provide interactive ncurses-style menus when run without arguments:

### Extension Packager Menu
```
╔════════════════════════════════════════════╗
║   Workspace RAG Extension Packager        ║
╚════════════════════════════════════════════╝

Select an option:
  1) Package extension (with tests)
  2) Package extension (skip tests)
  3) Check prerequisites only
  4) Exit
```

### VM Extension Installer Menu
```
╔════════════════════════════════════════════╗
║   VM Extension Installer                  ║
╚════════════════════════════════════════════╝

Select an option:
  1) Install extensions to VM resources
  2) View current manifest
  3) Exit
```

### Release Builder Menu
```
╔════════════════════════════════════════════╗
║   VibeCode macOS Release Builder          ║
╚════════════════════════════════════════════╝

Select build configuration:
  1) Full release build (with DMG)
  2) Release build (no DMG)
  3) Debug build
  4) Quick build (skip tests)
  5) Check prerequisites only
  6) Exit
```

## Complete Build Workflow

To create a full release:

```bash
# 1. Package the extension
cd scripts/release
./package_workspace_rag.py package

# 2. Install to VM resources
./install_extensions_to_vm.py install

# 3. Build the complete release
./build_macos_release.py
# Select option 1 for full release build

# Or as a one-liner (non-interactive)
./build_macos_release.py --build-type release
```

## Output

### Package Extension
- `dist/extensions/workspace-rag-*.vsix` - Extension package
- `dist/extensions/workspace-rag-*.vsix.sha256` - SHA256 checksum
- `dist/extensions/workspace-rag-*.vsix.sha512` - SHA512 checksum

### VM Extension Installation
- `src-tauri/resources/extensions/*.vsix` - Extension packages
- `src-tauri/resources/extensions/install-extensions.sh` - Installer script
- `src-tauri/resources/extensions/vscode-extensions-installer.service` - Systemd service
- `src-tauri/resources/extensions/manifest.json` - Extension manifest

### macOS Release
- `dist/releases/macos/VibeCode-{version}-macOS-universal.dmg` - DMG installer
- `dist/releases/macos/VibeCode-{version}-macOS-universal.app.tar.gz` - App bundle archive
- `dist/releases/macos/*.sha256` - SHA256 checksums
- `dist/releases/macos/*.sha512` - SHA512 checksums
- `dist/releases/macos/RELEASE_NOTES.md` - Release documentation
- `dist/releases/macos/BUILD_MANIFEST.json` - Build metadata

## Troubleshooting

### Missing ddtrace

If you see "WARNING: ddtrace not installed", install it:

```bash
pip install ddtrace
```

Scripts will work without it but won't provide tracing.

### Permission Denied

Make scripts executable:

```bash
chmod +x scripts/release/*.py
```

### Build Failures

Check prerequisites first:

```bash
./build_macos_release.py --check-only
```

### VM Manager Build Fails

Ensure Xcode Command Line Tools are installed:

```bash
xcode-select --install
swift --version
```

## CI/CD Integration

These scripts can be integrated into CI/CD pipelines:

```yaml
# GitHub Actions example
- name: Build macOS Release
  env:
    DD_AGENT_HOST: ${{ secrets.DD_AGENT_HOST }}
    DD_API_KEY: ${{ secrets.DD_API_KEY }}
  run: |
    pip install ddtrace
    ./scripts/release/build_macos_release.py \
      --build-type release \
      --skip-tests
```

## Support

For issues or questions:
- Check script output for error messages
- Review Datadog traces for detailed execution logs
- Ensure all prerequisites are installed
- Run with `--check-only` to validate environment

## License

MIT License - See LICENSE file for details

