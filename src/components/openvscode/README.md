# OpenVSCode Components - Quick Start

React components for embedding OpenVSCode Server in VibeCode.

## Installation

Components are already included in the project at `/src/components/openvscode/`.

## Basic Usage

### 1. Simple Integration (Recommended)

```tsx
import { ServerConnection, LoadingScreen, EditorContainer } from '@/components/openvscode'

export default function EditorPage() {
  return (
    <ServerConnection autoStart>
      {({ status, isLoading, error, startServer }) => {
        if (isLoading && !status?.running) {
          return <LoadingScreen error={error} onRetry={startServer} />
        }

        return (
          <EditorContainer
            status={status}
            isLoading={isLoading}
            error={error}
            onRetry={startServer}
          />
        )
      }}
    </ServerConnection>
  )
}
```

### 2. Full-Featured Integration

See `/src/app/editor-embedded/page.tsx` for a complete example with:
- Header with status badge
- Collapsible status panel
- Full error handling
- Control buttons

### 3. Custom Hook Usage

```tsx
import { useServerConnection } from '@/components/openvscode'

function MyComponent() {
  const { status, isLoading, error, startServer, stopServer } = useServerConnection()

  // Use in your custom UI
}
```

## Components

| Component | Purpose | Props |
|-----------|---------|-------|
| `ServerConnection` | State management | `autoStart`, `onStatusChange`, `onError` |
| `LoadingScreen` | Startup UI | `message`, `error`, `progress`, `onRetry` |
| `EditorFrame` | Iframe embedding | `serverUrl`, `redirectMode`, `onLoad` |
| `EditorContainer` | High-level wrapper | `status`, `isLoading`, `error`, `onRetry` |
| `ServerStatusComponent` | Status panel | `status`, `onStart`, `onStop`, `onRestart` |
| `ServerStatusBadge` | Minimal indicator | `status`, `onClick` |

## Backend Requirements

Your Tauri backend must implement these commands:

```rust
#[tauri::command]
async fn start_server(app: AppHandle) -> Result<ServerStatus, String>

#[tauri::command]
async fn stop_server() -> Result<(), String>

#[tauri::command]
fn get_server_status() -> Result<ServerStatus, String>
```

**Current Status**: ✅ Already implemented in `src-tauri/src/commands.rs` as `start_code_server()`

## Quick Examples

### Minimal Loading Screen

```tsx
import { MinimalLoadingScreen } from '@/components/openvscode'

<MinimalLoadingScreen message="Loading editor..." />
```

### Status Badge in Header

```tsx
import { ServerStatusBadge } from '@/components/openvscode'

<header>
  <ServerStatusBadge status={status} onClick={() => setShowPanel(true)} />
</header>
```

### Redirect Instead of Iframe

```tsx
<EditorFrame serverUrl={url} redirectMode={true} />
```

## Testing

Visit the test page: http://localhost:3000/editor-embedded

## Documentation

Full documentation: `/docs/OPENVSCODE_COMPONENTS.md`

## Features

✅ Auto-start server on mount
✅ Health monitoring & reconnection
✅ Loading states & error handling
✅ Iframe or redirect modes
✅ Control buttons (start/stop/restart)
✅ Responsive design
✅ TypeScript support
✅ Works in web & Tauri modes

## Troubleshooting

**Server won't start**
- Check port 8080 is available: `lsof -ti:8080`
- Verify code-server is installed

**Iframe blank**
- Try redirect mode: `<EditorFrame redirectMode />`
- Check browser console for CORS errors

**Connection errors**
- Components auto-retry up to 3 times
- Check Tauri backend logs for details

## Next Steps

1. Visit `/editor-embedded` to see it in action
2. Customize the UI using the example as a template
3. Add to your main App.tsx when ready
4. Read full docs for advanced features

---

**Need help?** See `/docs/OPENVSCODE_COMPONENTS.md` for detailed documentation.
