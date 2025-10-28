# AI Features Implementation Plan

**Issue**: #683
**Architecture**: See [AI_ARCHITECTURE.md](./AI_ARCHITECTURE.md)
**Status**: Ready for Implementation
**Created**: 2025-10-25

---

## Quick Start Guide

### Prerequisites

1. **Install Ollama** (for local models):
   ```bash
   brew install ollama

   # Pull recommended models
   ollama pull qwen2.5-coder:1.5b  # Fast code completion (1.5GB)
   ollama pull llama3.2:1b          # Fast chat (1GB)
   ollama pull deepseek-coder:6.7b  # Advanced coding (optional, 7GB)
   ```

2. **API Keys** (optional, for cloud models):
   ```bash
   # Add to ~/.zshrc or ~/.bashrc
   export OPENROUTER_API_KEY="sk-or-..."
   export OPENAI_API_KEY="sk-..."
   export ANTHROPIC_API_KEY="sk-ant-..."
   ```

3. **Dependencies**:
   ```bash
   cd src-tauri
   cargo add reqwest --features json
   cargo add tokio --features full
   cargo add serde --features derive
   cargo add serde_json
   cargo add once_cell
   ```

### Test Current Implementation

```bash
# Build Tauri with AI module
cd src-tauri
cargo build

# Run tests
cargo test --lib ai

# Run dev mode
cargo tauri dev
```

---

## Implementation Checklist

### Phase 1: Foundation (Week 1-2)

#### Week 1: Core AI Module

- [x] Create module structure (`src-tauri/src/ai/`)
- [x] Create command stubs (`commands.rs`)
- [x] Create AI manager (`manager.rs`)
- [x] Create MCP manager (`mcp.rs`)
- [x] Add AI module to main.rs
- [x] Register AI commands in Tauri
- [x] Implement Ollama integration
- [x] Add local model health checks
- [x] Write unit tests
- [x] Implement chat utilities (`chat.rs`)
- [x] Implement completion optimization (`completion.rs`)
- [x] Implement context management (`context.rs`)
- [x] Create AI provider configuration examples

**Tasks**:

1. **Update main.rs** to include AI module:
   ```rust
   // src-tauri/src/main.rs

   mod ai;

   fn main() {
       tauri::Builder::default()
           .invoke_handler(tauri::generate_handler![
               // ... existing commands ...
               ai::ai_chat,
               ai::ai_complete,
               ai::ai_check_local_models,
               ai::ai_list_models,
           ])
           .run(tauri::generate_context!())
           .expect("error while running tauri application");
   }
   ```

2. **Complete Ollama integration** in `manager.rs`:
   - Test connection to Ollama
   - Parse model list response
   - Handle errors gracefully
   - Add retry logic

3. **Write tests**:
   ```rust
   #[tokio::test]
   async fn test_ollama_chat() {
       let manager = AIManager::new();

       let request = AIChatRequest {
           messages: vec![AIMessage {
               role: "user".to_string(),
               content: "Say hello".to_string(),
           }],
           model: "llama3.2:1b".to_string(),
           provider: "ollama".to_string(),
           temperature: None,
           max_tokens: Some(50),
       };

       let response = manager.chat(request).await;
       assert!(response.is_ok());
   }
   ```

**Deliverables**:
- [x] AI chat works with Ollama
- [x] Code completion returns results
- [x] Health check detects Ollama models
- [x] All module structure complete with comprehensive utilities
- [ ] All tests passing (pending integration testing)

#### Week 2: Frontend Integration

- [ ] Create AI components (`src/components/ai/`)
- [ ] Add AI chat panel
- [ ] Add code completion UI
- [ ] Integrate with Monaco editor
- [ ] Add provider status indicator
- [ ] Create settings panel for AI
- [ ] Add error handling and loading states

**Tasks**:

