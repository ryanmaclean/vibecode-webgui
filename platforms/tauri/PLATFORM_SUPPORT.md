# Platform Support - VibeCode Desktop

## Current Support Status

### ✅ Supported Platforms

- **macOS Apple Silicon (ARM64)** - aarch64-apple-darwin
  - Apple M1, M2, M3 processors
  - macOS 13.0 (Ventura) or later
  - Full functionality with vibecode-vm sidecar

### ❌ Unsupported Platforms

- **macOS Intel (x86_64)** - x86_64-apple-darwin
  - Missing: `vibecode-vm-x86_64-apple-darwin` sidecar binary
  - Reason: vibecode-vm sidecar not compiled for Intel architecture

- **Universal Binary** - universal-apple-darwin
  - Blocked by: Missing x86_64 sidecar binary
  - Requires: Both aarch64 and x86_64 binaries available

- **Windows** - Not currently implemented
- **Linux** - Not currently implemented

---

## Technical Details

### Sidecar Binary Dependency

VibeCode Desktop depends on the `vibecode-vm` sidecar binary for container management and VM operations. Tauri automatically selects the appropriate architecture-specific binary at build time using the pattern:

```text
binaries/vibecode-vm-{target-triple}
```

**Current binaries:**
- ✅ `binaries/vibecode-vm-aarch64-apple-darwin` (77 KB) - Available
- ❌ `binaries/vibecode-vm-x86_64-apple-darwin` - **Missing**

**Tauri Configuration:**
```json
{
  "bundle": {
    "externalBin": [
      "binaries/vibecode-vm"
    ]
  }
}
```

This configuration automatically resolves to architecture-specific binaries. See [Tauri v2 Sidecar Documentation](https://v2.tauri.app/develop/sidecar/) for details.

### Build Configuration

The GitHub Actions workflow (`.github/workflows/tauri-release.yml`) builds only for ARM64:

```bash
npx tauri build --target aarch64-apple-darwin
```

To support Intel Macs, the workflow would need to build for both targets:

```bash
npx tauri build --target aarch64-apple-darwin
npx tauri build --target x86_64-apple-darwin
# Or build universal binary:
npx tauri build --target universal-apple-darwin
```

---

## Adding Intel Mac (x86_64) Support

To enable Intel Mac support, follow these steps:

### 1. Compile vibecode-vm for x86_64

The vibecode-vm binary needs to be compiled for Intel architecture. This requires:

**Prerequisites:**
- Rust toolchain with x86_64-apple-darwin target
- Access to vibecode-vm source code
- Either: native Intel Mac, or cross-compilation setup on ARM64

**Build Steps:**

```bash
# Add x86_64 target to Rust toolchain
rustup target add x86_64-apple-darwin

# Build vibecode-vm for x86_64
# (exact commands depend on vibecode-vm project structure)
cd <vibecode-vm-source>
cargo build --release --target x86_64-apple-darwin

# Copy binary to Tauri binaries directory
cp target/x86_64-apple-darwin/release/vibecode-vm \
   platforms/tauri/binaries/vibecode-vm-x86_64-apple-darwin
```

### 2. Update Build Workflow

Once the x86_64 binary is available, update `.github/workflows/tauri-release.yml`:

**Option A: Build Universal Binary (Recommended)**

```yaml
- name: Build Tauri app (Universal Binary)
  working-directory: platforms/tauri
  run: |
    echo "Building universal binary for ARM64 + Intel..."
    npx tauri build --target universal-apple-darwin
```

**Option B: Build Separate Binaries**

```yaml
- name: Build Tauri app (ARM64 + Intel)
  working-directory: platforms/tauri
  run: |
    echo "Building for ARM64..."
    npx tauri build --target aarch64-apple-darwin

    echo "Building for Intel x86_64..."
    npx tauri build --target x86_64-apple-darwin
```

### 3. Update Documentation

Remove ARM64-only warnings from:
- `platforms/tauri/README.md`
- This file (`PLATFORM_SUPPORT.md`)
- Workflow comments

### 4. Test on Intel Hardware

Verify the app works correctly on Intel Macs:
- Install and launch the app
- Test vibecode-vm functionality
- Verify container management works
- Check for performance issues

---

## Why ARM64-Only Currently?

The vibecode-vm sidecar binary is only available for ARM64 because:

1. **Development Environment**: Primary development on Apple Silicon Macs
2. **Swift VM Manager**: The VM manager may have been compiled only for ARM64
3. **Priority**: ARM64 is the current Apple architecture (all new Macs since 2020)
4. **Resource Constraints**: Cross-compilation or Intel testing environment not available

Intel Macs released before 2020 can still use VibeCode via:
- Docker Desktop (web version)
- Browser-based deployment
- Remote development server

---

## Related Resources

- [Tauri v2 Documentation](https://v2.tauri.app/)
- [Tauri Sidecar Binaries Guide](https://v2.tauri.app/develop/sidecar/)
- [Rust Cross-Compilation](https://rust-lang.github.io/rustup/cross-compilation.html)
- [macOS Universal Binaries](https://developer.apple.com/documentation/apple-silicon/building-a-universal-macos-binary)

---

## Questions?

If you need Intel Mac support for your deployment:

1. Check if vibecode-vm source code is available
2. Set up x86_64 build environment
3. Compile and test x86_64 binary
4. Follow steps above to enable multi-architecture builds

For assistance, see project documentation or contact the development team.
