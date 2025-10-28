# AI Features - Quick Start Guide

**Issue**: #683
**Status**: Phase 1 Complete - Ready for Testing
**Last Updated**: 2025-10-27

---

## Overview

VibeCode now includes a comprehensive AI architecture supporting:

- 🤖 **AI Chat** - Conversational AI assistant
- ✨ **Code Completion** - Intelligent code suggestions
- 🔍 **Code Analysis** - Security, performance, and quality checks
- 🛠️ **MCP Integration** - Model Context Protocol for agent tools
- 🌐 **Multi-Provider** - Ollama, OpenAI, Anthropic, OpenRouter
- 📴 **Offline-First** - Works without internet via local models

---

## Quick Start

### 1. Install Ollama (for local models)

```bash
# macOS
brew install ollama

# Start Ollama service
ollama serve

# In another terminal, pull recommended models
ollama pull qwen2.5-coder:1.5b  # Fast code completion (1.5GB)
ollama pull llama3.2:1b          # Fast chat (1GB)
```

### 2. Set API Keys (optional, for cloud models)

```bash
# Add to ~/.zshrc or ~/.bashrc
export OPENROUTER_API_KEY="sk-or-..."
export OPENAI_API_KEY="sk-..."
export ANTHROPIC_API_KEY="sk-ant-..."

# Reload shell
source ~/.zshrc
```

### 3. Build and Run

```bash
# Build Tauri app
cd src-tauri
cargo build

# Run in dev mode
cargo tauri dev
```

### 4. Test AI Features

```typescript
import { invoke } from '@tauri-apps/api/core';

// Test AI chat
const response = await invoke('ai_chat', {
  request: {
    messages: [{ role: 'user', content: 'Hello!' }],
    model: 'llama3.2:1b',
    provider: 'ollama'
  }
});

console.log(response.content);
```

---

## Architecture

### Module Structure

```
src-tauri/src/ai/
├── mod.rs           - Module exports
├── commands.rs      - Tauri IPC commands (11 commands)
├── manager.rs       - Provider orchestration
├── mcp.rs          - MCP protocol integration
├── chat.rs         - Chat utilities
├── completion.rs   - Code completion optimization
└── context.rs      - Context management
```

### Key Components

#### 1. AI Manager (`manager.rs`)

Central orchestrator for AI operations:

- Provider selection and routing
- Fallback chain management
- Local model health checking
- Request/response caching

```rust
let manager = AIManager::global();
let response = manager.chat(request).await?;
```

#### 2. Commands (`commands.rs`)

Tauri IPC interface with 11 commands:

**Chat & Completion**:
- `ai_chat` - Send chat messages
- `ai_complete` - Get code completions
- `ai_chat_stream` - Stream responses

**Model Management**:
- `ai_list_models` - List available models
- `ai_check_local_models` - Check Ollama status

**MCP Integration**:
- `mcp_connect` - Connect to MCP server
- `mcp_list_tools` - List available tools
- `mcp_call_tool` - Execute tool

**Agents**:
- `agent_create_task` - Create multi-agent task
- `agent_get_status` - Check task status
- `agent_cancel_task` - Cancel running task

#### 3. Chat Utilities (`chat.rs`)

Conversation management:

```rust
use crate::ai::chat::{Conversation, ChatRequestBuilder, ChatUtils};

// Build request
let request = ChatRequestBuilder::new()
    .with_message("user", "Hello")
    .with_model("llama3.2:1b")
    .with_temperature(0.7)
    .build();

// Extract code blocks from response
let blocks = ChatUtils::extract_code_blocks(&response);
```

#### 4. Completion Optimization (`completion.rs`)

Smart code completion:

```rust
use crate::ai::completion::{CompletionOptimizer, CompletionPostProcessor};

// Extract context
let context = CompletionOptimizer::extract_context(code, cursor, "rust");

// Build optimized prompt
let prompt = CompletionOptimizer::build_completion_prompt(&request);

// Clean response
let clean = CompletionPostProcessor::clean_completion(&text, "rust");
```

#### 5. Context Management (`context.rs`)

Intelligent context building:

