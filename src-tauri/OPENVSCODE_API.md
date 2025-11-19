# OpenVSCode Server - Command API Reference

## Command Signatures

### TypeScript Types

```typescript
interface ServerStatus {
  running: boolean;
  port?: number;
  pid?: number;
  url?: string;
  startup_time?: number;
}
```

## Commands

### `openvscode_start`

**Start the OpenVSCode Server**

```typescript
invoke<ServerStatus>('openvscode_start'): Promise<ServerStatus>
```

**Example:**
```typescript
const status = await invoke('openvscode_start');
console.log(`Server started at ${status.url}`);
// Output: Server started at http://127.0.0.1:8080?tkn=abc123...
```

**Returns:**
```typescript
{
  running: true,
  port: 8080,
  pid: 12345,
  url: "http://127.0.0.1:8080?tkn=abc123...",
  startup_time: 1234
}
```

**Errors:**
- `"Failed to find available port: No available ports in range 8080-8099"`
- `"OpenVSCode binary not found at: ..."`
- `"Server failed to start within 30 seconds"`

---

### `openvscode_stop`

**Stop the OpenVSCode Server**

```typescript
invoke<void>('openvscode_stop'): Promise<void>
```

**Example:**
```typescript
await invoke('openvscode_stop');
console.log('Server stopped');
```

**Returns:** `void`

**Errors:** None (gracefully handles if already stopped)

---

### `openvscode_restart`

**Restart the OpenVSCode Server**

```typescript
invoke<ServerStatus>('openvscode_restart'): Promise<ServerStatus>
```

**Example:**
```typescript
const status = await invoke('openvscode_restart');
console.log(`Server restarted on port ${status.port}`);
```

**Returns:** Same as `openvscode_start`

**Errors:** Same as `openvscode_start`

---

### `openvscode_status`

**Get current server status**

```typescript
invoke<ServerStatus>('openvscode_status'): Promise<ServerStatus>
```

**Example:**
```typescript
const status = await invoke('openvscode_status');
if (status.running) {
  console.log(`Server running on port ${status.port}`);
} else {
  console.log('Server not running');
}
```

**Returns:**
```typescript
// When running:
{
  running: true,
  port: 8080,
  pid: 12345,
  url: "http://127.0.0.1:8080?tkn=abc123...",
  startup_time: 1234
}

// When stopped:
{
  running: false,
  port: null,
  pid: null,
  url: null,
  startup_time: null
}
```

**Errors:** None (always returns status)

---

### `openvscode_install_extensions`

**Install bundled VSIX extensions**

```typescript
invoke<string[]>('openvscode_install_extensions'): Promise<string[]>
```

**Example:**
```typescript
const extensions = await invoke('openvscode_install_extensions');
console.log(`Installed ${extensions.length} extensions:`, extensions);
// Output: Installed 1 extensions: ["workspace-rag-1.0.0"]
```

**Returns:**
```typescript
["workspace-rag-1.0.0", "other-extension-0.1.0"]
```

**Errors:**
- `"Failed to get resource dir: ..."`
- `"Failed to install extension: ..."`

---

## Usage Patterns

### Pattern 1: Simple Redirect

```typescript
import { invoke } from '@tauri-apps/api/core';

async function launchEditor() {
  const status = await invoke('openvscode_start');
  window.location.href = status.url;
}
```

### Pattern 2: Embedded IFrame

```typescript
import { invoke } from '@tauri-apps/api/core';

async function embedEditor() {
  const status = await invoke('openvscode_start');

  const iframe = document.createElement('iframe');
  iframe.src = status.url;
  iframe.style.width = '100%';
  iframe.style.height = '100vh';
  iframe.style.border = 'none';

  document.body.appendChild(iframe);
}
```

### Pattern 3: React Component

```typescript
import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

function VSCodeEditor() {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    invoke('openvscode_start')
      .then((status: any) => {
        setUrl(status.url);
        setLoading(false);
      })
      .catch((err) => {
        setError(String(err));
        setLoading(false);
      });

    // Cleanup on unmount
    return () => {
      invoke('openvscode_stop').catch(console.error);
    };
  }, []);

  if (loading) return <div>Starting editor...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!url) return null;

  return (
    <iframe
      src={url}
      style={{ width: '100%', height: '100vh', border: 'none' }}
      title="VS Code Editor"
    />
  );
}
```

### Pattern 4: With Status Monitoring

```typescript
import { invoke } from '@tauri-apps/api/core';

async function monitorServer() {
  // Check status every 5 seconds
  setInterval(async () => {
    const status = await invoke('openvscode_status');
    console.log('Server status:', status);

    if (!status.running) {
      console.warn('Server stopped unexpectedly!');
      // Auto-restart
      await invoke('openvscode_start');
    }
  }, 5000);
}
```

### Pattern 5: Loading Screen

```typescript
import { invoke } from '@tauri-apps/api/core';

async function startWithProgress() {
  const progressDiv = document.getElementById('progress');

  progressDiv.textContent = 'Finding available port...';
  await new Promise(r => setTimeout(r, 500));

  progressDiv.textContent = 'Starting OpenVSCode Server...';
  const status = await invoke('openvscode_start');

  progressDiv.textContent = 'Installing extensions...';
  await invoke('openvscode_install_extensions');

  progressDiv.textContent = 'Ready!';
  window.location.href = status.url;
}
```

