# Unified Architecture: Electron + Rust + Swift Integration
**Date**: 2025-10-27
**Status**: 🏗️ **ARCHITECTURE DESIGN**

## Overview

VibeCode needs to consolidate:
- **Chromium** (for code-server extensions) - via Electron
- **Rust/Tauri** (for system integration, Docker, VM management)
- **Swift/CoreML** (for Apple Silicon ML acceleration)

## Unified Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Electron Shell (Chromium)                 │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  code-server (VS Code)                               │  │
│  │  ┌───────────────────────────────────────────────┐   │  │
│  │  │  Extensions ✅ (Chromium required)            │   │  │
│  │  └───────────────────────────────────────────────┘   │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Frontend (Next.js)                                   │  │
│  │  - Chat UI                                            │  │
│  │  - Workspace Management                               │  │
│  │  - AI Panel                                           │  │
│  └───────────────────────────────────────────────────────┘  │
└───────────────────┬─────────────────────────────────────────┘
                    │ IPC (Electron ↔ Rust)
                    │
┌───────────────────▼─────────────────────────────────────────┐
│              Rust Backend (Tauri-like)                      │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Core Services                                        │  │
│  │  - Docker Management (bollard)                        │  │
│  │  - VM Management (vfkit, lima)                        │  │
│  │  - Tailscale Integration                              │  │
│  │  - mDNS/Bonjour                                       │  │
│  │  - AI Orchestration                                   │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  FFI Bridge to Swift                                  │  │
│  │  extern "C" { ... }                                   │  │
│  └───────────────────┬───────────────────────────────────┘  │
└───────────────────────┼───────────────────────────────────────┘
                        │ C FFI
┌───────────────────────▼───────────────────────────────────────┐
│              Swift CoreML Module (macOS only)                 │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  VibeMLAccelerator                                    │  │
│  │  - CoreML Inference Engine                            │  │
│  │  - Metal GPU Acceleration                             │  │
│  │  - Apple Neural Engine                                │  │
│  │  - Model Management                                   │  │
│  └───────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────┘
```

## Component Breakdown

### 1. Electron Shell (Chromium)
**Purpose**: Host code-server with working VS Code extensions

**Technology**:
- Electron (Chromium + Node.js)
- Main process: TypeScript/JavaScript
- Renderer: Chromium WebView

**Responsibilities**:
- Window management
- code-server process lifecycle
- Extension host
- IPC bridge to Rust backend

**File Structure**:
```
electron/
├── main.ts              # Main process
├── preload.ts           # Bridge script
├── package.json
└── build.ts            # Build config
```

### 2. Rust Backend (Native Service)
**Purpose**: System integration, orchestration, ML bridge

**Technology**:
- Rust (no Tauri - standalone service)
- C FFI for Swift
- HTTP/WebSocket server for Electron IPC

**Responsibilities**:
- Docker container management
- VM lifecycle (vfkit, lima)
- Tailscale zero-trust networking
- AI provider orchestration
- Bridge to Swift CoreML

**File Structure**:
```
src-tauri/              # Rename to src-backend/
├── src/
│   ├── main.rs         # Standalone service
│   ├── docker.rs
│   ├── vm.rs
│   ├── tailscale.rs
│   ├── ai/
│   └── ml/
│       ├── mod.rs      # Rust ML commands
│       └── swift_bridge.rs  # FFI to Swift
├── Cargo.toml
└── build.rs            # Link Swift library
```

### 3. Swift CoreML Module
**Purpose**: Apple Silicon ML acceleration

**Technology**:
- Swift 5
- Core ML
- Metal
- C FFI exports

**Responsibilities**:
- Model loading/inference
- GPU acceleration
- Neural Engine optimization
- FFI interface for Rust

**File Structure**:
```
src-tauri/swift/
├── Sources/
│   └── VibeMLAccelerator/
│       ├── VibeMLAccelerator.swift
│       ├── CoreMLEngine.swift
│       ├── MetalAccelerator.swift
│       └── FFI.swift           # C exports
├── Package.swift
└── build.sh                   # Build static library
```

## Communication Flow

### Electron ↔ Rust
**Method**: HTTP + WebSocket

```typescript
// Electron main process
import { spawn } from 'child_process';

// Start Rust backend service
const rustBackend = spawn('./target/release/vibecode-backend', []);

// Communicate via HTTP
const response = await fetch('http://localhost:3030/api/docker/status');
```

```rust
// Rust backend
use axum::{Router, routing::get};

let app = Router::new()
    .route("/api/docker/status", get(handle_docker_status))
    .route("/api/ml/available", get(handle_ml_available));

axum::Server::bind(&"0.0.0.0:3030".parse().unwrap())
    .serve(app.into_make_service())
    .await?;
```

### Rust ↔ Swift
**Method**: C FFI

```rust
// Rust bridge
#[link(name = "VibeMLAccelerator", kind = "static")]
extern "C" {
    fn vibe_ml_init() -> *mut std::ffi::c_void;
    fn vibe_ml_is_available() -> bool;
    fn vibe_ml_generate_embedding(text: *const i8, len: usize) -> *const f32;
}