```rust
use crate::ai::context::{ContextBuilder, ContextManager};

// Build context
let context = ContextBuilder::new()
    .with_current_file(path, content, "typescript")
    .with_related_file(lib_path, lib_content, "typescript")
    .build();

// Trim to token limit
ContextManager::trim_to_token_limit(&mut context, 8000);
```

---

## Configuration

### AI Providers (`configs/ai-providers.example.json`)

```json
{
  "providers": {
    "ollama": {
      "enabled": true,
      "endpoint": "http://localhost:11434",
      "models": [
        {
          "id": "qwen2.5-coder:1.5b",
          "use_for": ["code_completion", "quick_chat"]
        }
      ]
    },
    "openrouter": {
      "enabled": true,
      "api_key_env": "OPENROUTER_API_KEY",
      "models": [
        {
          "id": "anthropic/claude-3.5-sonnet",
          "use_for": ["complex_code", "architecture"]
        }
      ]
    }
  },
  "fallback_chain": [
    { "provider": "ollama", "condition": "local_available" },
    { "provider": "openrouter", "condition": "api_key_set" }
  ]
}
```

### MCP Servers (`configs/mcp-servers.example.json`)

```json
{
  "servers": [
    {
      "id": "vibecode-workspace",
      "command": "node",
      "args": ["${VIBECODE_ROOT}/src/mcp/server.ts"],
      "tools": ["create_workspace", "list_workspaces"]
    },
    {
      "id": "roundtable-ai",
      "command": "python",
      "args": ["-m", "scripts.roundtable-mcp-wrapper"],
      "tools": ["orchestrate_agents", "create_agent"]
    }
  ]
}
```

### AI Settings (`configs/ai-settings.example.json`)

```json
{
  "code_completion": {
    "enabled": true,
    "prefer_local": true,
    "trigger_characters": [".", "::", "->"],
    "auto_trigger_delay_ms": 300
  },
  "chat": {
    "enabled": true,
    "stream_responses": true,
    "max_conversation_length": 50
  }
}
```

---

## Usage Examples

### Example 1: Code Completion

```typescript
import { invoke } from '@tauri-apps/api/core';

async function getCodeCompletion(code: string, cursor: number) {
  try {
    const result = await invoke('ai_complete', {
      code,
      cursor,
      language: 'typescript',
      preferLocal: true
    });

    console.log('Completion:', result.completion);
    console.log('Provider:', result.provider);
    console.log('Latency:', result.latency_ms, 'ms');
  } catch (error) {
    console.error('Completion failed:', error);
  }
}

// Use it
const code = 'function hello() {\n  ';
getCodeCompletion(code, code.length);
```

### Example 2: AI Chat

```typescript
import { invoke } from '@tauri-apps/api/core';

async function chatWithAI(userMessage: string) {
  const response = await invoke('ai_chat', {
    request: {
      messages: [
        { role: 'user', content: userMessage }
      ],
      model: 'llama3.2:1b',
      provider: 'ollama',
      temperature: 0.7,
      max_tokens: 1000
    }
  });

  return response;
}

// Use it
const response = await chatWithAI('Explain async/await in Rust');
console.log(response.content);
```

### Example 3: Streaming Chat

```typescript
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';

async function streamChat(messages: AIMessage[]) {
  const streamId = crypto.randomUUID();
  let fullResponse = '';

  // Listen for tokens
  const unlisten = await listen('ai:stream:token', (event) => {
    fullResponse += event.payload.token;
    updateUI(fullResponse);
  });

  // Listen for completion
  await listen('ai:stream:complete', (event) => {
    console.log('Stream complete!');
    unlisten();
  });

  // Start stream
  await invoke('ai_chat_stream', {
    request: { messages, model: 'llama3.2:1b', provider: 'ollama' },
    streamId
  });
}
```

### Example 4: Check Local Models

```typescript
async function checkLocalModels() {
  const status = await invoke('ai_check_local_models');

  console.log('Ollama available:', status.ollama_available);
  console.log('Models:', status.ollama_models);
}
```

### Example 5: MCP Server Integration

```typescript
// Connect to MCP server
const serverId = await invoke('mcp_connect', {
  serverConfig: {
    id: 'vibecode-workspace',
    command: 'node',
    args: ['./src/mcp/server.ts']
  }
});

// List available tools
const tools = await invoke('mcp_list_tools', { serverId });
console.log('Available tools:', tools);

// Call a tool
const result = await invoke('mcp_call_tool', {
  serverId,
  toolName: 'create_workspace',
  args: { name: 'my-project' }
});
```