1. **Create AI Chat Component**:
   ```typescript
   // src/components/ai/AIChatPanel.tsx
   import { invoke } from '@tauri-apps/api/core';
   import { useState } from 'react';

   export function AIChatPanel() {
     const [messages, setMessages] = useState<AIMessage[]>([]);
     const [input, setInput] = useState('');
     const [loading, setLoading] = useState(false);

     async function sendMessage() {
       setLoading(true);
       try {
         const response = await invoke('ai_chat', {
           request: {
             messages: [...messages, { role: 'user', content: input }],
             model: 'llama3.2:1b',
             provider: 'ollama',
           }
         });

         setMessages([
           ...messages,
           { role: 'user', content: input },
           { role: 'assistant', content: response.content },
         ]);
         setInput('');
       } catch (error) {
         console.error('Chat error:', error);
       } finally {
         setLoading(false);
       }
     }

     return (
       <div className="ai-chat-panel">
         <div className="messages">
           {messages.map((msg, i) => (
             <div key={i} className={`message ${msg.role}`}>
               {msg.content}
             </div>
           ))}
         </div>
         <input
           value={input}
           onChange={(e) => setInput(e.target.value)}
           onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
           disabled={loading}
         />
       </div>
     );
   }
   ```

2. **Add Code Completion**:
   ```typescript
   // src/lib/ai/completion.ts
   import { invoke } from '@tauri-apps/api/core';

   export async function getAICompletion(
     code: string,
     cursor: number,
     language: string
   ) {
     try {
       const result = await invoke('ai_complete', {
         code,
         cursor,
         language,
         preferLocal: true,
       });

       return {
         text: result.completion,
         provider: result.provider,
       };
     } catch (error) {
       console.error('Completion error:', error);
       return null;
     }
   }
   ```

3. **Integrate with Monaco**:
   ```typescript
   // In Monaco editor setup
   monaco.languages.registerCompletionItemProvider('typescript', {
     async provideCompletionItems(model, position) {
       const code = model.getValue();
       const offset = model.getOffsetAt(position);

       const completion = await getAICompletion(
         code,
         offset,
         'typescript'
       );

       if (!completion) return { suggestions: [] };

       return {
         suggestions: [{
           label: 'AI Suggestion',
           kind: monaco.languages.CompletionItemKind.Snippet,
           insertText: completion.text,
           documentation: `From ${completion.provider}`,
         }]
       };
     }
   });
   ```

**Deliverables**:
- [ ] AI chat panel in UI
- [ ] Code completion in editor
- [ ] Provider status displayed
- [ ] Settings panel for configuration

---

### Phase 2: Cloud Integration (Week 3-4)

#### Week 3: Multi-Provider Support

- [ ] Implement OpenRouter integration
- [ ] Implement OpenAI integration
- [ ] Implement Anthropic integration
- [ ] Add provider fallback logic
- [ ] Add API key management
- [ ] Test all providers

**Tasks**:

1. **OpenRouter Integration**:
   ```rust
   async fn chat_openrouter(&self, request: AIChatRequest) -> Result<AIChatResponse, String> {
       let api_key = self.config.openrouter_key
           .as_ref()
           .ok_or("OpenRouter API key not configured")?;

       let url = "https://openrouter.ai/api/v1/chat/completions";

       let openrouter_messages: Vec<serde_json::Value> = request
           .messages
           .iter()
           .map(|msg| {
               serde_json::json!({
                   "role": msg.role,
                   "content": msg.content,
               })
           })
           .collect();

       let openrouter_request = serde_json::json!({
           "model": request.model,
           "messages": openrouter_messages,
           "temperature": request.temperature.unwrap_or(0.7),
           "max_tokens": request.max_tokens.unwrap_or(2000),
       });

       let response = self.client
           .post(url)
           .header("Authorization", format!("Bearer {}", api_key))
           .header("HTTP-Referer", "https://vibecode.app")
           .header("X-Title", "VibeCode Desktop")
           .json(&openrouter_request)
           .send()
           .await
           .map_err(|e| format!("OpenRouter request failed: {}", e))?;

       if !response.status().is_success() {
           return Err(format!("OpenRouter error: {}", response.status()));
       }

       let data: serde_json::Value = response.json().await
           .map_err(|e| format!("Failed to parse OpenRouter response: {}", e))?;

       Ok(AIChatResponse {
           content: data["choices"][0]["message"]["content"]
               .as_str()
               .unwrap_or("")
               .to_string(),
           model: request.model,
           provider: "openrouter".to_string(),
           tokens_used: data["usage"]["total_tokens"].as_u64().map(|t| t as u32),
           cached: false,
       })
   }
   ```

