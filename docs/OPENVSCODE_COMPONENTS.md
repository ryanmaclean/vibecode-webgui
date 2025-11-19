# OpenVSCode Server React Components

Complete documentation for the OpenVSCode Server integration components for VibeCode.

## Overview

This module provides a comprehensive set of React components to embed and manage an OpenVSCode Server (or code-server) instance within the VibeCode Tauri application. The components handle connection state, loading screens, iframe embedding, server status display, and error recovery.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    React Frontend                            │
│  ┌───────────────────────────────────────────────────────┐  │
│  │            ServerConnection (Provider)                 │  │
│  │  - Manages server lifecycle                           │  │
│  │  - Auto-start/stop                                    │  │
│  │  - Health monitoring                                  │  │
│  │  - Reconnection logic                                 │  │
│  │                                                         │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐  │  │
│  │  │ Loading     │  │ EditorFrame │  │ ServerStatus │  │  │
│  │  │ Screen      │  │ (iframe)    │  │ Panel        │  │  │
│  │  └─────────────┘  └─────────────┘  └──────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ Tauri IPC (invoke)
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Tauri Backend (Rust)                      │
│  Commands:                                                   │
│  - start_server()                                           │
│  - stop_server()                                            │
│  - get_server_status()                                      │
│  - restart_server() (optional)                              │
└─────────────────────────────────────────────────────────────┘
```

## Components

### 1. ServerConnection

Main provider component that manages server lifecycle and connection state.

#### Props

```typescript
interface ServerConnectionProps {
  onStatusChange?: (status: ServerStatus) => void
  onError?: (error: string) => void
  autoStart?: boolean
  children?: (props: ServerConnectionState) => React.ReactNode
}
```

#### Usage

```tsx
import { ServerConnection } from '@/components/openvscode'

<ServerConnection autoStart onStatusChange={(status) => console.log(status)}>
  {({ status, isLoading, error, startServer, stopServer, restartServer }) => (
    // Your UI components here
    <div>Server is {status?.running ? 'running' : 'stopped'}</div>
  )}
</ServerConnection>
```

#### Features

- **Auto-start**: Automatically starts server on mount if `autoStart={true}`
- **Health monitoring**: Polls server status every 30 seconds
- **Auto-reconnection**: Retries up to 3 times with exponential backoff
- **Error handling**: Captures and reports errors to parent components
- **Graceful degradation**: Works in both Tauri and web environments

### 2. LoadingScreen

Displays a loading state while the server starts up.

#### Props

```typescript
interface LoadingScreenProps {
  message?: string
  submessage?: string
  progress?: number
  onRetry?: () => void
  error?: string | null
  showSpinner?: boolean
}
```

#### Usage

```tsx
import { LoadingScreen } from '@/components/openvscode'

<LoadingScreen
  message="Starting Code Server"
  submessage="This may take a few seconds"
  progress={65}
  error={error}
  onRetry={startServer}
/>
```

#### Features

- **Animated spinner**: Smooth CSS animations
- **Progress indicator**: Shows startup progress (0-100%)
- **Error state**: Displays errors with retry button
- **Step indicators**: Shows which startup steps are complete
- **Troubleshooting tips**: Built-in help text

#### Variants

- `LoadingScreen`: Full-featured loading screen
- `MinimalLoadingScreen`: Simplified version for faster loads

### 3. EditorFrame

Embeds the OpenVSCode Server in an iframe or redirects to it.

#### Props

```typescript
interface EditorFrameProps {
  serverUrl: string | null
  onLoad?: () => void
  onError?: (error: string) => void
  className?: string
  redirectMode?: boolean
}
```

#### Usage

```tsx
import { EditorFrame } from '@/components/openvscode'

<EditorFrame
  serverUrl="http://127.0.0.1:8080"
  onLoad={() => console.log('Editor loaded')}
  redirectMode={false}
