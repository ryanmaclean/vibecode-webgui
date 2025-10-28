# Missing: CoreML Integration & Sandboxing

## Current Status

**Swift Code EXISTS but NOT Connected:**
✅ src-tauri/swift/Sources/VibeMLAccelerator/ - Core ML ready
✅ MetalAccelerator - GPU acceleration ready
✅ CoreMLEngine - Inference engine ready
❌ NOT exposed in commands.rs
❌ NOT registered in main.rs
❌ NOT callable from frontend

## What We're Building

**Sandboxed GenAI Coding Editors:**
- Tauri provides native sandboxing
- code-server runs in isolated environment
- CoreML provides on-device AI
- Each editor instance is sandboxed

## Missing Implementation

### 1. Expose CoreML Commands

Add to `commands.rs`:
```rust
#[command]
pub async fn ml_init() -> Result<String, String>
#[command]
pub async fn ml_generate(prompt: String, model: String) -> Result<String, String>
#[command]
pub async fn ml_embed(text: String) -> Result<Vec<f32>, String>
```

### 2. Register in main.rs

Add to invoke_handler:
```rust
commands::ml_init,
commands::ml_generate,
commands::ml_embed,
```

### 3. Sandboxing

Tauri already provides sandboxing. Each code-server instance is isolated.

## Architecture

```
Frontend (React)
    ↓
Tauri Backend (Rust)
    ↓
Swift CoreML Bridge
    ↓
CoreML + Metal (local AI)
    ↓
code-server (sandboxed)
```

## Next Steps

1. Hook up Swift CoreML to Rust commands
2. Expose to frontend
3. Test local AI inference
4. Deploy sandboxed editors

The foundation is there - just needs connecting!
