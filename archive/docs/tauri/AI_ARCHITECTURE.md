# AI Features Architecture for Tauri Desktop App

**Issue**: #683
**Status**: Design Phase
**Created**: 2025-10-25
**Target Platform**: Tauri 2.x Desktop Application

---

## Executive Summary

This document defines the architecture for integrating AI code completion, chat, agents, and multi-model support into the VibeCode Tauri desktop application. The design leverages existing web app AI infrastructure while providing native desktop capabilities including local model execution, offline operation, and system-level integrations.

**Key Capabilities**:
- AI code completion and chat
- Local model execution (Ollama/LocalAI)
- Cloud model fallback (OpenAI, Anthropic, OpenRouter)
- Model Context Protocol (MCP) integration
- Multi-agent orchestration (Roundtable-AI)
- Offline-first operation with intelligent fallback

---

## Architecture Overview

### High-Level Component Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                    VibeCode Desktop (Tauri)                      │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │              Frontend Layer (Next.js/React)             │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │    │
│  │  │ AI Chat UI   │  │ Code Actions │  │ Agent Panel  │ │    │
│  │  └──────────────┘  └──────────────┘  └──────────────┘ │    │
│  │  ┌────────────────────────────────────────────────────┐ │    │
│  │  │         Unified AI Client (Existing)               │ │    │
│  │  │  - Multi-provider abstraction                      │ │    │
│  │  │  - Streaming support                               │ │    │
│  │  │  - Fallback chains                                 │ │    │
│  │  └────────────────────────────────────────────────────┘ │    │
│  └────────────────────────────────────────────────────────┘    │
│                              │                                  │
│                              │ Tauri IPC                        │
│                              ▼                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │         AI Command Layer (Rust - New)                  │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │    │
│  │  │ AI Manager   │  │ Model Router │  │ MCP Bridge   │ │    │
│  │  └──────────────┘  └──────────────┘  └──────────────┘ │    │
│  └────────────────────────────────────────────────────────┘    │
│                              │                                  │
│          ┌───────────────────┼───────────────────┐             │
│          ▼                   ▼                   ▼             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    │
│  │ Local Models │    │ Cloud Models │    │ MCP Servers  │    │
│  │  (Ollama)    │    │ (API Calls)  │    │  (Agents)    │    │
│  └──────────────┘    └──────────────┘    └──────────────┘    │
└──────────────────────────────────────────────────────────────────┘
```

### Data Flow Architecture

```
User Action (Code Completion Request)
    │
    ├──> Frontend: Trigger completion
    │        │
    │        ├──> Check cache (recent completions)
    │        └──> invoke('ai_complete', { code, cursor })
    │
    ├──> Tauri IPC Bridge
    │        │
    │        └──> Route to ai_complete command
    │
    ├──> AI Command Layer (Rust)
    │        │
    │        ├──> Analyze request (context, language, size)
    │        ├──> Select optimal model
    │        │     ├──> Local model available? → Ollama
    │        │     ├──> Cloud preference? → OpenRouter/OpenAI
    │        │     └──> Fallback chain defined
    │        │
    │        └──> Execute request
    │             │
    │             ├──> Local: HTTP to Ollama (localhost:11434)
    │             ├──> Cloud: HTTPS to provider API
    │             └──> MCP: stdio/HTTP to MCP server
    │
    └──> Return completion
         │
         ├──> Stream tokens to frontend
         └──> Update UI incrementally
```

---

## Component Design

### 1. Frontend Layer (Existing + Enhancements)

#### 1.1 Unified AI Client (Existing)

**Location**: `/src/lib/unified-ai-client.ts`

**Current Capabilities**:
- Multi-provider support (OpenRouter, OpenAI, Anthropic, Ollama, LocalAI)
- Streaming chat completions
- Automatic fallback chains
- Provider health monitoring
- Model selection logic

**Enhancements for Desktop**:
```typescript
// Desktop-specific enhancements
export class DesktopAIClient extends UnifiedAIClient {
  private tauriEnabled: boolean;

  constructor(apiKeys: Record<string, string> = {}) {
    super(apiKeys);
    this.tauriEnabled = window.__TAURI__ !== undefined;
  }