/>
```

#### Features

- **Iframe mode**: Embeds editor in the same page (default)
- **Redirect mode**: Navigates to server URL (better compatibility)
- **Load detection**: Fires callback when editor is ready
- **Error handling**: Shows error overlay on load failure
- **Sandbox security**: Applies appropriate iframe sandbox attributes
- **Clipboard support**: Enables clipboard read/write

#### High-Level Variant

```tsx
import { EditorContainer } from '@/components/openvscode'

<EditorContainer
  status={serverStatus}
  isLoading={isLoading}
  error={error}
  onRetry={startServer}
  redirectMode={false}
/>
```

### 4. ServerStatus

Displays server health and provides control buttons.

#### Props

```typescript
interface ServerStatusProps {
  status: ServerStatus | null
  onStart?: () => void
  onStop?: () => void
  onRestart?: () => void
  isLoading?: boolean
  compact?: boolean
}
```

#### Usage

```tsx
import { ServerStatusComponent } from '@/components/openvscode'

<ServerStatusComponent
  status={serverStatus}
  onStart={startServer}
  onStop={stopServer}
  onRestart={restartServer}
  compact={false}
/>
```

#### Features

- **Visual indicator**: Color-coded status dot (green/gray)
- **Server details**: Port, PID, uptime, URL
- **Control buttons**: Start/Stop/Restart with loading states
- **Compact mode**: Minimal UI for toolbars
- **Auto-refresh**: Updates when status changes

#### Variants

- `ServerStatusComponent`: Full status panel
- `ServerStatusBadge`: Minimal badge for headers
- `FullScreenServerStatus`: Large dedicated status page

## Complete Example

Here's a complete integration example:

```tsx
'use client'

import { ServerConnection, LoadingScreen, EditorContainer } from '@/components/openvscode'

export default function CodeEditorPage() {
  return (
    <ServerConnection autoStart>
      {({ status, isLoading, error, startServer }) => {
        // Show loading screen during startup
        if (isLoading && !status?.running) {
          return (
            <LoadingScreen
              message="Starting Code Server"
              submessage="Setting up your development environment"
              error={error}
              onRetry={startServer}
            />
          )
        }

        // Show editor when ready
        return (
          <div className="h-screen flex flex-col">
            <header className="bg-slate-800 p-4">
              <h1>VibeCode Editor</h1>
            </header>

            <div className="flex-1">
              <EditorContainer
                status={status}
                isLoading={isLoading}
                error={error}
                onRetry={startServer}
              />
            </div>
          </div>
        )
      }}
    </ServerConnection>
  )
}
```

## TypeScript Types

```typescript
interface ServerStatus {
  running: boolean
  port?: number
  pid?: number
  url?: string
  startup_time?: number
}

interface ServerConnectionState {
  status: ServerStatus | null
  isLoading: boolean
  error: string | null
  startServer: () => Promise<void>
  stopServer: () => Promise<void>
  restartServer: () => Promise<void>
  checkStatus: () => Promise<void>
}
```

## Backend Integration

These components require the following Tauri commands to be implemented in the Rust backend:

### Required Commands

```rust
#[tauri::command]
async fn start_server(app: AppHandle) -> Result<ServerStatus, String>

#[tauri::command]
async fn stop_server() -> Result<(), String>

#[tauri::command]
fn get_server_status() -> Result<ServerStatus, String>
```

### Optional Commands

```rust
#[tauri::command]
async fn restart_server(app: AppHandle) -> Result<ServerStatus, String>
```

### Example Rust Implementation

See `/Users/studio/vibecode-webgui/src-tauri/src/commands.rs` for the current implementation using `start_code_server()`.

The command should:
1. Locate the code-server binary (bundled or system)
2. Find an available port (8080-8099)
3. Start the server process
4. Wait for server to be ready
5. Return server status

## Styling

All components use Tailwind CSS with a consistent dark theme:

- **Background**: `bg-slate-900`, `bg-slate-800`
- **Text**: `text-white`, `text-slate-400`
- **Primary**: `blue-600`, `purple-600`, `indigo-700`
- **Success**: `green-500`, `green-600`
- **Error**: `red-500`, `red-600`
- **Borders**: `border-slate-700`

### Customization

You can override styles using the `className` prop:

```tsx
<EditorFrame
  serverUrl={url}
  className="border-4 border-blue-500 rounded-lg"
