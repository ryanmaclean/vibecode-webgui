// AI Commands for Tauri IPC
// Exposes AI functionality to frontend via Tauri commands

use serde::{Deserialize, Serialize};
use tauri::command;

use super::manager::AIManager;
use super::mcp::MCPManager;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AIMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AIChatRequest {
    pub messages: Vec<AIMessage>,
    pub model: String,
    pub provider: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub temperature: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_tokens: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AIChatResponse {
    pub content: String,
    pub model: String,
    pub provider: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tokens_used: Option<u32>,
    pub cached: bool,
}

/// AI Chat - Primary interface for conversational AI
#[command]
pub async fn ai_chat(request: AIChatRequest) -> Result<AIChatResponse, String> {
    let ai_manager = AIManager::global();
    ai_manager.chat(request).await
}

/// AI Code Completion - Optimized for inline completions
#[command]
pub async fn ai_complete(
    code: String,
    cursor: usize,
    language: String,
    prefer_local: bool,
) -> Result<serde_json::Value, String> {
    let start = std::time::Instant::now();
    let ai_manager = AIManager::global();

    // Build completion request
    let prompt = format!(
        "Complete the following {} code:\n\n{}",
        language,
        &code[..cursor.min(code.len())]
    );

    let request = AIChatRequest {
        messages: vec![AIMessage {
            role: "user".to_string(),
            content: prompt,
        }],
        model: if prefer_local {
            "qwen2.5-coder:1.5b".to_string()
        } else {
            "gpt-3.5-turbo".to_string()
        },
        provider: if prefer_local {
            "ollama".to_string()
        } else {
            "auto".to_string()
        },
        temperature: Some(0.3),
        max_tokens: Some(500),
    };

    let response = ai_manager.chat(request).await?;
    let latency = start.elapsed().as_millis() as u64;

    Ok(serde_json::json!({
        "completion": response.content,
        "provider": response.provider,
        "model": response.model,
        "latency_ms": latency,
    }))
}

/// Check Local Model Availability
#[command]
pub async fn ai_check_local_models() -> Result<serde_json::Value, String> {
    let ai_manager = AIManager::global();
    let status = ai_manager.check_local_models().await?;

    Ok(serde_json::json!({
        "ollama_available": status.ollama_available,
        "ollama_models": status.ollama_models,
        "localai_available": status.localai_available,
    }))
}

/// List Available Models (All Providers)
#[command]
pub async fn ai_list_models() -> Result<Vec<serde_json::Value>, String> {
    // TODO: Implement model listing from all providers
    Ok(vec![
        serde_json::json!({
            "id": "qwen2.5-coder:1.5b",
            "name": "Qwen 2.5 Coder 1.5B",
            "provider": "ollama",
            "capabilities": ["code", "completion"],
            "local": true,
        }),
        serde_json::json!({
            "id": "llama3.2:1b",
            "name": "Llama 3.2 1B",
            "provider": "ollama",
            "capabilities": ["chat", "general"],
            "local": true,
        }),
    ])
}

/// Stream AI Chat (WebSocket-style streaming)
#[command]
pub async fn ai_chat_stream(request: AIChatRequest, stream_id: String) -> Result<String, String> {
    // TODO: Implement streaming
    Err("Streaming not yet implemented".to_string())
}

/// MCP Server Operations
#[command]
pub async fn mcp_connect(server_config: serde_json::Value) -> Result<String, String> {
    let mcp_manager = MCPManager::global();
    mcp_manager.connect(server_config).await
}

#[command]
pub async fn mcp_list_tools(server_id: String) -> Result<Vec<serde_json::Value>, String> {
    let mcp_manager = MCPManager::global();
    mcp_manager.list_tools(&server_id).await
}

#[command]
pub async fn mcp_call_tool(
    server_id: String,
    tool_name: String,
    args: serde_json::Value,
) -> Result<serde_json::Value, String> {
    let mcp_manager = MCPManager::global();
    mcp_manager.call_tool(&server_id, &tool_name, args).await
}

/// Agent Task Management
#[command]
pub async fn agent_create_task(
    task_description: String,
    agents: Vec<serde_json::Value>,
) -> Result<String, String> {
    // TODO: Implement agent orchestration
    Err("Agent orchestration not yet implemented".to_string())
}

#[command]
pub async fn agent_get_status(task_id: String) -> Result<serde_json::Value, String> {
    // TODO: Implement task status
    Err("Agent status not yet implemented".to_string())
}

#[command]
pub async fn agent_cancel_task(task_id: String) -> Result<(), String> {
    // TODO: Implement task cancellation
    Err("Agent cancel not yet implemented".to_string())
}