  // Use Tauri for local model execution
  async chatLocal(
    messages: UnifiedChatMessage[],
    model: string,
    options: ChatOptions = {}
  ): Promise<UnifiedChatResponse> {
    if (!this.tauriEnabled) {
      // Fallback to browser-based Ollama connection
      return super.chat(messages, model, options);
    }

    // Use Tauri command for better performance and offline support
    return invoke('ai_chat', {
      messages,
      model,
      provider: 'ollama',
      options
    });
  }

  // Check local model availability via Tauri
  async getLocalModelHealth(): Promise<Record<string, boolean>> {
    if (!this.tauriEnabled) return {};

    return invoke('ai_check_local_models');
  }
}
```

#### 1.2 AI Chat Interface

**Location**: `/src/components/ai/` (new)

**Features**:
- Code completion panel
- Chat sidebar
- Agent task manager
- Model selector with provider status
- Offline indicator

**Example Component**:
```typescript
// src/components/ai/AICompletionPanel.tsx
import { invoke } from '@tauri-apps/api/core';

export function AICompletionPanel() {
  const [completion, setCompletion] = useState('');
  const [isLocal, setIsLocal] = useState(false);

  async function requestCompletion(code: string, cursor: number) {
    try {
      const result = await invoke('ai_complete', {
        code,
        cursor,
        language: detectLanguage(code),
        preferLocal: true // Prefer offline-capable local models
      });

      setCompletion(result.completion);
      setIsLocal(result.provider === 'ollama');
    } catch (error) {
      console.error('Completion failed:', error);
    }
  }

  return (
    <div className="completion-panel">
      {isLocal && <LocalModelBadge />}
      <CompletionDisplay content={completion} />
    </div>
  );
}
```

### 2. Tauri Command Layer (Rust - New)

#### 2.1 AI Commands Module

**Location**: `/src-tauri/src/ai/commands.rs` (new)

**Core Commands**:

```rust
use serde::{Deserialize, Serialize};
use tauri::command;

