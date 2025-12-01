# Implementation Guide: Electron + Rust + Swift Integration

## Quick Start

### 1. Current State
- ✅ Rust/Tauri backend with Docker, VM, Tailscale integration
- ✅ Swift CoreML module (built, needs FFI exports)
- ❌ Tauri uses WebKit (breaks VS Code extensions)
- ❌ Need Chromium for code-server

### 2. Solution: Hybrid Architecture

**Electron (Chromium)** → **Rust Service (HTTP)** → **Swift (FFI)**

## Step-by-Step Implementation

### Step 1: Convert Rust to Standalone Service

Create `src-backend/src/main.rs`:

```rust
use axum::{
    Router,
    routing::{get, post},
    Json,
};
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;

#[derive(Serialize)]
struct StatusResponse {
    status: String,
    version: String,
}

async fn health_check() -> Json<StatusResponse> {
    Json(StatusResponse {
        status: "ok".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
    })
}

#[tokio::main]
async fn main() {
    let app = Router::new()
        .route("/health", get(health_check))
        .route("/api/docker/status", get(handle_docker_status))
        .route("/api/ml/available", get(handle_ml_available))
        .route("/api/ml/embedding", post(handle_ml_embedding))
        .route("/api/ai/chat", post(handle_ai_chat));

    let addr = SocketAddr::from(([127, 0, 0, 1], 3030));
    println!("🚀 VibeCode backend listening on {}", addr);
    
    axum::Server::bind(&addr)
        .serve(app.into_make_service())
        .await
        .unwrap();
}
```

Update `src-backend/Cargo.toml`:

```toml
[package]
name = "vibecode-backend"
version = "0.1.0"
edition = "2021"

[dependencies]
axum = "0.7"
tokio = { version = "1", features = ["full"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
bollard = "0.18"
mdns-sd = "0.11"
hostname = "0.4"
# ... keep all existing dependencies

# Remove Tauri dependencies
# tauri = { version = "2" }  # Remove this
```

### Step 2: Create Swift FFI Bridge

Create `src-backend/swift/Sources/VibeMLAccelerator/FFI.swift`:

```swift
import Foundation

/// C-compatible FFI exports for Rust
@_cdecl("vibe_ml_is_available")
public func vibe_ml_is_available() -> Bool {
    return VibeMLAccelerator.shared.isAvailable
}

@_cdecl("vibe_ml_get_device_info")
public func vibe_ml_get_device_info() -> UnsafeMutablePointer<CChar> {
    let info = VibeMLAccelerator.shared.getDeviceInfo()
    let json = try! JSONEncoder().encode(info)
    let jsonString = String(data: json, encoding: .utf8)!
    
    let cString = strdup(jsonString)
    return UnsafeMutablePointer<CChar>(cString!)
}

@_cdecl("vibe_ml_generate_embedding")
public func vibe_ml_generate_embedding(
    text: UnsafePointer<CChar>,
    length: UnsafeMutablePointer<Int>
) -> UnsafeMutablePointer<Float> {
    let string = String(cString: text)
    
    // Run async operation synchronously via semaphore
    let semaphore = DispatchSemaphore(value: 0)
    var result: [Float] = []
    
    Task {
        do {
            result = try await VibeMLAccelerator.shared.generateEmbedding(
                text: string,
                model: "all-minilm-l6-v2"
            )
        } catch {
            result = []
        }
        semaphore.signal()
    }
    
    semaphore.wait()
    
    // Allocate C array
    let count = result.count
    length.pointee = count
    
    let buffer = UnsafeMutablePointer<Float>.allocate(capacity: count)
    buffer.initialize(from: result, count: count)
    
    return buffer
}

@_cdecl("vibe_ml_free_buffer")
public func vibe_ml_free_buffer(ptr: UnsafeMutablePointer<Float>) {
    ptr.deallocate()
}
```

### Step 3: Build Swift Static Library

