// AI Module for VibeCode Tauri Desktop
// Provides AI chat, code completion, and agent orchestration

pub mod chat;
pub mod commands;
pub mod completion;
pub mod context;
pub mod manager;
pub mod mcp;

pub use commands::*;
pub use manager::AIManager;
pub use mcp::MCPManager;