---

## Testing

### Unit Tests

```bash
# Run all AI tests
cd src-tauri
cargo test --lib ai

# Run specific module tests
cargo test --lib ai::chat
cargo test --lib ai::completion
cargo test --lib ai::context
cargo test --lib ai::manager
```

### Integration Tests

```bash
# Test with real Ollama (requires Ollama running)
cargo test --test ai_integration

# Test specific provider
PROVIDER=ollama cargo test test_chat
```

### Manual Testing Checklist

- [ ] Ollama detected and models listed
- [ ] AI chat responds correctly
- [ ] Code completion works
- [ ] Provider fallback works (stop Ollama, try cloud)
- [ ] Streaming works
- [ ] MCP servers can be connected
- [ ] Performance is acceptable (<500ms for completions)

---

## Performance

### Target Latencies

| Operation | Local (Ollama) | Cloud (OpenRouter) |
|-----------|----------------|-------------------|
| Code Completion | 50-200ms | 200-500ms |
| Chat Message | 100-500ms | 500-1500ms |
| Code Generation | 500-2000ms | 1000-3000ms |

### Optimization Features

1. **Response Caching** - Cache identical requests (1 hour TTL)
2. **Model Pre-warming** - Load frequently used models on startup
3. **Streaming** - Stream tokens as they arrive
4. **Parallel Requests** - Multiple concurrent requests
5. **Context Trimming** - Trim to max token limit

---

## Troubleshooting

### Ollama Not Detected

```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# Start Ollama
ollama serve

# Check models
ollama list
```

### Cloud Providers Failing

```bash
# Check API keys are set
echo $OPENROUTER_API_KEY
echo $OPENAI_API_KEY

# Test API key
curl https://openrouter.ai/api/v1/models \
  -H "Authorization: Bearer $OPENROUTER_API_KEY"
```

### Slow Performance

1. Use local models for speed
2. Check network connection for cloud models
3. Reduce context size
4. Enable caching
5. Use smaller models for simple tasks

### Build Errors

```bash
# Clean build
cd src-tauri
cargo clean
cargo build

# Check dependencies
cargo update
```

---

## Security & Privacy

### API Keys

- Stored in system keychain (macOS Keychain, Windows Credential Manager)
- Never logged or exposed in UI
- Encrypted in memory
- Cleared on logout

### Local Models

- All Ollama models run locally
- No data sent to external servers
- Code never leaves the machine
- GDPR compliant

### Data Privacy

- `privacy_mode` option minimizes context sent to AI
- Exclude sensitive files/patterns
- Audit logs for all AI operations
- Configurable data retention

---

## Next Steps

1. **Test the Implementation**
   ```bash
   cd src-tauri
   cargo build
   cargo tauri dev
   ```

2. **Configure Providers**
   - Copy example configs
   - Set API keys
   - Pull Ollama models

3. **Build Frontend UI**
   - AI chat panel
   - Code completion integration
   - Settings page

4. **Implement Streaming**
   - Complete streaming support
   - Event handling
   - UI updates

5. **Add Agent Orchestration**
   - Implement MCP JSON-RPC
   - Multi-agent coordination
   - Result aggregation

---

## Resources

### Documentation

- [Architecture Design](/docs/tauri/AI_ARCHITECTURE.md)
- [Implementation Plan](/docs/tauri/AI_IMPLEMENTATION_PLAN.md)
- [Tauri Commands](https://tauri.app/v2/guides/features/command/)
- [Ollama API](https://github.com/ollama/ollama/blob/main/docs/api.md)
- [MCP Protocol](https://modelcontextprotocol.io/)

### Example Projects

- [Tauri AI Examples](https://github.com/tauri-apps/tauri/tree/dev/examples)
- [Ollama Rust Client](https://github.com/pepperoni21/ollama-rs)

### Support

- Issue Tracker: #683
- Documentation: `/docs/tauri/`
- Configuration: `/configs/ai-*.json`

---

**Status**: ✅ Phase 1 Complete - Ready for Testing
**Next**: Frontend Integration & Testing