Create `src-backend/swift/build.sh`:

```bash
#!/bin/bash
set -e

cd "$(dirname "$0")"

# Build Swift static library
swift build -c release

# Copy to Rust target directory
mkdir -p ../../target/release/swift-libs
cp .build/release/libVibeMLAccelerator.a ../../target/release/swift-libs/

echo "✅ Swift library built"
```

Update `src-backend/build.rs`:

```rust
use std::env;
use std::path::PathBuf;
use std::process::Command;

fn main() {
    // Only build Swift on macOS
    #[cfg(target_os = "macos")]
    {
        let swift_dir = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap())
            .join("swift");
        
        // Build Swift library
        let status = Command::new("bash")
            .arg("build.sh")
            .current_dir(&swift_dir)
            .status()
            .expect("Failed to build Swift library");
        
        if !status.success() {
            panic!("Swift build failed");
        }
        
        // Link Swift library
        let lib_path = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap())
            .join("target")
            .join("release")
            .join("swift-libs");
        
        println!("cargo:rustc-link-search=native={}", lib_path.display());
        println!("cargo:rustc-link-lib=static=VibeMLAccelerator");
        
        // Link Swift runtime
        println!("cargo:rustc-link-lib=swiftCore");
        println!("cargo:rustc-link-lib=swiftFoundation");
    }
}
```

### Step 4: Create Rust ML Bridge

Create `src-backend/src/ml/swift_bridge.rs`:

```rust
use std::ffi::{CStr, CString};
use std::os::raw::{c_char, c_int};

#[cfg(target_os = "macos")]
#[link(name = "VibeMLAccelerator", kind = "static")]
extern "C" {
    fn vibe_ml_is_available() -> bool;
    fn vibe_ml_get_device_info() -> *mut c_char;
    fn vibe_ml_generate_embedding(
        text: *const c_char,
        length: *mut usize,
    ) -> *mut f32;
    fn vibe_ml_free_buffer(ptr: *mut f32);
}

#[cfg(target_os = "macos")]
pub fn is_available() -> bool {
    unsafe { vibe_ml_is_available() }
}

#[cfg(target_os = "macos")]
pub fn get_device_info() -> Result<serde_json::Value, String> {
    unsafe {
        let c_str = vibe_ml_get_device_info();
        if c_str.is_null() {
            return Err("Failed to get device info".to_string());
        }
        
        let c_str = CStr::from_ptr(c_str);
        let json_str = c_str.to_str()
            .map_err(|e| format!("Invalid UTF-8: {}", e))?;
        
        serde_json::from_str(json_str)
            .map_err(|e| format!("Invalid JSON: {}", e))
    }
}

#[cfg(target_os = "macos")]
pub fn generate_embedding(text: String) -> Result<Vec<f32>, String> {
    unsafe {
        let c_text = CString::new(text)
            .map_err(|e| format!("Invalid string: {}", e))?;
        
        let mut length = 0usize;
        let ptr = vibe_ml_generate_embedding(
            c_text.as_ptr(),
            &mut length as *mut usize,
        );
        
        if ptr.is_null() {
            return Err("Failed to generate embedding".to_string());
        }
        
        let embedding = std::slice::from_raw_parts(ptr, length).to_vec();
        vibe_ml_free_buffer(ptr);
        
        Ok(embedding)
    }
}

#[cfg(not(target_os = "macos"))]
pub fn is_available() -> bool {
    false
}

#[cfg(not(target_os = "macos"))]
pub fn get_device_info() -> Result<serde_json::Value, String> {
    Err("ML only available on macOS".to_string())
}

#[cfg(not(target_os = "macos"))]
pub fn generate_embedding(_text: String) -> Result<Vec<f32>, String> {
    Err("ML only available on macOS".to_string())
}
```

### Step 5: Create Electron Wrapper

Create `electron/main.js`:

