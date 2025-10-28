# Code Server Comparison: Native macOS Build

**Context:** Evaluating code-server vs openvscode-server for native macOS build using Swift 5 + Virtualization Framework SDK (no Docker)

**Date:** October 28, 2025

---

## Quick Comparison

| Feature | code-server | openvscode-server | Winner |
|---------|------------|-------------------|---------|
| **Size (shallow)** | 2.3MB | 145MB | code-server |
| **Architecture** | Node.js wrapper | Native Rust CLI + Node | openvscode-server |
| **macOS Support** | Shell scripts | Native Rust + Darwin code | ✅ openvscode-server |
| **Build System** | Shell-based | Gulp + Native compilation | openvscode-server |
| **Rebrand Ease** | Moderate | Moderate | Tie |
| **Maintenance** | Coder Inc. | Gitpod (active) | Both good |

---

## Detailed Analysis

### 1. Native macOS Support

#### code-server
- ❌ No native Rust components found
- ❌ No Swift integration
- ⚠️ Wraps VS Code via Node.js
- ✅ Simple shell-based build system
- 📦 Size: 2.3MB (minimal)

#### openvscode-server ✅ WINNER
- ✅ **Native Rust CLI** with macOS-specific code:
  - `cli/src/tunnels/service_macos.rs` - macOS service integration
  - `cli/src/tunnels/nosleep_macos.rs` - macOS power management
  - `resources/server/bin/code-server-darwin.sh`
  - `resources/darwin/` directory
- ✅ **Azure Pipelines for macOS builds** - proven build path
- ✅ **Darwin-specific browser helpers**
- ✅ Better foundation for Swift 5 integration
- 📦 Size: 145MB (full VS Code fork)

---

### 2. Build System Comparison

#### code-server Build Scripts
```json
"scripts": {
  "build": "./ci/build/build-code-server.sh",
  "build:vscode": "./ci/build/build-vscode.sh",
  "release": "./ci/build/build-release.sh",
  "release:standalone": "./ci/build/build-standalone-release.sh",
  "package": "./ci/build/build-packages.sh",
  "test:native": "./ci/dev/test-native.sh"
}
```
- Shell-based build system
- Wraps existing VS Code
- Simpler to understand
- Less control over native layer

#### openvscode-server Build Scripts ✅ WINNER
```json
"scripts": {
  "compile": "node ./node_modules/gulp/bin/gulp.js compile",
  "compile-check-ts-native": "tsgo --project ./src/tsconfig.json",
  "watch": "npm-run-all -lp watch-client watch-extensions"
}
```
- Gulp-based build system
- Native compilation support (`compile-check-ts-native`)
- Rust CLI built separately (`cli/.cargo/`, `build.rs`)
- More control for native integrations

---

### 3. Swift 5 + Virtualization Framework Integration

#### For code-server
**Challenges:**
- Need to create Swift bridge to Node.js process
- No existing native layer to hook into
- Would require building custom wrapper around code-server

**Approach:**
```swift
// Would need to launch code-server as subprocess
let task = Process()
task.launchPath = "/path/to/code-server"
// Limited native integration
```

#### For openvscode-server ✅ WINNER
**Advantages:**
- Rust CLI can be integrated with Swift via FFI
- Existing macOS-specific code to build upon
- Service layer already designed for native integration

**Approach:**
```swift
// Can interface with Rust CLI directly
import VirtualizationFramework

// Bridge to openvscode-server's Rust CLI
class VibeCodeServer {
    private let rustCLI: OpaquePointer
    private let vmConfig: VZVirtualMachineConfiguration

    func startServer(in vm: VZVirtualMachine) {
        // Native integration with Virtualization Framework
    }
}
```

---

### 4. Rebrand Potential

#### code-server
- ✅ Branding in: `src/node/`, `docs/`, `package.json`
- ✅ Simpler codebase = easier rebrand
- ⚠️ Less control over native features

