# Monaco Agent API Quick Start Guide

**Quick reference for integrating Agent API with Monaco Editor**

## 5-Minute Setup

### 1. Install Dependencies
```bash
# Already in package.json
npm install monaco-editor @monaco-editor/react
```

### 2. Import Components
```typescript
import { MonacoAgentAPI, registerMonacoAgentProviders } from '@/lib/editor/monaco-agentapi'
import { AgentMonacoEditor } from '@/components/editor/AgentMonacoEditor'
```

### 3. Use React Component (Easiest)
```tsx
export default function MyEditor() {
  const [code, setCode] = useState('// Write code here')

  return (
    <AgentMonacoEditor
      value={code}
      language="typescript"
      onChange={setCode}
      enableAgent={true}
    />
  )
}
```

### 4. Or Manual Setup
```typescript
import Editor from '@monaco-editor/react'
import { MonacoAgentAPI, registerMonacoAgentProviders } from '@/lib/editor/monaco-agentapi'

function MyEditor() {
  const handleEditorDidMount = async (editor, monaco) => {
    // Initialize agent API
    const agentAPI = new MonacoAgentAPI(editor, {
      baseUrl: '/api/agents',
      model: 'claude-3-5-sonnet-20241022',
    })

    await agentAPI.initialize()

    // Register providers
    const providers = registerMonacoAgentProviders(monaco, 'typescript', agentAPI)

    // Cleanup on unmount
    return () => {
      agentAPI.dispose()
      providers.forEach(p => p.dispose())
    }
  }

  return (
    <Editor
      height="600px"
      language="typescript"
      onMount={handleEditorDidMount}
    />
  )
}
```

## Common Tasks

### Request Completion
```typescript
// Trigger manually
editor.trigger('keyboard', 'editor.action.triggerSuggest', {})

// Or via agent API
const completions = await agentAPI.requestCompletions(position, context)
```

### Show Hover Info
```typescript
// Trigger manually
editor.trigger('keyboard', 'editor.action.showHover', {})

// Or via agent API
const hover = await agentAPI.requestHover(position)
```

### Apply Code Action
```typescript
// Trigger manually
editor.trigger('keyboard', 'editor.action.quickFix', {})

// Or via agent API
const actions = await agentAPI.requestCodeActions(range, context)
```

### Apply Agent Suggestion
```typescript
await agentAPI.applySuggestion({
  text: 'const newCode = "value"',
  range: {
    startLineNumber: 1,
    startColumn: 1,
    endLineNumber: 1,
    endColumn: 1,
  }
})
```

## Configuration

### Default Config
```typescript
{
  baseUrl: '/api/agents',
  wsUrl: '/api/agents/ws',
  model: 'claude-3-5-sonnet-20241022',
  debug: false,
  completionTimeout: 300,
  enableInlineSuggestions: true,
  enableDiagnostics: true,
  diagnosticsDebounce: 1000,
}
```

### Custom Config
```typescript
const agentAPI = new MonacoAgentAPI(editor, {
  baseUrl: 'https://api.example.com',
  model: 'gpt-4o',
  completionTimeout: 500,
  enableDiagnostics: false, // Disable diagnostics
  debug: true, // Enable debug logging
})
```

## Keybindings

| Action | Windows/Linux | macOS |
|--------|---------------|-------|
| Trigger Completion | Ctrl+Space | Cmd+Space |
| Show Hover | Ctrl+K Ctrl+I | Cmd+K Cmd+I |
| Quick Fix | Ctrl+. | Cmd+. |

## Custom Keybindings
```typescript
editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK, () => {
  // Your custom action
})
```

## Language Support

### Currently Supported
- TypeScript/JavaScript
- Python
- Extensible to other languages

### Add Language Support
```typescript
// Register providers for your language
const providers = registerMonacoAgentProviders(monaco, 'python', agentAPI)
```

## Performance Tips

### 1. Debounce Diagnostics
```typescript
{
  diagnosticsDebounce: 2000 // Wait 2s before running diagnostics
}
```