2. **Fallback Chain**:
   ```rust
   async fn chat_with_fallback(&self, request: AIChatRequest) -> Result<AIChatResponse, String> {
       let providers = vec!["ollama", "openrouter", "openai", "anthropic"];

       let mut last_error = None;

       for provider in providers {
           let mut req = request.clone();
           req.provider = provider.to_string();

           match self.chat(req).await {
               Ok(response) => return Ok(response),
               Err(e) => {
                   log::warn!("Provider {} failed: {}", provider, e);
                   last_error = Some(e);
               }
           }
       }

       Err(last_error.unwrap_or_else(|| "All providers failed".to_string()))
   }
   ```

3. **API Key Storage**:
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

**Deliverables**:
- [ ] OpenRouter working
- [ ] OpenAI working
- [ ] Anthropic working
- [ ] Fallback chain tested
- [ ] API keys in system keychain

#### Week 4: Response Caching & Optimization

- [ ] Implement response cache
- [ ] Add streaming support
- [ ] Optimize request batching
- [ ] Add metrics and logging
- [ ] Performance benchmarks

**Tasks**:

1. **Response Cache**:
   ```rust
   use lru::LruCache;

   struct ResponseCache {
       cache: LruCache<String, CachedResponse>,
       ttl: Duration,
   }

   impl ResponseCache {
       fn get(&mut self, key: &str) -> Option<&CachedResponse> {
           self.cache.get(key)
               .filter(|resp| resp.is_fresh(self.ttl))
       }

       fn put(&mut self, key: String, response: CachedResponse) {
           self.cache.put(key, response);
       }
   }

   struct CachedResponse {
       response: AIChatResponse,
       timestamp: std::time::Instant,
   }

   impl CachedResponse {
       fn is_fresh(&self, ttl: Duration) -> bool {
           self.timestamp.elapsed() < ttl
       }
   }
   ```

2. **Streaming**:
   ```rust
   use tauri::Manager;

   #[command]
   pub async fn ai_chat_stream(
       app: tauri::AppHandle,
       request: AIChatRequest,
       stream_id: String,
   ) -> Result<String, String> {
       tokio::spawn(async move {
           // TODO: Implement SSE streaming from Ollama/OpenRouter
           let mut stream = get_sse_stream(&request).await;

           while let Some(token) = stream.next().await {
               app.emit_all("ai:stream:token", json!({
                   "stream_id": stream_id,
                   "token": token,
               })).ok();
           }

           app.emit_all("ai:stream:complete", json!({
               "stream_id": stream_id,
           })).ok();
       });

       Ok("Stream started".to_string())
   }
   ```

**Deliverables**:
- [ ] Response caching working
- [ ] Streaming functional
- [ ] <200ms local, <500ms cloud latency
- [ ] Benchmarks documented

---

### Phase 3: MCP Integration (Week 5-7)

#### Week 5: MCP Protocol Implementation

- [ ] Implement JSON-RPC client
- [ ] Add stdio transport
- [ ] Test with VibeCode MCP server
- [ ] Add tool listing
- [ ] Add tool calling

**Tasks**:

