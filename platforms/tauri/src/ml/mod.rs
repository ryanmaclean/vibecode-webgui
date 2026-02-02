// src-tauri/src/ml/mod.rs
// CoreML integration module

#[cfg(target_os = "macos")]
pub mod coreml;

pub mod commands;

// Re-export commands
pub use commands::*;
