# AI Features Architecture Design
**Date**: 2025-10-25
**Status**: Design Phase
**Related Issue**: #683

## Problem Statement

The Next.js web app has AI features (chat, code completion, multi-modal), but the Tauri desktop app redirects to code-server. We need to define how AI features integrate with the desktop architecture.

## Current State

### Next.js App (Web)
```
src/app/api/ai/
├── chat/
│   └── route.ts          # AI chat endpoint
├── completion/
│   └── route.ts          # Code completion
├── multimodal/
│   └── route.ts          # Vision, audio, etc.
└── streaming/
    └── route.ts          # Streaming responses
```

**Features**:
- OpenRouter/OpenAI/Anthropic integration
- Streaming chat responses
- Code completion suggestions
- Multi-modal capabilities (vision, audio)
- Context-aware assistance

### Tauri App (Desktop)
```
Tauri Shell → WebView → code-server (localhost:8080)
```

**Gap**: No AI features in desktop app!

## Architecture Options

### Option 1: Dual-Pane UI ⭐ RECOMMENDED

```
┌─────────────────────────────────────────┐
│   Tauri Window                          │
├──────────────────┬──────────────────────┤
│                  │                      │
│  code-server     │   AI Panel           │
│  (Main Editor)   │   (Sidebar)          │
│                  │                      │
│  - Edit code     │   - Chat interface   │
│  - Terminal      │   - Code completion  │
│  - Extensions    │   - Context display  │
│  - File tree     │   - Multi-modal      │
│                  │   - History          │
│                  │                      │
│  70-80% width    │   20-30% width       │
└──────────────────┴──────────────────────┘
```

**Pros**:
- ✅ Clean separation of concerns
- ✅ AI always visible
- ✅ Easy to implement
- ✅ Familiar UX (like Cursor, GitHub Copilot)
- ✅ Can resize/hide panel

**Cons**:
- ⚠️ Reduces editor space
- ⚠️ Need IPC between panels
- ⚠️ More complex layout

**Implementation**:
```rust
// Tauri main.rs
tauri::Builder::default()
    .setup(|app| {
        // Create main window with split view
        let window = tauri::WindowBuilder::new(
            app,
            "main",
            tauri::WindowUrl::App("index.html".into())
        )
        .title("VibeCode")
        .inner_size(1400.0, 900.0)
        .build()?;
        
        Ok(())
    })
```

```html
<!-- index.html -->
<div class="app-container">
  <div class="editor-pane">
    <iframe src="http://localhost:8080"></iframe>
  </div>
  <div class="ai-pane">
    <div id="ai-chat"></div>
    <div id="ai-completion"></div>
  </div>
</div>
```

### Option 2: VS Code Extension

```
code-server
├── Extensions
│   └── vibecode-ai/
│       ├── chat-panel.ts
│       ├── completion-provider.ts
│       └── multimodal.ts
```

**Pros**:
- ✅ Native VS Code integration
- ✅ Uses VS Code extension API
- ✅ Familiar to VS Code users
- ✅ Can use VS Code UI components

**Cons**:
- ⚠️ Limited to VS Code extension API
- ⚠️ Harder to customize UI
- ⚠️ Extension development complexity
- ⚠️ Deployment complexity

**Implementation**:
- Create VS Code extension
- Package with code-server
- Auto-install on first launch

### Option 3: Background Service

```
┌─────────────────────────────────────┐
│   Tauri Shell                       │
│                                     │
│   ┌─────────────────────────────┐  │
│   │  code-server (localhost:8080)│  │
│   └─────────────────────────────┘  │
│                                     │
│   ┌─────────────────────────────┐  │
│   │  AI Service (localhost:3001) │  │
│   │  - Chat API                  │  │
│   │  - Completion API            │  │
│   │  - Multimodal API            │  │
│   └─────────────────────────────┘  │
└─────────────────────────────────────┘
```

**Pros**:
- ✅ Clean separation
- ✅ Easy to test independently
- ✅ Can use existing Next.js API
- ✅ Microservices architecture

**Cons**:
- ⚠️ Need to manage two servers
- ⚠️ More complex deployment
- ⚠️ IPC overhead
- ⚠️ UI integration unclear

