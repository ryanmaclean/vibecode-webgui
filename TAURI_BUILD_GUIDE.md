# VibeCode Tauri Desktop MVP - Build Guide

## Overview

This guide documents the complete process for building the VibeCode desktop application using Tauri on macOS Apple Silicon (arm64).

## Build Status

- **Platform**: macOS Apple Silicon (arm64)
- **Bundle Size**: 5.8 MB (61% under 15 MB target)
- **Build Date**: October 27, 2025
- **Status**: Working MVP

## Prerequisites

### Required Tools

1. **Rust** (1.85.0 or later)
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```

2. **Node.js** (18.18.0 - 24.x)
   ```bash
   brew install node@22
   ```

3. **Tauri CLI**
   ```bash
   npm install -g @tauri-apps/cli@2.9.1
   ```

4. **Xcode Command Line Tools**
   ```bash
   xcode-select --install
   ```

### System Requirements

- macOS 11.0 (Big Sur) or later
- Apple Silicon (M1/M2/M3) or Intel processor
- 2 GB free disk space
- 4 GB RAM minimum

## Build Process

### Step 1: Clone and Setup

```bash
cd /path/to/vibecode-webgui
npm install
```

### Step 2: Fix Compilation Issues

The following fixes were applied for the MVP build:

#### Fix 1: Add Missing Dependencies

Added `once_cell` to `src-tauri/Cargo.toml`:

```toml
[dependencies]
once_cell = "1.21"
```

#### Fix 2: Disable CoreML Integration (Temporary)

The CoreML Swift integration had compilation errors, so it was temporarily disabled:

1. **src-tauri/src/ml/mod.rs**: Commented out coreml module
2. **src-tauri/build.rs**: Disabled Swift library linking
3. **src-tauri/src/ml/commands.rs**: Stubbed ML functions

#### Fix 3: Fix Type Annotation

Fixed ambiguous type in `src-tauri/src/ai/completion.rs`:

```rust
let mut score: f32 = 1.0;  // Added explicit type annotation
```

### Step 3: Build Release Binary

```bash
cd src-tauri
cargo build --release
```

**Build time**: ~2-3 minutes on Apple Silicon
**Binary size**: 5.8 MB
**Location**: `target/release/vibecode`

### Step 4: Create .app Bundle

```bash
cd ..
npm run tauri:build
```

**Bundle location**: `src-tauri/target/release/bundle/macos/VibeCode.app`
**Bundle size**: 5.8 MB

## Bundle Analysis

### Size Breakdown

```
Total: 5.8 MB
├── MacOS/vibecode (binary): 5.8 MB
├── Resources/ (icons, etc.): 8 KB
└── Info.plist: < 1 KB
```

### Optimization Settings

The release build uses aggressive optimization settings in `Cargo.toml`:

```toml
[profile.release]
strip = true           # Remove debug symbols
lto = "thin"          # Link-time optimization
opt-level = "z"       # Optimize for size
codegen-units = 1     # Single codegen unit
panic = "abort"       # Smaller panic implementation
```

## Testing the Build

### Launch the App

```bash
open src-tauri/target/release/bundle/macos/VibeCode.app
```

### Verify Running

```bash
ps aux | grep vibecode
```

### Test Checklist

- [x] App launches without crashing
- [x] Window displays correctly
- [x] UI is responsive
- [x] Bundle size under 15 MB target

## Known Issues and Workarounds

### Issue 1: DMG Creation Fails

**Impact**: DMG installer not created, but .app bundle works fine

**Workaround**: Use the .app directly or create DMG manually

### Issue 2: CoreML/Swift Integration Disabled

**Status**: Temporarily disabled for MVP

**Impact**: ML acceleration features unavailable

## Troubleshooting

### Build Fails with Linker Errors

```bash
cd src-tauri
cargo clean
cargo build --release
```

### App Crashes on Launch

```bash
./src-tauri/target/release/vibecode
```

## Version History

- **v0.1.0** (Oct 27, 2025): Initial MVP build
  - 5.8 MB bundle size
  - CoreML temporarily disabled
  - Basic functionality verified