```javascript
const { app, BrowserWindow, ipcMain } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fetch = require('node-fetch');

let mainWindow;
let rustBackend;
let codeServer;

// Start Rust backend service
function startRustBackend() {
    const backendPath = path.join(__dirname, '..', 'target', 'release', 'vibecode-backend');
    
    rustBackend = spawn(backendPath, [], {
        stdio: 'inherit',
    });
    
    rustBackend.on('error', (err) => {
        console.error('Failed to start Rust backend:', err);
    });
    
    // Wait for backend to be ready
    setTimeout(async () => {
        try {
            const response = await fetch('http://localhost:3030/health');
            const data = await response.json();
            console.log('✅ Rust backend ready:', data);
        } catch (err) {
            console.error('Backend not ready:', err);
        }
    }, 2000);
}

// Start code-server
function startCodeServer() {
    const codeServerPath = path.join(__dirname, '..', 'node_modules', '.bin', 'code-server');
    
    codeServer = spawn(codeServerPath, [
        '--bind-addr', '127.0.0.1:8080',
        '--auth', 'none',
    ], {
        stdio: 'inherit',
    });
}

// Create Electron window
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
        },
    });
    
    // Load code-server
    mainWindow.loadURL('http://localhost:8080');
    
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// IPC handlers for Rust backend
ipcMain.handle('backend-call', async (event, { endpoint, method, body }) => {
    try {
        const url = `http://localhost:3030${endpoint}`;
        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: body ? JSON.stringify(body) : undefined,
        });
        
        return {
            ok: response.ok,
            data: await response.json(),
        };
    } catch (err) {
        return {
            ok: false,
            error: err.message,
        };
    }
});

app.whenReady().then(() => {
    startRustBackend();
    startCodeServer();
    
    setTimeout(() => {
        createWindow();
    }, 3000);
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('before-quit', () => {
    if (codeServer) codeServer.kill();
    if (rustBackend) rustBackend.kill();
});
```

Create `electron/preload.js`:

```javascript
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('vibecode', {
    // Backend API
    async callBackend(endpoint, method = 'GET', body = null) {
        return await ipcRenderer.invoke('backend-call', { endpoint, method, body });
    },
    
    // Example: ML check
    async mlIsAvailable() {
        const result = await ipcRenderer.invoke('backend-call', {
            endpoint: '/api/ml/available',
            method: 'GET',
        });
        return result.data;
    },
});
```

### Step 6: Package.json for Electron

Create `electron/package.json`:

```json
{
  "name": "vibecode",
  "version": "0.1.0",
  "main": "main.js",
  "scripts": {
    "start": "electron .",
    "build": "electron-builder",
    "build:rust": "cd ../src-backend && cargo build --release",
    "build:swift": "cd ../src-backend/swift && bash build.sh",
    "build:all": "npm run build:swift && npm run build:rust && npm run build"
  },
  "dependencies": {
    "electron": "^30.0.0",
    "node-fetch": "^3.3.2"
  },
  "devDependencies": {
    "electron-builder": "^24.9.1"
  }
}
```

## Build & Run

```bash
# 1. Build Swift library (macOS only)
cd src-backend/swift && bash build.sh

# 2. Build Rust backend
cd src-backend && cargo build --release

# 3. Start Electron
cd electron && npm start
```

## Testing the Integration

```javascript
// In VS Code extension or frontend
const isMLAvailable = await window.vibecode.mlIsAvailable();
console.log('ML available:', isMLAvailable);

// Generate embedding
const result = await window.vibecode.callBackend(
    '/api/ml/embedding',
    'POST',
    { text: 'Hello, world!' }
);
console.log('Embedding:', result.data);
```

## Benefits

✅ **Chromium**: VS Code extensions work  
✅ **Rust**: Native performance, system integration  
✅ **Swift**: Apple Silicon ML acceleration  
✅ **Modular**: Each component independent  
✅ **Cross-platform**: Works everywhere (ML on macOS only)