### Option 4: Hybrid Tabs

```
┌─────────────────────────────────────┐
│   Tauri Window                      │
│   ┌───┬───┬───┐                     │
│   │ 1 │ 2 │ 3 │  Tabs               │
│   └───┴───┴───┘                     │
│                                     │
│   Tab 1: code-server                │
│   Tab 2: AI Chat                    │
│   Tab 3: Settings                   │
└─────────────────────────────────────┘
```

**Pros**:
- ✅ Simple to implement
- ✅ Full screen for each view
- ✅ Easy to switch

**Cons**:
- ⚠️ Context switching overhead
- ⚠️ Can't see AI and code simultaneously
- ⚠️ Less integrated feel

## Recommended Architecture: Dual-Pane UI

### High-Level Design

```
┌──────────────────────────────────────────────────────┐
│                  Tauri Desktop Shell                 │
│                                                      │
│  ┌────────────────────┬──────────────────────────┐  │
│  │                    │                          │  │
│  │  code-server       │   AI Panel (React)       │  │
│  │  (iframe)          │                          │  │
│  │                    │   ┌──────────────────┐   │  │
│  │  localhost:8080    │   │  Chat Interface  │   │  │
│  │                    │   ├──────────────────┤   │  │
│  │                    │   │  Code Context    │   │  │
│  │                    │   ├──────────────────┤   │  │
│  │                    │   │  Suggestions     │   │  │
│  │                    │   ├──────────────────┤   │  │
│  │                    │   │  History         │   │  │
│  │                    │   └──────────────────┘   │  │
│  │                    │                          │  │
│  └────────────────────┴──────────────────────────┘  │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │         AI Backend Service (Rust)            │   │
│  │  - OpenRouter/OpenAI/Anthropic clients      │   │
│  │  - Context management                        │   │
│  │  - Streaming responses                       │   │
│  └──────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────┘
```

### Component Breakdown

#### 1. Tauri Shell (Rust)
**Responsibilities**:
- Window management
- IPC between components
- AI backend service
- File system access
- System integration

**Key Files**:
```
src-tauri/
├── src/
│   ├── main.rs           # App entry point
│   ├── ai/
│   │   ├── mod.rs        # AI module
│   │   ├── chat.rs       # Chat service
│   │   ├── completion.rs # Completion service
│   │   └── multimodal.rs # Multimodal service
│   └── commands.rs       # Tauri commands
```

#### 2. AI Panel (React/TypeScript)
**Responsibilities**:
- Chat UI
- Code context display
- Suggestion rendering
- User interactions

**Key Files**:
```
src/components/ai/
├── AIPanel.tsx           # Main panel
├── ChatInterface.tsx     # Chat UI
├── CodeContext.tsx       # Context display
├── Suggestions.tsx       # Suggestions list
└── History.tsx           # Chat history
```

#### 3. AI Backend (Rust)
**Responsibilities**:
- API client management
- Request/response handling
- Streaming
- Context building
- Caching

**Dependencies**:
```toml
[dependencies]
reqwest = { version = "0.11", features = ["json", "stream"] }
tokio = { version = "1", features = ["full"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
```

### Data Flow

#### Chat Request Flow
```
1. User types in AI Panel
2. React → Tauri IPC (invoke)
3. Tauri AI Service → OpenRouter API
4. Stream response back
5. Tauri → React (events)
6. React updates UI
```

#### Code Completion Flow
```
1. User types in code-server
2. code-server → Tauri (via postMessage)
3. Tauri AI Service → OpenAI API
4. Get completion
5. Tauri → code-server
6. code-server shows suggestion
```

### IPC Protocol

#### Commands (React → Rust)
```typescript
// Chat
await invoke('ai_chat', {
  message: string,
  context: CodeContext,
  model: string
});

// Completion
await invoke('ai_complete', {
  code: string,
  cursor: Position,
  language: string
});

// Multimodal
await invoke('ai_analyze_image', {
  image: Uint8Array,
  prompt: string
});
```

#### Events (Rust → React)
```typescript
// Streaming chat response
listen('ai-chat-chunk', (event) => {
  const chunk = event.payload;
  appendToChat(chunk);
});

// Completion ready
listen('ai-completion', (event) => {
  const completion = event.payload;
  showSuggestion(completion);
});
```

