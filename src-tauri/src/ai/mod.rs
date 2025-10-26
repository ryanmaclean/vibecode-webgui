// AI Module for VibeCode Tauri Desktop
// Provides AI chat, code completion, and agent orchestration

pub mod commands;
pub mod manager;
pub mod mcp;

pub use commands::*;
pub use manager::AIManager;
pub use mcp::MCPManager;
