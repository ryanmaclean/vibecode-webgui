# VibeCode Build Guide

Complete guide for building the VibeCode application.

## Quick Start

```bash
./scripts/build-complete.sh
```

This single command builds:
1. Swift VM Manager
2. Next.js Frontend (if needed)
3. Tauri Desktop App

## Prerequisites

Before building, ensure you have:

- **Swift** (5.9+): For VM manager
- **Rust/Cargo**: For Tauri app
- **Bun or npm**: For frontend (optional, only if frontend needs building)
- **Xcode Command Line Tools**: For macOS development

Check if prerequisites are installed:
```bash
swift --version
cargo --version
bun --version  # or npm --version
```

## Build Process

### Step 1: Swift VM Manager

The build script compiles the Swift VM manager:

```bash
cd VibeCodeSwift
swift build -c release
codesign --force --sign - --entitlements VibeCode.entitlements .build/release/VibeCode
```

**Output**: `VibeCodeSwift/.build/release/VibeCode`

### Step 2: Frontend (Conditional)

If the Tauri app needs a frontend build and `frontendDist` directory doesn't exist, the script will:

```bash
bun run build:tauri  # or npm run build:tauri
```

**Output**: `public/` directory (or configured `frontendDist`)

### Step 3: Tauri App

The script builds the Tauri desktop application:

```bash
cd src-tauri
cargo tauri build
```

**Output**: 
- macOS: `src-tauri/target/release/bundle/macos/VibeCode.app`
- DMG: `src-tauri/target/release/bundle/macos/VibeCode.dmg`

## Build Script Details

### `scripts/build-complete.sh`

A comprehensive build script that:

- ✅ Checks all prerequisites
- ✅ Builds Swift VM manager
- ✅ Conditionally builds frontend
- ✅ Builds Tauri app
- ✅ Shows output locations
- ✅ Provides clear error messages

**Usage**:
```bash
./scripts/build-complete.sh
```

**What it does**:
1. Validates prerequisites (Swift, Cargo, Bun/npm)
2. Builds Swift VM manager in release mode
3. Signs Swift binary (development signing)
4. Checks if frontend needs building
5. Builds frontend if needed
6. Copies VM manager binary to Tauri binaries directory
7. Builds Tauri app
8. Shows output file locations

## Alternative Build Scripts

### Swift Only
```bash
./scripts/build-vibecode.sh
```
Builds only the Swift VM manager.

### Tauri with VMs
```bash
./scripts/build-tauri-with-vms.sh
```
Builds Tauri app (assumes VM manager already built).

## Output Locations

After a successful build:

**Swift VM Manager**:
```
VibeCodeSwift/.build/release/VibeCode
```

**Tauri App Bundle** (macOS):
```
src-tauri/target/release/bundle/macos/VibeCode.app
src-tauri/target/release/bundle/macos/VibeCode.dmg
```

## Testing the Build

### Test Swift VM Manager
```bash
./VibeCodeSwift/.build/release/VibeCode
```

### Test Tauri App
```bash
open src-tauri/target/release/bundle/macos/VibeCode.app
```

## Troubleshooting

### Build Fails: Missing Prerequisites
**Error**: `Swift not found` or `Cargo not found`

**Solution**: Install missing tools:
- Swift: Install Xcode Command Line Tools
- Rust: Install from [rustup.rs](https://rustup.rs)
- Bun: Install from [bun.sh](https://bun.sh)

### Build Fails: Code Signing Error
**Error**: `codesign failed`

**Solution**: This is expected in development. The script will continue with a warning. For production builds, configure proper code signing certificates.

### Build Fails: Frontend Build Error
**Error**: Frontend build fails

**Solution**: 
- Check `package.json` exists
- Run `npm install` or `bun install`
- Check `next.config.tauri.js` exists

### Build Fails: Tauri Build Error
**Error**: `cargo tauri build` fails

**Solution**:
- Check Rust is installed: `cargo --version`
- Check Tauri CLI: `cargo install tauri-cli`
- Check `src-tauri/Cargo.toml` exists
- Check `src-tauri/tauri.conf.json` is valid

## Development Builds

For faster development builds:

### Swift Debug Build
```bash
cd VibeCodeSwift
swift build  # Debug mode (faster)
```

### Tauri Dev Mode
```bash
cd src-tauri
cargo tauri dev  # Hot reload development
```

## Production Builds

For production releases:

1. Use `build-complete.sh` (builds in release mode)
2. Configure proper code signing certificates
3. Test the app bundle thoroughly
4. Create DMG for distribution

## CI/CD Integration

The build script is designed to work in CI/CD:

```yaml
# Example GitHub Actions
- name: Build VibeCode
  run: ./scripts/build-complete.sh
```

## Next Steps

After building:

1. **Test VM Management**: Verify VM start/stop works
2. **Test Services**: Check PostgreSQL, Valkey, Node.js connectivity
3. **Test UI**: Verify Tauri app UI functions correctly
4. **Deploy**: Distribute the app bundle or DMG

## Related Documentation

- [VM Management Guide](VM_MANAGEMENT.md)
- [Tauri Integration](tauri/TAURI_COMMANDS.md)
- [Development Setup](DEVELOPMENT.md)