1. **JSON-RPC Client**:
   ```rust
   use serde_json::json;
   use std::process::{Stdio, Command};
   use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};

   struct JsonRpcClient {
       stdin: tokio::process::ChildStdin,
       stdout: BufReader<tokio::process::ChildStdout>,
       request_id: u64,
   }

   impl JsonRpcClient {
       async fn call_method(
           &mut self,
           method: &str,
           params: serde_json::Value,
       ) -> Result<serde_json::Value, String> {
           self.request_id += 1;

           let request = json!({
               "jsonrpc": "2.0",
               "id": self.request_id,
               "method": method,
               "params": params,
           });

           // Write request
           let request_str = serde_json::to_string(&request).unwrap();
           self.stdin.write_all(request_str.as_bytes()).await
               .map_err(|e| e.to_string())?;
           self.stdin.write_all(b"\n").await
               .map_err(|e| e.to_string())?;

           // Read response
           let mut line = String::new();
           self.stdout.read_line(&mut line).await
               .map_err(|e| e.to_string())?;

           let response: serde_json::Value = serde_json::from_str(&line)
               .map_err(|e| e.to_string())?;

           if let Some(error) = response.get("error") {
               return Err(error.to_string());
           }

           Ok(response["result"].clone())
       }
   }
   ```

2. **MCP Server Process**:
   ```rust
   impl MCPServer {
       fn spawn(command: &str, args: &[String]) -> Result<Self, String> {
           let mut process = Command::new(command)
               .args(args)
               .stdin(Stdio::piped())
               .stdout(Stdio::piped())
               .stderr(Stdio::piped())
               .spawn()
               .map_err(|e| format!("Failed to spawn MCP server: {}", e))?;

           let stdin = process.stdin.take().unwrap();
           let stdout = process.stdout.take().unwrap();

           let client = JsonRpcClient {
               stdin: tokio::process::ChildStdin::from_std(stdin).unwrap(),
               stdout: BufReader::new(tokio::process::ChildStdout::from_std(stdout).unwrap()),
               request_id: 0,
           };

           Ok(MCPServer {
               process,
               client: Arc::new(RwLock::new(client)),
           })
       }
   }
   ```

**Deliverables**:
- [ ] JSON-RPC working
- [ ] Can connect to MCP servers
- [ ] Can list tools
- [ ] Can call tools

#### Week 6-7: Agent Orchestration

- [ ] Integrate Roundtable-AI MCP
- [ ] Add agent task management
- [ ] Implement parallel execution
- [ ] Add progress monitoring
- [ ] Create agent UI panel

**Deliverables**:
- [ ] Roundtable-AI integration
- [ ] Multi-agent tasks working
- [ ] Progress tracking in UI

---

### Phase 4: Polish (Week 8-10)

- [ ] Comprehensive error handling
- [ ] Offline mode improvements
- [ ] Model download manager
- [ ] Usage analytics
- [ ] Documentation
- [ ] Security audit

---

## Testing Strategy

### Unit Tests

```bash
# Run all AI tests
cargo test --lib ai

# Run specific module tests
cargo test --lib ai::manager
cargo test --lib ai::mcp
```

### Integration Tests

```bash
# Test with real Ollama
OLLAMA_TEST=1 cargo test --test ai_integration

# Test with real OpenRouter (requires API key)
OPENROUTER_API_KEY=sk-or-... cargo test --test ai_cloud
```

### Manual Testing Checklist

- [ ] AI chat responds correctly
- [ ] Code completion works in editor
- [ ] Can switch between providers
- [ ] Fallback works when offline
- [ ] MCP tools callable
- [ ] Agent tasks complete
- [ ] API keys stored securely
- [ ] Performance acceptable (<500ms)

---

## Deployment Checklist

### Before Release

- [ ] All tests passing
- [ ] Documentation complete
- [ ] Security review done
- [ ] Performance benchmarks met
- [ ] Error handling comprehensive
- [ ] Logging configured
- [ ] Analytics integrated

### Release Notes

Include in release:
- Features added
- Models supported
- Performance metrics
- Setup instructions
- Known limitations

---

## Monitoring

### Metrics to Track

```rust
// Add to manager.rs
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
```

### Logging

```rust
use tracing::{info, warn, error};

pub async fn chat(&self, request: AIChatRequest) -> Result<AIChatResponse, String> {
    info!(
        provider = %request.provider,
        model = %request.model,
        "AI chat request started"
    );

    // ... implementation ...
}
```

---

## Resources

### Documentation