---

## Error Handling

### Recommended Pattern

```typescript
import { invoke } from '@tauri-apps/api/core';

async function safeStart() {
  try {
    const status = await invoke('openvscode_start');
    return status;
  } catch (error) {
    console.error('Failed to start OpenVSCode Server:', error);

    // Show user-friendly error
    if (String(error).includes('binary not found')) {
      alert('OpenVSCode Server is not installed. Please reinstall the application.');
    } else if (String(error).includes('No available ports')) {
      alert('All ports are in use. Please close other applications and try again.');
    } else if (String(error).includes('failed to start within')) {
      alert('Server took too long to start. Please try again.');
    } else {
      alert('Failed to start editor. Please check the logs.');
    }

    throw error;
  }
}
```

---

## Lifecycle Management

### App Startup

```typescript
// In your app initialization
window.addEventListener('DOMContentLoaded', async () => {
  try {
    await invoke('openvscode_start');
  } catch (error) {
    console.error('Failed to start OpenVSCode:', error);
  }
});
```

### App Shutdown

```typescript
// In your app cleanup
window.addEventListener('beforeunload', async () => {
  await invoke('openvscode_stop');
});
```

### Tab/Window Close

```typescript
// When closing editor tab
function closeEditor() {
  invoke('openvscode_stop')
    .then(() => console.log('Server stopped'))
    .catch(console.error);
}
```

---

## Testing

### Basic Test Suite

```typescript
import { invoke } from '@tauri-apps/api/core';

async function runTests() {
  console.log('🧪 Testing OpenVSCode commands...\n');

  // Test 1: Status when stopped
  const status1 = await invoke('openvscode_status');
  console.assert(!status1.running, 'Server should not be running initially');

  // Test 2: Start server
  const status2 = await invoke('openvscode_start');
  console.assert(status2.running, 'Server should be running after start');
  console.assert(status2.url !== null, 'Server should have URL');
  console.assert(status2.port >= 8080 && status2.port <= 8099, 'Port should be in range');

  // Test 3: Status when running
  const status3 = await invoke('openvscode_status');
  console.assert(status3.running, 'Server should still be running');
  console.assert(status3.port === status2.port, 'Port should be consistent');

  // Test 4: Install extensions
  const extensions = await invoke('openvscode_install_extensions');
  console.assert(Array.isArray(extensions), 'Should return array of extensions');

  // Test 5: Restart
  const status4 = await invoke('openvscode_restart');
  console.assert(status4.running, 'Server should be running after restart');

  // Test 6: Stop server
  await invoke('openvscode_stop');
  const status5 = await invoke('openvscode_status');
  console.assert(!status5.running, 'Server should be stopped');

  console.log('✅ All tests passed!');
}
```

---

## Configuration

### Server Launch Arguments

The server is started with these arguments:

```bash
code serve-web \
  --port 8080 \
  --host 127.0.0.1 \
  --connection-token abc123... \
  --user-data-dir /path/to/user-data \
  --extensions-dir /path/to/extensions \
  --disable-telemetry \
  --disable-update-check \
  /path/to/workspace
```

### Environment Variables

```bash
VSCODE_AGENT_FOLDER=/path/to/user-data
DD_TRACE_ENABLED=true
DD_TRACE_AGENT_URL=http://localhost:8126
DD_SERVICE=vibecode-openvscode
DD_ENV=development
```

---

## Security

### Connection Token

- 32-character random string
- Generated per session
- Required for all requests
- Passed via URL parameter

### Network Binding

- Binds only to `127.0.0.1`
- Not accessible from network
- Localhost only

### Process Isolation

- Runs as separate subprocess
- Isolated user data directory
- Isolated extensions directory

---

## Troubleshooting

### Server won't start

1. Check binary exists:
   ```typescript
   // Binary should be at:
   // macOS: VibeCode.app/Contents/Resources/openvscode-server/bin/code
   ```

2. Check ports:
   ```bash
   lsof -nP -iTCP:8080-8099 -sTCP:LISTEN
   ```

3. Check logs:
   ```typescript
   // Server stdout/stderr are piped
   // Check console for error messages
   ```

### Health check fails

The server waits for `/healthz` endpoint to respond. If it times out:

1. Increase timeout in `process.rs`
2. Check if binary has execute permissions
3. Check if Node.js is available (required by OpenVSCode)

### Extensions not installing

1. Verify VSIX files exist in `resources/extensions/`
2. Check extension directory permissions
3. Verify binary can run `--install-extension` command

---

## Performance

### Startup Time
- Port allocation: ~1ms
- Process spawn: ~100ms
- Server ready: ~2-3 seconds
- Total: ~3-4 seconds

### Memory Usage
- Manager overhead: ~1 KB
- Server process: ~50-100 MB

### Port Range
- Default: 8080-8099 (20 ports)
- Can be changed in `port.rs`

---

**Last Updated:** 2024-11-14
**API Version:** 1.0.0