### 2. Disable Features
```typescript
{
  enableInlineSuggestions: false, // If too distracting
  enableDiagnostics: false, // If too slow
}
```

### 3. Adjust Timeout
```typescript
{
  completionTimeout: 500 // Increase if slow network
}
```

### 4. Connection Pooling
WebSocket connections are automatically pooled and reused.

## Debugging

### Enable Debug Logging
```typescript
const agentAPI = new MonacoAgentAPI(editor, { debug: true })
```

### Check Connection Status
```typescript
if (wsClient?.isConnected()) {
  console.log('Agent connected')
} else {
  console.log('Agent disconnected')
}
```

### Monitor Performance
```typescript
const startTime = Date.now()
await agentAPI.requestCompletions(position, context)
console.log('Latency:', Date.now() - startTime, 'ms')
```

## Common Issues

### Completions Not Working
1. Check WebSocket connection
2. Verify agent API is running
3. Check network latency
4. Enable debug logging

### High Latency
1. Check network connection
2. Increase timeout
3. Reduce diagnostics frequency
4. Check agent backend load

### WebSocket Disconnections
1. Check WebSocket URL
2. Verify CORS headers
3. Monitor network stability
4. Check firewall rules

## VS Code Extension

### Commands
```
Ctrl/Cmd+Shift+P → "Agent: Complete Code"
Ctrl/Cmd+Shift+P → "Agent: Explain Code"
Ctrl/Cmd+Shift+P → "Agent: Fix Issues"
Ctrl/Cmd+Shift+P → "Agent: Refactor Code"
Ctrl/Cmd+Shift+P → "Agent: Chat with AI"
Ctrl/Cmd+Shift+P → "Agent: Analyze Code"
```

### Settings
```json
{
  "vibecode.agentApiUrl": "http://localhost:3000/api",
  "vibecode.agentWsUrl": "ws://localhost:3000/api/ws",
  "vibecode.agentModel": "claude-3-5-sonnet-20241022",
  "vibecode.debug": false
}
```

## Examples

### React App
```tsx
import { AgentMonacoEditor } from '@/components/editor/AgentMonacoEditor'

export default function CodeEditor() {
  const [code, setCode] = useState('')

  return (
    <div className="h-screen">
      <AgentMonacoEditor
        value={code}
        language="typescript"
        theme="vs-dark"
        height="100%"
        enableAgent={true}
        onChange={setCode}
      />
    </div>
  )
}
```

### Next.js Page
```tsx
'use client'

import dynamic from 'next/dynamic'

const AgentMonacoEditor = dynamic(
  () => import('@/components/editor/AgentMonacoEditor'),
  { ssr: false }
)

export default function EditorPage() {
  return <AgentMonacoEditor value="// Code here" language="typescript" />
}
```

### Vanilla JavaScript
```javascript
import * as monaco from 'monaco-editor'
import { MonacoAgentAPI } from '@/lib/editor/monaco-agentapi'

const editor = monaco.editor.create(document.getElementById('editor'), {
  value: '// Code here',
  language: 'typescript',
})

const agentAPI = new MonacoAgentAPI(editor)
await agentAPI.initialize()
```

## Resources

- [Full Documentation](./MONACO_AGENTAPI_INTEGRATION.md)
- [API Reference](./AGENT14_DELIVERABLE_SUMMARY.md)
- [Demo Page](/editor)
- [Agent API Spec](/api/docs/agent-api)

## Support

- GitHub Issues: [Report bugs](https://github.com/vibecode/vibecode-webgui/issues)
- Documentation: [Full guide](./MONACO_AGENTAPI_INTEGRATION.md)
- Demo: [Live demo](/editor)

---

**Quick Start Complete!** 🎉

You now have a fully functional agent-powered code editor with:
- ✅ AI completions (<300ms)
- ✅ Hover explanations
- ✅ Quick fixes
- ✅ Real-time diagnostics
- ✅ WebSocket streaming

Happy coding with AI assistance! 🚀