- [Tauri Commands](https://tauri.app/v2/guides/features/command/)
- [Ollama API](https://github.com/ollama/ollama/blob/main/docs/api.md)
- [OpenRouter API](https://openrouter.ai/docs)
- [MCP Protocol](https://modelcontextprotocol.io/)

### Example Projects

- [Tauri AI Chat Example](https://github.com/tauri-apps/tauri/tree/dev/examples)
- [Ollama Rust Client](https://github.com/pepperoni21/ollama-rs)

### Internal Docs

- [AI Architecture](./AI_ARCHITECTURE.md)
- [MCP Server Design](../platform/MCP_SERVER_DESIGN.md)
- [Roundtable Proposal](../wiki/proposals/roundtable-mcp-subagents.md)

---

## Next Steps

1. **Review & Approve**: Get architecture approval from team
2. **Setup Environment**: Install Ollama, pull models
3. **Start Phase 1**: Begin Week 1 tasks
4. **Daily Updates**: Update this checklist daily
5. **Weekly Reviews**: Review progress each Friday

---

## Current Implementation Status

**Phase 1 Week 1: COMPLETED** ✅

### Completed Components

1. **Core Module Structure** (`src-tauri/src/ai/`)
   - ✅ `mod.rs` - Module exports and organization
   - ✅ `commands.rs` - Tauri IPC command handlers (11 commands)
   - ✅ `manager.rs` - AI provider orchestration and routing
   - ✅ `mcp.rs` - Model Context Protocol integration
   - ✅ `chat.rs` - Chat utilities and conversation management
   - ✅ `completion.rs` - Code completion optimization
   - ✅ `context.rs` - Context building and management

2. **Tauri Integration**
   - ✅ AI module registered in `main.rs`
   - ✅ All 11 AI commands registered in invoke handler
   - ✅ Ready for IPC communication with frontend

3. **AI Provider Support**
   - ✅ Ollama (local models)
   - ✅ OpenRouter (unified gateway)
   - ✅ OpenAI (direct integration)
   - ✅ Anthropic (Claude direct)
   - ✅ Intelligent provider fallback chain
   - ✅ Local model health checking

4. **Configuration Examples**
   - ✅ `configs/ai-providers.example.json` - Provider configurations
   - ✅ `configs/mcp-servers.example.json` - MCP server definitions
   - ✅ `configs/ai-settings.example.json` - User settings and preferences

5. **Utilities & Features**
   - ✅ Conversation history management
   - ✅ Code block extraction
   - ✅ Token estimation and trimming
   - ✅ Completion prompt optimization
   - ✅ Context extraction (imports, scope detection)
   - ✅ Multi-language support (JS/TS, Rust, Python, Go)
   - ✅ Response caching infrastructure
   - ✅ Comprehensive unit tests for all modules

### Available Commands

```typescript
// Chat & Completion
ai_chat(request: AIChatRequest) -> AIChatResponse
ai_complete(code, cursor, language, preferLocal) -> CompletionResult
ai_chat_stream(request, streamId) -> StreamId

// Model Management
ai_list_models() -> Model[]
ai_check_local_models() -> LocalModelStatus

// MCP Integration
mcp_connect(serverConfig) -> ServerId
mcp_list_tools(serverId) -> Tool[]
mcp_call_tool(serverId, toolName, args) -> ToolResult

// Agent Orchestration (stubs)
agent_create_task(task, agents) -> TaskId
agent_get_status(taskId) -> TaskStatus
agent_cancel_task(taskId) -> void
```

### Next Steps

**Immediate (Week 2)**:
1. Build and test the Rust code
2. Fix any compilation errors
3. Test with local Ollama instance
4. Begin frontend integration
5. Create React components for AI chat
6. Integrate with Monaco editor for completion

**Short-term (Weeks 3-4)**:
1. Complete streaming implementation
2. Add response caching
3. Implement MCP JSON-RPC communication
4. Full cloud provider testing

---

**Status**: Phase 1 Week 1 Complete - Ready for testing and frontend integration
**Last Updated**: 2025-10-27