#[derive(Debug, Serialize, Deserialize)]
pub struct AIMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AIChatRequest {
    pub messages: Vec<AIMessage>,
    pub model: String,
    pub provider: String,
    pub temperature: Option<f32>,
    pub max_tokens: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AIChatResponse {
    pub content: String,
    pub model: String,
    pub provider: String,
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
    let ai_manager = AIManager::global();

    let completion = ai_manager.complete_code(
        &code,
        cursor,
        &language,
        prefer_local
    ).await?;

    Ok(serde_json::json!({
        "completion": completion.text,
        "provider": completion.provider,
        "model": completion.model,
        "latency_ms": completion.latency_ms,
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
    let ai_manager = AIManager::global();
    let models = ai_manager.list_all_models().await?;

    Ok(models.into_iter().map(|m| serde_json::json!({
        "id": m.id,
        "name": m.name,
        "provider": m.provider,
        "capabilities": m.capabilities,
        "local": m.local,
    })).collect())
}

/// Stream AI Chat (WebSocket-style streaming)
#[command]
pub async fn ai_chat_stream(
    request: AIChatRequest,
    stream_id: String,
) -> Result<String, String> {
    let ai_manager = AIManager::global();

    // Spawn streaming task
    ai_manager.chat_stream(request, stream_id).await?;

    Ok("Stream started".to_string())
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
```

#### 2.2 AI Manager Module

**Location**: `/src-tauri/src/ai/manager.rs` (new)

**Responsibilities**:
- Model selection and routing
- Provider health monitoring
- Request caching
- Fallback orchestration

```rust
use std::sync::Arc;
use tokio::sync::RwLock;
use reqwest::Client;

pub struct AIManager {
    config: AIConfig,
    client: Client,
    cache: Arc<RwLock<ResponseCache>>,
    local_models: Arc<RwLock<LocalModelStatus>>,
}

impl AIManager {
    pub fn global() -> &'static AIManager {
        // Singleton instance
        static INSTANCE: OnceCell<AIManager> = OnceCell::new();
        INSTANCE.get_or_init(|| AIManager::new())
    }

    pub fn new() -> Self {
        AIManager {
            config: AIConfig::from_env(),
            client: Client::builder()
                .timeout(Duration::from_secs(30))
                .build()
                .unwrap(),
            cache: Arc::new(RwLock::new(ResponseCache::new())),
            local_models: Arc::new(RwLock::new(LocalModelStatus::new())),
        }
    }

    /// Primary chat interface with intelligent routing
    pub async fn chat(&self, request: AIChatRequest) -> Result<AIChatResponse, String> {
        // Check cache first
        if let Some(cached) = self.check_cache(&request).await {
            return Ok(cached);
        }

        // Route to appropriate provider
        let provider = self.select_provider(&request).await?;

        let response = match provider.as_str() {
            "ollama" => self.chat_ollama(request).await?,
            "openai" => self.chat_openai(request).await?,
            "anthropic" => self.chat_anthropic(request).await?,
            "openrouter" => self.chat_openrouter(request).await?,
            _ => return Err(format!("Unknown provider: {}", provider)),
        };

        // Cache successful response
        self.cache_response(&request, &response).await;

        Ok(response)
    }

    /// Ollama local model chat
    async fn chat_ollama(&self, request: AIChatRequest) -> Result<AIChatResponse, String> {
        let url = "http://localhost:11434/api/chat";

        let ollama_request = serde_json::json!({
            "model": request.model,
            "messages": request.messages,
            "stream": false,
            "options": {
                "temperature": request.temperature.unwrap_or(0.7),
                "num_predict": request.max_tokens.unwrap_or(2000),
            }
        });

        let response = self.client
            .post(url)
            .json(&ollama_request)
            .send()
            .await
            .map_err(|e| format!("Ollama request failed: {}", e))?;

        if !response.status().is_success() {
            return Err(format!("Ollama error: {}", response.status()));
        }

        let data: serde_json::Value = response.json().await
            .map_err(|e| format!("Failed to parse Ollama response: {}", e))?;

        Ok(AIChatResponse {
            content: data["message"]["content"].as_str().unwrap_or("").to_string(),
            model: request.model,
            provider: "ollama".to_string(),
            tokens_used: None,
            cached: false,
        })
    }

    /// Select best provider based on availability, cost, and preferences
    async fn select_provider(&self, request: &AIChatRequest) -> Result<String, String> {
        // Explicit provider specified
        if !request.provider.is_empty() && request.provider != "auto" {
            return Ok(request.provider.clone());
        }

        // Check if local model is available and preferred
        let local_status = self.local_models.read().await;
        if local_status.ollama_available {
            return Ok("ollama".to_string());
        }

        // Fallback to cloud providers
        if self.config.openrouter_key.is_some() {
            return Ok("openrouter".to_string());
        }

        if self.config.openai_key.is_some() {
            return Ok("openai".to_string());
        }

        Err("No AI providers available".to_string())
    }

    /// Check local model status
    pub async fn check_local_models(&self) -> Result<LocalModelStatus, String> {
        let mut status = LocalModelStatus {
            ollama_available: false,
            ollama_models: vec![],
            localai_available: false,
        };

        // Check Ollama
        match self.client.get("http://localhost:11434/api/tags").send().await {
            Ok(response) if response.status().is_success() => {
                if let Ok(data) = response.json::<serde_json::Value>().await {
                    status.ollama_available = true;
                    status.ollama_models = data["models"]
                        .as_array()
                        .map(|models| {
                            models.iter()
                                .filter_map(|m| m["name"].as_str().map(String::from))
                                .collect()
                        })
                        .unwrap_or_default();
                }
            }
            _ => {}
        }

        // Update global status
        let mut global_status = self.local_models.write().await;
        *global_status = status.clone();

        Ok(status)
    }
}

#[derive(Debug, Clone)]
pub struct LocalModelStatus {
    pub ollama_available: bool,
    pub ollama_models: Vec<String>,
    pub localai_available: bool,
}

#[derive(Debug, Clone)]
struct AIConfig {
    openai_key: Option<String>,
    anthropic_key: Option<String>,
    openrouter_key: Option<String>,
}

impl AIConfig {
    fn from_env() -> Self {
        AIConfig {
            openai_key: std::env::var("OPENAI_API_KEY").ok(),
            anthropic_key: std::env::var("ANTHROPIC_API_KEY").ok(),
            openrouter_key: std::env::var("OPENROUTER_API_KEY").ok(),
        }
    }
}
```

#### 2.3 MCP Integration Module

**Location**: `/src-tauri/src/ai/mcp.rs` (new)

**Purpose**: Bridge to Model Context Protocol servers for agent capabilities

```rust
use std::process::{Command, Stdio};
use std::sync::Arc;
use tokio::sync::RwLock;

pub struct MCPManager {
    servers: Arc<RwLock<HashMap<String, MCPServer>>>,
}

impl MCPManager {
    pub fn global() -> &'static MCPManager {
        static INSTANCE: OnceCell<MCPManager> = OnceCell::new();
        INSTANCE.get_or_init(|| MCPManager::new())
    }

    pub fn new() -> Self {
        MCPManager {
            servers: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Connect to MCP server via stdio
    pub async fn connect(&self, config: serde_json::Value) -> Result<String, String> {
        let server_id = config["id"].as_str()
            .ok_or("Missing server id")?
            .to_string();

        let command = config["command"].as_str()
            .ok_or("Missing command")?
            .to_string();

        let args: Vec<String> = config["args"]
            .as_array()
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str().map(String::from))
                    .collect()
            })
            .unwrap_or_default();

        let server = MCPServer::spawn(&command, &args)?;

        let mut servers = self.servers.write().await;
        servers.insert(server_id.clone(), server);

        Ok(server_id)
    }

    /// List available tools from MCP server
    pub async fn list_tools(&self, server_id: &str) -> Result<Vec<serde_json::Value>, String> {
        let servers = self.servers.read().await;
        let server = servers.get(server_id)
            .ok_or("Server not found")?;

        server.list_tools().await
    }

    /// Call tool on MCP server
    pub async fn call_tool(
        &self,
        server_id: &str,
        tool_name: &str,
        args: serde_json::Value,
    ) -> Result<serde_json::Value, String> {
        let servers = self.servers.read().await;
        let server = servers.get(server_id)
            .ok_or("Server not found")?;

        server.call_tool(tool_name, args).await
    }
}

struct MCPServer {
    process: std::process::Child,
    // JSON-RPC communication channels
}

impl MCPServer {
    fn spawn(command: &str, args: &[String]) -> Result<Self, String> {
        let process = Command::new(command)
            .args(args)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("Failed to spawn MCP server: {}", e))?;

        Ok(MCPServer { process })
    }

    async fn list_tools(&self) -> Result<Vec<serde_json::Value>, String> {
        // Send JSON-RPC request to list tools
        // Implementation uses stdio communication
        todo!("Implement JSON-RPC tools/list")
    }

    async fn call_tool(
        &self,
        tool_name: &str,
        args: serde_json::Value,
    ) -> Result<serde_json::Value, String> {
        // Send JSON-RPC request to call tool
        todo!("Implement JSON-RPC tools/call")
    }
}
```

---

## Integration Patterns

### 1. Local Model Execution (Ollama)

**Setup**:
```bash
# Install Ollama
brew install ollama

# Pull recommended models
ollama pull qwen2.5-coder:1.5b  # Code completion
ollama pull llama3.2:1b          # Fast chat
ollama pull deepseek-coder:6.7b  # Advanced coding
```

**Tauri Configuration**:
```rust
// Auto-detect Ollama on startup
async fn detect_ollama() -> bool {
    match reqwest::get("http://localhost:11434/api/tags").await {
        Ok(response) => response.status().is_success(),
        Err(_) => false,
    }
}
```

**Usage Flow**:
1. User triggers code completion
2. Tauri checks if Ollama is available
3. If yes, route to local model (latency: 50-200ms)
4. If no, fallback to cloud provider

### 2. Cloud Model Fallback

**Priority Chain**:
```rust
async fn get_fallback_chain() -> Vec<Provider> {
    vec![
        Provider::Ollama,        // Try local first
        Provider::OpenRouter,    // Then unified gateway
        Provider::OpenAI,        // Direct OpenAI
        Provider::Anthropic,     // Direct Anthropic
    ]
}
```

**Smart Routing**:
```rust
async fn route_request(request: AIRequest) -> Result<AIResponse> {
    for provider in get_fallback_chain().await {
        match provider.execute(request).await {
            Ok(response) => return Ok(response),
            Err(e) => {
                log::warn!("Provider {} failed: {}", provider, e);
                continue;
            }
        }
    }
    Err("All providers failed".into())
}
```

### 3. MCP Server Integration

**Configuration** (`~/.config/vibecode/mcp-servers.json`):
```json
{
  "servers": [
    {
      "id": "vibecode-workspace",
      "name": "VibeCode Workspace Tools",
      "command": "node",
      "args": ["/path/to/vibecode-webgui/src/mcp/server.ts"],
      "env": {
        "NEXTAUTH_SECRET": "..."
      }
    },
    {
      "id": "roundtable-ai",
      "name": "Roundtable Multi-Agent",
      "command": "python",
      "args": ["-m", "scripts.roundtable-mcp-wrapper"],
      "env": {
        "GOOGLE_API_KEY": "..."
      }
    }
  ]
}
```

**Agent Orchestration Example**:
```rust
// Invoke Roundtable-AI for multi-agent task
pub async fn orchestrate_agents(
    task: String,
    agents: Vec<AgentConfig>,
) -> Result<AgentResults, String> {
    let mcp_manager = MCPManager::global();

    let result = mcp_manager.call_tool(
        "roundtable-ai",
        "orchestrate_agents",
        serde_json::json!({
            "agents": agents,
            "coordination_strategy": "parallel",
            "integration_report": true,
        })
    ).await?;

    Ok(serde_json::from_value(result).unwrap())
}
```

### 4. Offline Operation Strategy

**Capabilities**:
- Code completion works offline (via Ollama)
- Chat works offline (via local models)
- Agent tasks queue for online execution
- Graceful degradation when cloud unavailable

**Implementation**:
```rust
pub struct OfflineCapability {
    local_models_available: bool,
    cached_responses: HashMap<String, CachedResponse>,
    pending_tasks: Vec<QueuedTask>,
}

impl OfflineCapability {
    pub async fn handle_request(&self, request: AIRequest) -> Result<AIResponse> {
        if self.local_models_available {
            // Execute locally
            return self.execute_local(request).await;
        }

        if let Some(cached) = self.check_cache(&request) {
            return Ok(cached);
        }

        // Queue for later
        self.queue_task(request).await;
        Err("Offline: Task queued for online execution".into())
    }
}
```

---

## API Surface

### Tauri Commands (Rust → Frontend)

```typescript
// Complete list of AI commands available to frontend

// Chat & Completion
invoke('ai_chat', { messages, model, provider, options })
invoke('ai_complete', { code, cursor, language, preferLocal })
invoke('ai_chat_stream', { request, streamId })

// Model Management
invoke('ai_list_models')
invoke('ai_check_local_models')
invoke('ai_get_provider_status')

// MCP Integration
invoke('mcp_connect', { serverConfig })
invoke('mcp_disconnect', { serverId })
invoke('mcp_list_tools', { serverId })
invoke('mcp_call_tool', { serverId, toolName, args })

// Agent Orchestration
invoke('agent_create_task', { task, agents })
invoke('agent_get_status', { taskId })
invoke('agent_cancel_task', { taskId })

// Configuration
invoke('ai_set_api_key', { provider, key })
invoke('ai_get_config')
invoke('ai_update_preferences', { preferences })
```

### Event System (Tauri Events)

```typescript
// Events emitted from Rust to Frontend

// AI completion streaming
listen('ai:stream:token', (event) => {
  console.log('Token:', event.payload.token);
});

listen('ai:stream:complete', (event) => {
  console.log('Done:', event.payload.finalText);
});

// Provider status changes
listen('ai:provider:status', (event) => {
  console.log('Provider status:', event.payload);
  // { ollama: true, openrouter: true, openai: false }
});

// Agent task updates
listen('agent:task:update', (event) => {
  console.log('Agent task:', event.payload);
  // { taskId, agent, status, progress }
});

// Model downloads (Ollama)
listen('ai:model:download', (event) => {
  console.log('Downloading:', event.payload.progress);
});
```

---

## Security & Privacy

### API Key Management

**Secure Storage**:
```rust
use keyring::Entry;

pub fn store_api_key(provider: &str, key: &str) -> Result<(), String> {
    let entry = Entry::new("vibecode", provider)
        .map_err(|e| e.to_string())?;

    entry.set_password(key)
        .map_err(|e| e.to_string())
}

pub fn get_api_key(provider: &str) -> Result<String, String> {
    let entry = Entry::new("vibecode", provider)
        .map_err(|e| e.to_string())?;

    entry.get_password()
        .map_err(|e| e.to_string())
}
```

**Usage**:
- API keys stored in system keychain (macOS Keychain, Windows Credential Manager)
- Never logged or exposed in UI
- Encrypted in memory
- Cleared on logout

### Local Model Privacy

**Guarantees**:
- All Ollama models run locally
- No data sent to external servers
- Code never leaves the machine
- Audit logs for all AI operations

**Compliance**:
- GDPR compliant (data stays local)
- SOC2 ready (audit trails)
- HIPAA compatible (local execution)

---

## Performance Considerations

### Response Time Targets

| Operation | Local (Ollama) | Cloud (OpenRouter) | Notes |
|-----------|----------------|-------------------|-------|
| Code Completion | 50-200ms | 200-500ms | Small context |
| Chat Message | 100-500ms | 500-1500ms | Medium context |
| Code Generation | 500-2000ms | 1000-3000ms | Large context |
| Agent Task | 2-10s | 5-30s | Complex multi-step |

### Optimization Strategies

**1. Response Caching**:
```rust
struct ResponseCache {
    cache: LruCache<String, CachedResponse>,
    ttl: Duration,
}

impl ResponseCache {
    fn get(&self, key: &str) -> Option<&CachedResponse> {
        self.cache.peek(key)
            .filter(|resp| resp.is_fresh(self.ttl))
    }
}
```

**2. Model Pre-warming**:
```rust
// Load frequently used models on startup
async fn prewarm_models() {
    tokio::spawn(async {
        let _ = invoke_ollama("qwen2.5-coder:1.5b", "warmup").await;
    });
}
```

**3. Streaming Optimization**:
```rust
// Stream tokens as they arrive (don't wait for complete response)
async fn stream_completion(request: AIRequest) {
    let mut stream = get_completion_stream(request).await;

    while let Some(token) = stream.next().await {
        emit_event("ai:stream:token", token);
    }
}
```

---

## Implementation Roadmap

### Phase 1: Foundation (Weeks 1-2)

**Goal**: Basic AI chat and completion working in Tauri

**Tasks**:
- [ ] Create `/src-tauri/src/ai/` module structure
- [ ] Implement `ai_chat` command with Ollama support
- [ ] Implement `ai_complete` command for code completion
- [ ] Add `ai_check_local_models` health check
- [ ] Create frontend components for AI chat UI
- [ ] Test local Ollama integration end-to-end

**Deliverables**:
- Working AI chat with local Ollama models
- Basic code completion in editor
- Provider status indicator in UI

**Success Criteria**:
- Can complete code using local Ollama model
- Can chat with AI assistant offline
- Provider health checks working

### Phase 2: Cloud Integration (Weeks 3-4)

**Goal**: Cloud model fallback and multi-provider support

**Tasks**:
- [ ] Implement OpenRouter API integration
- [ ] Implement OpenAI direct integration
- [ ] Implement Anthropic direct integration
- [ ] Add intelligent provider routing
- [ ] Create fallback chain logic
- [ ] Add API key management (system keychain)
- [ ] Implement response caching

**Deliverables**:
- Multi-provider AI support
- Automatic fallback when local unavailable
- Secure API key storage

**Success Criteria**:
- Can switch between providers seamlessly
- Fallback works when Ollama unavailable
- API keys stored securely

### Phase 3: MCP Integration (Weeks 5-7)

**Goal**: Model Context Protocol servers for agent capabilities

**Tasks**:
- [ ] Implement MCP manager module
- [ ] Add stdio transport for MCP servers
- [ ] Integrate existing VibeCode MCP server
- [ ] Add Roundtable-AI MCP wrapper
- [ ] Create agent orchestration UI
- [ ] Implement tool calling interface
- [ ] Add resource subscription support

**Deliverables**:
- MCP servers connectable from Tauri
- Agent tasks can be created and monitored
- Tools from MCP servers callable

**Success Criteria**:
- Can connect to VibeCode MCP server
- Can invoke tools via MCP
- Agent orchestration working

### Phase 4: Agent Orchestration (Weeks 8-10)

**Goal**: Multi-agent coordination and Roundtable-AI integration

**Tasks**:
- [ ] Design agent task management system
- [ ] Implement parallel agent execution
- [ ] Add agent progress monitoring
- [ ] Create agent result aggregation
- [ ] Build agent task UI panel
- [ ] Add conflict detection for agents
- [ ] Implement task queuing for offline

**Deliverables**:
- Multi-agent task orchestration
- Visual agent progress tracking
- Integration reports from agents

**Success Criteria**:
- Can coordinate 5+ agents in parallel
- Agent tasks complete successfully
- Results aggregated properly

### Phase 5: Polish & Optimization (Weeks 11-12)

**Goal**: Production-ready AI features

**Tasks**:
- [ ] Performance optimization (caching, streaming)
- [ ] Error handling and retry logic
- [ ] Offline operation improvements
- [ ] Model download manager
- [ ] Usage analytics and monitoring
- [ ] Documentation and examples
- [ ] Security audit

**Deliverables**:
- Production-ready AI integration
- Comprehensive documentation
- Performance benchmarks

**Success Criteria**:
- <200ms latency for local completions
- <500ms for cloud completions
- 99.9% uptime for local models
- Full offline capability

---

## Code Examples

### Example 1: Code Completion

**Frontend**:
```typescript
import { invoke } from '@tauri-apps/api/core';

async function getCompletion(code: string, cursor: number) {
  try {
    const result = await invoke('ai_complete', {
      code,
      cursor,
      language: 'typescript',
      preferLocal: true,
    });

    return {
      text: result.completion,
      provider: result.provider,
      latency: result.latency_ms,
    };
  } catch (error) {
    console.error('Completion failed:', error);
    return null;
  }
}
```

**Backend** (Rust):
```rust
#[command]
pub async fn ai_complete(
    code: String,
    cursor: usize,
    language: String,
    prefer_local: bool,
) -> Result<serde_json::Value, String> {
    let start = std::time::Instant::now();

    let ai_manager = AIManager::global();
    let completion = ai_manager.complete_code(
        &code,
        cursor,
        &language,
        prefer_local
    ).await?;

    let latency = start.elapsed().as_millis() as u64;

    Ok(serde_json::json!({
        "completion": completion.text,
        "provider": completion.provider,
        "model": completion.model,
        "latency_ms": latency,
    }))
}
```

### Example 2: Streaming Chat

**Frontend**:
```typescript
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';

async function streamChat(messages: AIMessage[]) {
  const streamId = crypto.randomUUID();
  let fullResponse = '';

  // Listen for stream tokens
  const unlisten = await listen('ai:stream:token', (event) => {
    fullResponse += event.payload.token;
    updateUI(fullResponse);
  });

  // Listen for completion
  await listen('ai:stream:complete', (event) => {
    console.log('Stream complete:', event.payload);
    unlisten();
  });

  // Start stream
  await invoke('ai_chat_stream', {
    request: {
      messages,
      model: 'llama3.2:1b',
      provider: 'ollama',
    },
    streamId,
  });
}
```

**Backend** (Rust):
```rust
#[command]
pub async fn ai_chat_stream(
    request: AIChatRequest,
    stream_id: String,
) -> Result<String, String> {
    let ai_manager = AIManager::global();

    tokio::spawn(async move {
        match ai_manager.chat_stream_internal(request).await {
            Ok(mut stream) => {
                while let Some(token) = stream.next().await {
                    emit("ai:stream:token", json!({ "token": token, "stream_id": stream_id }));
                }
                emit("ai:stream:complete", json!({ "stream_id": stream_id }));
            }
            Err(e) => {
                emit("ai:stream:error", json!({ "error": e.to_string(), "stream_id": stream_id }));
            }
        }
    });

    Ok("Stream started".to_string())
}
```

### Example 3: Agent Orchestration

**Frontend**:
```typescript
import { invoke } from '@tauri-apps/api/core';

async function orchestrateAgents() {
  const task = {
    description: 'Implement new feature',
    agents: [
      {
        name: 'CodeBot',
        persona: 'typescript_expert',
        task: 'Write TypeScript code',
        scope: { directories: ['src/'] },
      },
      {
        name: 'TestBot',
        persona: 'quality_engineer',
        task: 'Write tests',
        scope: { directories: ['tests/'] },
      },
    ],
  };

  const taskId = await invoke('agent_create_task', { task });

  // Monitor progress
  const unlisten = await listen('agent:task:update', (event) => {
    console.log('Agent update:', event.payload);
  });

  return taskId;
}
```

---

## Testing Strategy

### Unit Tests (Rust)

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_ollama_available() {
        let ai_manager = AIManager::new();
        let status = ai_manager.check_local_models().await;

        assert!(status.is_ok());
    }

    #[tokio::test]
    async fn test_chat_fallback() {
        let ai_manager = AIManager::new();

        let request = AIChatRequest {
            messages: vec![
                AIMessage {
                    role: "user".to_string(),
                    content: "Hello".to_string(),
                }
            ],
            model: "test-model".to_string(),
            provider: "auto".to_string(),
            temperature: None,
            max_tokens: None,
        };

        let response = ai_manager.chat(request).await;
        assert!(response.is_ok());
    }
}
```

### Integration Tests

```bash
# Test AI chat end-to-end
cargo test --test ai_integration -- --nocapture

# Test MCP integration
cargo test --test mcp_integration -- --nocapture
```

### E2E Tests (Playwright)

```typescript
import { test, expect } from '@playwright/test';

test('AI code completion works', async ({ page }) => {
  await page.goto('http://localhost:1420');

  // Type some code
  await page.locator('.monaco-editor').fill('function hello');

  // Trigger completion
  await page.keyboard.press('Control+Space');

  // Wait for completion
  await expect(page.locator('.completion-item')).toBeVisible();
});
```

---

## Monitoring & Observability

### Metrics to Track

```rust
use prometheus::{IntCounter, Histogram};

lazy_static! {
    static ref AI_REQUESTS: IntCounter = IntCounter::new(
        "ai_requests_total",
        "Total AI requests"
    ).unwrap();

    static ref AI_LATENCY: Histogram = Histogram::new(
        "ai_latency_seconds",
        "AI request latency"
    ).unwrap();
}

pub async fn track_request<F, T>(f: F) -> Result<T, String>
where
    F: Future<Output = Result<T, String>>,
{
    AI_REQUESTS.inc();
    let start = std::time::Instant::now();

    let result = f.await;

    AI_LATENCY.observe(start.elapsed().as_secs_f64());

    result
}
```

### Logging

```rust
use tracing::{info, warn, error};

#[command]
pub async fn ai_chat(request: AIChatRequest) -> Result<AIChatResponse, String> {
    info!(
        provider = %request.provider,
        model = %request.model,
        "AI chat request started"
    );

    match AIManager::global().chat(request).await {
        Ok(response) => {
            info!(
                provider = %response.provider,
                tokens = ?response.tokens_used,
                "AI chat successful"
            );
            Ok(response)
        }
        Err(e) => {
            error!(error = %e, "AI chat failed");
            Err(e)
        }
    }
}
```

---

## Conclusion

This architecture provides a comprehensive foundation for AI features in the VibeCode Tauri desktop application. Key strengths:

1. **Offline-First**: Local models (Ollama) enable full functionality without internet
2. **Flexible Deployment**: Works with local, cloud, or hybrid AI execution
3. **Extensible**: MCP integration allows connecting any agent or tool
4. **Secure**: API keys in system keychain, local execution for privacy
5. **Performant**: Caching, streaming, and intelligent routing optimize UX

The phased implementation approach ensures incremental delivery of value while maintaining stability.

---

**Next Steps**:
1. Review and approve architecture
2. Begin Phase 1 implementation
3. Set up development environment (Ollama, MCP servers)
4. Create GitHub milestones for each phase
5. Update issue #683 with this architecture

**References**:
- [Tauri Commands Documentation](https://tauri.app/v2/guides/features/command/)
- [Ollama API Documentation](https://github.com/ollama/ollama/blob/main/docs/api.md)
- [Model Context Protocol Spec](https://modelcontextprotocol.io/)
- [Roundtable-AI MCP Proposal](/docs/wiki/proposals/roundtable-mcp-subagents.md)