#[tauri::command]  // Or HTTP handler
pub async fn ml_generate_embedding(text: String) -> Result<Vec<f32>, String> {
    let c_str = CString::new(text)?;
    unsafe {
        let ptr = vibe_ml_generate_embedding(c_str.as_ptr(), text.len());
        // Convert C array to Vec<f32>
    }
}
```

```swift
// Swift FFI exports
@_cdecl("vibe_ml_is_available")
public func vibe_ml_is_available() -> Bool {
    return VibeMLAccelerator.shared.isAvailable
}

@_cdecl("vibe_ml_generate_embedding")
public func vibe_ml_generate_embedding(
    text: UnsafePointer<CChar>,
    len: Int
) -> UnsafeMutablePointer<Float> {
    let string = String(cString: text)
    let embedding = try await VibeMLAccelerator.shared.generateEmbedding(text: string)
    // Convert to C array
}
```

## Implementation Steps

### Phase 1: Extract Rust from Tauri (Week 1)
1. Remove Tauri dependencies
2. Convert to standalone HTTP service
3. Replace Tauri commands with HTTP endpoints
4. Test all existing functionality

### Phase 2: Integrate Electron (Week 2)
1. Set up Electron project
2. Embed code-server
3. Create IPC bridge to Rust service
4. Test VS Code extensions work

### Phase 3: Complete Swift Bridge (Week 2-3)
1. Build Swift static library
2. Implement C FFI exports
3. Link in Rust build.rs
4. Test ML commands end-to-end

### Phase 4: Unified Build (Week 3)
1. Create unified build script
2. Package Electron + Rust binary
3. Bundle Swift library
4. Test on all platforms

## Build Configuration

### Rust Backend (Cargo.toml)
```toml
[package]
name = "vibecode-backend"
version = "0.1.0"

[dependencies]
tokio = { version = "1", features = ["full"] }
axum = "0.7"
bollard = "0.18"
mdns-sd = "0.11"
# ... other deps

[build-dependencies]
# Link Swift library on macOS
```

### Electron (package.json)
```json
{
  "name": "vibecode",
  "main": "electron/main.js",
  "dependencies": {
    "electron": "^30.0.0"
  },
  "scripts": {
    "build:rust": "cd src-backend && cargo build --release",
    "build:swift": "cd src-backend/swift && ./build.sh",
    "build:electron": "electron-builder",
    "build": "npm run build:rust && npm run build:swift && npm run build:electron"
  }
}
```

### Swift (Package.swift)
```swift
// Package.swift
let package = Package(
    name: "VibeMLAccelerator",
    products: [
        .library(name: "VibeMLAccelerator", type: .static, targets: ["VibeMLAccelerator"])
    ],
    targets: [
        .target(
            name: "VibeMLAccelerator",
            dependencies: []
        )
    ]
)
```

## Platform Support

### macOS
- ✅ Electron (Chromium)
- ✅ Rust backend
- ✅ Swift CoreML
- ✅ Full feature set

### Linux
- ✅ Electron (Chromium)
- ✅ Rust backend
- ❌ Swift CoreML (not available)
- ⚠️ ML falls back to CPU/remote

### Windows
- ✅ Electron (Chromium)
- ✅ Rust backend
- ❌ Swift CoreML (not available)
- ⚠️ ML falls back to CPU/remote

## Benefits of This Architecture

1. **Chromium Everywhere**: VS Code extensions work on all platforms
2. **Rust Performance**: Native system integration
3. **Swift ML**: Apple Silicon optimization where available
4. **Modular**: Each component can be developed/tested independently
5. **Proven Stack**: Electron + Rust is a common pattern
6. **Future-Proof**: Can migrate to Tauri later when Chromium support arrives

## Migration Path from Current Tauri

1. **Keep Tauri code** but remove window/WebView parts
2. **Add HTTP server** for Electron IPC
3. **Build Electron wrapper** around existing Rust backend
4. **Keep Swift integration** as-is (already FFI-based)
5. **Test incrementally** - don't break existing functionality

## Example: Complete Flow

**User requests AI completion in code-server:**

```
1. User types in VS Code editor
   ↓
2. Extension sends to Electron main process
   ↓
3. Electron → HTTP POST to Rust backend
   POST http://localhost:3030/api/ai/complete
   ↓
4. Rust backend checks if CoreML available
   ↓
5. If macOS: Rust → C FFI → Swift CoreML
   If Linux/Windows: Rust → Remote API (OpenAI/etc)
   ↓
6. Swift generates completion tokens
   ↓
7. Swift → C FFI → Rust → HTTP → Electron
   ↓
8. Electron → Extension → VS Code editor
```

## Next Steps

1. ✅ Document architecture (this file)
2. ⏳ Create Rust standalone service
3. ⏳ Set up Electron project
4. ⏳ Implement IPC bridge
5. ⏳ Complete Swift FFI exports
6. ⏳ Unified build system
7. ⏳ Test end-to-end

## References

- [Electron + Rust pattern](https://github.com/tauri-apps/tauri/issues/2033)
- [Swift FFI to Rust](https://mozilla.github.io/firefox-browser-architecture/experiments/2017-09-06-rust-on-ios.html)
- [Tauri alternatives](https://github.com/tauri-apps/tauri/issues/2033#issuecomment-623456789)

