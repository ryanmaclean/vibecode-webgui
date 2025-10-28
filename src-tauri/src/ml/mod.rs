// src-tauri/src/ml/mod.rs
// CoreML integration module

// TODO: Re-enable once coreml.rs is implemented
// #[cfg(target_os = "macos")]
// pub mod coreml;

pub mod commands;

// Re-export commands
pub use commands::*;