/>
```

## Error Handling

The components implement comprehensive error handling:

### Connection Errors

- **Auto-retry**: Up to 3 attempts with exponential backoff
- **Error display**: User-friendly error messages
- **Retry button**: Manual retry option
- **Troubleshooting tips**: Built-in help text

### Server Errors

- **Port conflicts**: Automatically finds available port
- **Process crashes**: Health monitoring detects crashes
- **Startup failures**: Detailed error messages

### Network Errors

- **Timeout handling**: 30-second startup timeout
- **Health checks**: Periodic polling to detect failures
- **Graceful degradation**: Works in web mode without Tauri

## Performance

### Optimization Strategies

1. **Lazy loading**: Use React.lazy for code splitting
2. **Memoization**: Components use `useCallback` to prevent re-renders
3. **Polling intervals**: Health checks every 30 seconds (configurable)
4. **Iframe optimization**: Sandbox attributes limit resource usage

### Memory Management

- Cleanup intervals on unmount
- Ref-based iframe management
- No memory leaks in long-running sessions

## Browser Compatibility

### Supported Browsers

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

### Tauri Environment

- Works in both Tauri webview and standalone web mode
- Detects Tauri environment: `'__TAURI__' in window`
- Falls back to HTTP checks in web mode

## Security Considerations

### Iframe Sandbox

```tsx
sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals allow-downloads"
```

### Localhost Binding

Server should bind to `127.0.0.1` only, never `0.0.0.0`.

### Connection Tokens

If using tokens, pass via URL: `?tkn={token}`

### CSP Headers

Update `tauri.conf.json`:

```json
{
  "security": {
    "csp": "default-src 'self'; connect-src 'self' ws://127.0.0.1:* http://127.0.0.1:*"
  }
}
```

## Troubleshooting

### Common Issues

#### 1. Server Won't Start

**Symptoms**: LoadingScreen shows "Failed to Start Server"

**Solutions**:
- Check if port 8080 is available: `lsof -ti:8080`
- Verify code-server is installed: `which code-server`
- Check Tauri backend logs
- Ensure proper permissions on binary

#### 2. Iframe Not Loading

**Symptoms**: Blank iframe or CORS errors

**Solutions**:
- Check server URL is correct
- Verify server is running: `curl http://127.0.0.1:8080/healthz`
- Try redirect mode instead: `<EditorFrame redirectMode />`
- Check browser console for errors

#### 3. Reconnection Failing

**Symptoms**: Constant retry loops

**Solutions**:
- Check server process hasn't crashed
- Verify port hasn't changed
- Restart the application
- Check system resources (CPU, memory)

### Debug Mode

Enable verbose logging:

```tsx
<ServerConnection
  autoStart
  onStatusChange={(status) => console.log('Status:', status)}
  onError={(error) => console.error('Error:', error)}
>
  {/* ... */}
</ServerConnection>
```

## Roadmap

### Future Enhancements

- [ ] WebSocket-based health monitoring
- [ ] Multi-workspace support
- [ ] Extension installation UI
- [ ] Settings panel integration
- [ ] Terminal integration
- [ ] File sync status
- [ ] Collaborative editing indicators

## Testing

### Unit Tests

```bash
npm run test:unit -- ServerConnection.test.tsx
```

### Integration Tests

```bash
npm run test:integration -- openvscode-integration.test.tsx
```

### E2E Tests

```bash
npm run test:e2e -- editor-embedded.test.ts
```

## License

MIT

## Support

For issues or questions:
- GitHub Issues: https://github.com/your-org/vibecode-webgui/issues
- Documentation: `/docs/OPENVSCODE_EMBEDDING.md`
- Slack: #vibecode-support

---

**Last Updated**: 2025-11-14
**Version**: 1.0.0
**Author**: VibeCode Team