#### openvscode-server
- ✅ Branding in: `product.json`, `resources/`, `cli/src/`
- ⚠️ Larger codebase = more places to rebrand
- ✅ More control over native features
- ✅ Existing rebrand examples (Gitpod's customizations)

---

### 5. Architecture for Native macOS

#### code-server Architecture
```
┌─────────────────────────────────────┐
│     VibeCode (Swift/Tauri)         │
│                                     │
│  ┌────────────────────────────┐   │
│  │   WebView/WKWebView        │   │
│  └────────────────────────────┘   │
│              ↓                      │
│  ┌────────────────────────────┐   │
│  │   code-server (Node.js)    │   │
│  └────────────────────────────┘   │
│              ↓                      │
│  ┌────────────────────────────┐   │
│  │   VS Code (wrapped)        │   │
│  └────────────────────────────┘   │
└─────────────────────────────────────┘

Limitations:
- No native Rust layer
- Limited Swift integration
- WebView-only rendering (webkit limitation)
```

#### openvscode-server Architecture ✅ WINNER
```
┌─────────────────────────────────────┐
│     VibeCode (Swift 5)             │
│                                     │
│  ┌────────────────────────────┐   │
│  │   Virtualization Framework  │   │
│  │   (Native macOS SDK)        │   │
│  └────────────────────────────┘   │
│              ↓                      │
│  ┌────────────────────────────┐   │
│  │   Swift <-> Rust FFI       │   │
│  └────────────────────────────┘   │
│              ↓                      │
│  ┌────────────────────────────┐   │
│  │   openvscode-server        │   │
│  │   (Rust CLI + Node.js)     │   │
│  └────────────────────────────┘   │
└─────────────────────────────────────┘

Advantages:
- Native Rust CLI layer
- Swift FFI integration
- Virtualization Framework SDK support
- Better isolation and performance
```

---

## Recommendation: ✅ openvscode-server

### Why openvscode-server wins for your use case:

1. **Native macOS Integration** ⭐⭐⭐
   - Existing Rust CLI with macOS-specific code
   - Service integration and power management
   - Better foundation for Swift 5 FFI

2. **Virtualization Framework Compatibility** ⭐⭐⭐
   - Rust CLI can be compiled as native library
   - Can run in VM or host OS
   - Better isolation model

3. **No Docker Requirement** ⭐⭐⭐
   - Native compilation path proven (Azure Pipelines)
   - Can build entirely with Xcode + Rust toolchain
   - Swift 5 + Rust interop is well-documented

4. **Active Development**
   - Gitpod actively maintains it
   - Regular security updates
   - Good for rebrand/fork

5. **Rebrand Path**
   - Existing customization by Gitpod shows it's rebrandable
   - `product.json` for branding
   - Can strip Gitpod branding easily

---

## Implementation Strategy

### Phase 1: Evaluation (Week 1-2)
1. Build openvscode-server natively on macOS
2. Test Swift 5 FFI with Rust CLI
3. Evaluate Virtualization Framework integration
4. Document pain points

### Phase 2: Rebrand (Week 3-4)
1. Fork openvscode-server
2. Update branding (`product.json`, resources)
3. Customize Rust CLI for VibeCode
4. Add Swift wrapper layer

### Phase 3: Integration (Week 5-6)
1. Integrate with Virtualization Framework SDK
2. Build Swift 5 native UI
3. Test webkit rendering
4. Performance optimization

### Phase 4: Build System (Week 7-8)
1. Create native macOS build pipeline
2. No Docker - use Xcode + Rust
3. Distribution via DMG/PKG
4. Update signature

---

## Build Commands Comparison

### code-server
```bash
# Standard build
npm install
npm run build
npm run release

# Native test
npm run test:native
```

### openvscode-server (Recommended)
```bash
# Install dependencies
npm install

# Build web version
npm run compile

# Build native CLI (Rust)
cd cli
cargo build --release

# Create distributable
npm run gulp vscode-darwin-arm64
```

---

## Code-Server Fallback Plan

If openvscode-server proves too complex:

1. Use code-server with custom Swift wrapper
2. Launch code-server as subprocess
3. Bridge via IPC/WebSocket
4. Less native integration but simpler

---

## Files to Review

### openvscode-server
- `cli/src/tunnels/service_macos.rs` - macOS service code
- `cli/src/tunnels/nosleep_macos.rs` - Power management
- `resources/darwin/` - Darwin-specific resources
- `build/azure-pipelines/product-build-macos.yml` - macOS build pipeline
- `product.json` - Branding configuration

### code-server
- `ci/build/build-code-server.sh` - Build script
- `src/node/` - Node.js wrapper
- `lib/vscode/` - VS Code submodule

---

## Next Steps

1. ✅ Clone both projects (completed - shallow clones)
2. ⏭️ Build openvscode-server natively on macOS
3. ⏭️ Test Rust CLI compilation
4. ⏭️ Create Swift FFI proof-of-concept
5. ⏭️ Document Virtualization Framework integration
6. ⏭️ Make final decision based on build results

---

## Resources

- **openvscode-server**: https://github.com/gitpod-io/openvscode-server
- **code-server**: https://github.com/coder/code-server
- **Swift-Rust FFI**: https://github.com/chinedufn/swift-bridge
- **macOS Virtualization Framework**: https://developer.apple.com/documentation/virtualization
- **Rust macOS Service**: `openvscode-server/cli/src/tunnels/service_macos.rs`

---

**Decision**: Proceed with **openvscode-server** for native macOS build with Swift 5 + Virtualization Framework SDK integration.