### API Integration

#### OpenRouter
```rust
pub async fn chat_openrouter(
    message: &str,
    context: &CodeContext,
    model: &str
) -> Result<String, Error> {
    let client = reqwest::Client::new();
    let response = client
        .post("https://openrouter.ai/api/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&json!({
            "model": model,
            "messages": build_messages(message, context),
            "stream": true
        }))
        .send()
        .await?;
    
    // Handle streaming response
    Ok(response)
}
```

#### OpenAI
```rust
pub async fn complete_openai(
    code: &str,
    cursor: Position,
    language: &str
) -> Result<String, Error> {
    let client = reqwest::Client::new();
    let response = client
        .post("https://api.openai.com/v1/completions")
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&json!({
            "model": "gpt-4",
            "prompt": build_prompt(code, cursor, language),
            "max_tokens": 100
        }))
        .send()
        .await?;
    
    Ok(response.json().await?)
}
```

### Context Management

#### Code Context
```rust
pub struct CodeContext {
    pub file_path: String,
    pub language: String,
    pub code: String,
    pub cursor_position: Position,
    pub selection: Option<Range>,
    pub open_files: Vec<String>,
    pub git_diff: Option<String>,
}

impl CodeContext {
    pub fn from_editor(editor_state: &EditorState) -> Self {
        // Extract context from code-server
    }
    
    pub fn to_prompt(&self) -> String {
        // Convert to LLM prompt
    }
}
```

### UI Components

#### AI Panel Layout
```tsx
export function AIPanel() {
  return (
    <div className="ai-panel">
      <Tabs>
        <Tab label="Chat">
          <ChatInterface />
        </Tab>
        <Tab label="Context">
          <CodeContext />
        </Tab>
        <Tab label="History">
          <ChatHistory />
        </Tab>
      </Tabs>
    </div>
  );
}
```

#### Chat Interface
```tsx
export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  
  const sendMessage = async () => {
    const context = await getCodeContext();
    await invoke('ai_chat', {
      message: input,
      context,
      model: 'anthropic/claude-3-opus'
    });
  };
  
  return (
    <div className="chat">
      <MessageList messages={messages} />
      <Input value={input} onChange={setInput} onSend={sendMessage} />
    </div>
  );
}
```

## Implementation Plan

### Phase 1: Basic Infrastructure (1 week)
- [ ] Create AI module in Tauri
- [ ] Set up IPC commands
- [ ] Create React AI panel component
- [ ] Implement basic layout

### Phase 2: Chat Feature (1 week)
- [ ] OpenRouter integration
- [ ] Streaming responses
- [ ] Chat UI
- [ ] Message history

### Phase 3: Code Completion (1 week)
- [ ] OpenAI integration
- [ ] Context extraction
- [ ] Completion suggestions
- [ ] UI integration

### Phase 4: Context Management (1 week)
- [ ] File context
- [ ] Git context
- [ ] Selection context
- [ ] Smart context building

### Phase 5: Polish & Testing (1 week)
- [ ] Error handling
- [ ] Loading states
- [ ] Keyboard shortcuts
- [ ] Performance optimization

**Total**: 5 weeks (part of 8-10 week Milestone 3)

## Success Criteria

### Must Have
- [ ] Chat with AI about code
- [ ] Get code completions
- [ ] Context-aware responses
- [ ] Fast (<2s response time)
- [ ] Reliable (>99% uptime)

### Nice to Have
- [ ] Multi-modal (images, audio)
- [ ] Voice input
- [ ] Code refactoring suggestions
- [ ] Automated testing generation

## Next Steps

### This Week
1. [ ] Create AI module structure
2. [ ] Implement basic IPC
3. [ ] Create AI panel UI
4. [ ] Test OpenRouter integration

### Next Week
1. [ ] Implement chat feature
2. [ ] Add streaming support
3. [ ] Build context extraction
4. [ ] Test end-to-end

---

**Status**: 📋 Design complete
**Next**: Start Phase 1 implementation
**Owner**: Development team
**Timeline**: 5 weeks
