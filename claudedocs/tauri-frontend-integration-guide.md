# Tauri Frontend Integration Guide

**Target Audience**: Frontend developers integrating with Tauri backend
**Backend Status**: ✅ Complete - 7 commands ready for use
**Last Updated**: 2025-10-01

## Quick Start

### 1. Check if Running in Tauri

```typescript
import { invoke } from '@tauri-apps/api/core';

export const isTauri = () => {
  return typeof window !== 'undefined' && '__TAURI__' in window;
};
```

### 2. Basic Command Invocation

```typescript
import { invoke } from '@tauri-apps/api/core';

// Simple command with no parameters
const response = await invoke<string>('ping');
console.log(response); // "pong"

// Command with parameters
const greeting = await invoke<string>('greet', { name: 'Developer' });
console.log(greeting); // "Hello, Developer! Welcome to VibeCode."

// Command with Result type (may error)
try {
  const isAvailable = await invoke<boolean>('check_docker');
  console.log('Docker available:', isAvailable);
} catch (error) {
  console.error('Docker check failed:', error);
}
```

## Available Commands

### 1. Health Check

**Command**: `ping`
**Purpose**: Verify Tauri backend is responding
**Parameters**: None
**Returns**: `string` - "pong"

```typescript
const health = await invoke<string>('ping');
if (health === 'pong') {
  console.log('✅ Tauri backend healthy');
}
```

### 2. Browser Auto-Launch (P0 Feature)

**Command**: `launch_browser`
**Purpose**: Open system default browser with URL
**Parameters**: `{ url: string }`
**Returns**: `void` (throws on error)
**Platform**: macOS, Windows, Linux

```typescript
// Launch browser on app startup
try {
  await invoke('launch_browser', {
    url: 'http://localhost:3000'
  });
  console.log('✅ Browser launched');
} catch (error) {
  console.error('❌ Failed to launch browser:', error);
}
```

**Use Case**: Auto-open web UI when desktop app starts
```typescript
// In your app initialization
useEffect(() => {
  if (isTauri()) {
    invoke('launch_browser', { url: window.location.href })
      .catch(err => console.error('Browser launch failed:', err));
  }
}, []);
```

### 3. Greeting (Example)

**Command**: `greet`
**Purpose**: Testing/example command
**Parameters**: `{ name: string }`
**Returns**: `string`

```typescript
const message = await invoke<string>('greet', { name: 'World' });
// "Hello, World! Welcome to VibeCode."
```

### 4. Docker Availability Check

**Command**: `check_docker`
**Purpose**: Verify Docker daemon is running
**Parameters**: None
**Returns**: `boolean` (throws on connection error)

```typescript
try {
  const available = await invoke<boolean>('check_docker');
  if (available) {
    console.log('✅ Docker is available');
  } else {
    console.log('❌ Docker not responding');
  }
} catch (error) {
  console.error('❌ Docker connection error:', error);
  // Show user-friendly message
}
```

### 5. Docker Version

**Command**: `get_docker_version`
**Purpose**: Get Docker daemon version
**Parameters**: None
**Returns**: `string` - "Docker version: X.Y.Z"

```typescript
try {
  const version = await invoke<string>('get_docker_version');
  console.log(version); // "Docker version: 24.0.5"
} catch (error) {
  console.error('Failed to get Docker version:', error);
}
```

### 6. Docker Status (Combined)

**Command**: `get_docker_status`
**Purpose**: Get availability + version in one call
**Parameters**: None
**Returns**: `{ available: boolean, version?: string }`

```typescript
interface DockerStatus {
  available: boolean;
  version?: string;
}

try {
  const status = await invoke<DockerStatus>('get_docker_status');
  console.log('Docker available:', status.available);
  console.log('Docker version:', status.version);
} catch (error) {
  console.error('Docker status check failed:', error);
}
```

### 7. Docker System Info

**Command**: `get_docker_info`
**Purpose**: Get detailed Docker system information
**Parameters**: None
**Returns**: `DockerInfo` object

```typescript
interface DockerInfo {
  containers: number;
  images: number;
  memory_total: number;
  cpus: number;
  os_type: string;
  architecture: string;
}

try {
  const info = await invoke<DockerInfo>('get_docker_info');
  console.log(`Containers: ${info.containers}`);
  console.log(`Images: ${info.images}`);
  console.log(`Memory: ${(info.memory_total / 1024 / 1024 / 1024).toFixed(2)} GB`);
  console.log(`CPUs: ${info.cpus}`);
  console.log(`OS: ${info.os_type} (${info.architecture})`);
} catch (error) {
  console.error('Failed to get Docker info:', error);
}
```

## React Hooks

### useTauri Hook

```typescript
import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

export function useTauri() {
  const [isTauriEnv, setIsTauriEnv] = useState(false);

  useEffect(() => {
    setIsTauriEnv(typeof window !== 'undefined' && '__TAURI__' in window);
  }, []);

  return {
    isTauri: isTauriEnv,
    invoke,
  };
}

// Usage in component
function MyComponent() {
  const { isTauri, invoke } = useTauri();

  const handleClick = async () => {
    if (isTauri) {
      const response = await invoke('ping');
      console.log(response);
    }
  };

  return (
    <button onClick={handleClick}>
      {isTauri ? 'Running in Tauri' : 'Running in Browser'}
    </button>
  );
}
```

### useDockerStatus Hook

```typescript
import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface DockerStatus {
  available: boolean;
  version?: string;
  loading: boolean;
  error?: string;
}

export function useDockerStatus() {
  const [status, setStatus] = useState<DockerStatus>({
    available: false,
    loading: true,
  });

  useEffect(() => {
    if (!isTauri()) {
      setStatus({ available: false, loading: false });
      return;
    }

    invoke<{ available: boolean; version?: string }>('get_docker_status')
      .then(result => {
        setStatus({
          available: result.available,
          version: result.version,
          loading: false,
        });
      })
      .catch(error => {
        setStatus({
          available: false,
          loading: false,
          error: error.toString(),
        });
      });
  }, []);

  return status;
}

// Usage in component
function DockerStatusBadge() {
  const docker = useDockerStatus();

  if (docker.loading) {
    return <span>Checking Docker...</span>;
  }

  if (docker.error) {
    return <span className="error">Docker Error: {docker.error}</span>;
  }

  return (
    <span className={docker.available ? 'success' : 'warning'}>
      Docker: {docker.available ? '✅' : '❌'}
      {docker.version && ` (${docker.version})`}
    </span>
  );
}
```

## Error Handling Patterns

### Pattern 1: Try-Catch with User Feedback

```typescript
async function launchBrowser(url: string) {
  try {
    await invoke('launch_browser', { url });
    toast.success('Browser launched successfully');
  } catch (error) {
    console.error('Browser launch failed:', error);
    toast.error(`Failed to open browser: ${error}`);
  }
}
```

### Pattern 2: Graceful Degradation

```typescript
async function checkDockerOrWarn() {
  if (!isTauri()) {
    // Web version - skip Docker check
    return { available: false, reason: 'web' };
  }

  try {
    const available = await invoke<boolean>('check_docker');
    return { available, reason: 'checked' };
  } catch (error) {
    console.warn('Docker check failed, continuing without Docker:', error);
    return { available: false, reason: 'error', error };
  }
}
```

### Pattern 3: Retry Logic

```typescript
async function invokeWithRetry<T>(
  command: string,
  args?: Record<string, unknown>,
  maxRetries = 3
): Promise<T> {
  let lastError: Error | undefined;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await invoke<T>(command, args);
    } catch (error) {
      lastError = error as Error;
      console.warn(`Attempt ${i + 1} failed:`, error);
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }

  throw lastError;
}

// Usage
const status = await invokeWithRetry<DockerStatus>('get_docker_status');
```

## Testing

### Mock Tauri Commands (Vitest/Jest)

```typescript
// test-utils/tauri-mock.ts
export function mockTauriCommands() {
  global.__TAURI__ = {
    invoke: vi.fn().mockImplementation((command: string, args?: any) => {
      switch (command) {
        case 'ping':
          return Promise.resolve('pong');
        case 'check_docker':
          return Promise.resolve(true);
        case 'get_docker_status':
          return Promise.resolve({
            available: true,
            version: 'Docker version: 24.0.5',
          });
        default:
          return Promise.reject(`Unknown command: ${command}`);
      }
    }),
  };
}

// In tests
import { mockTauriCommands } from './test-utils/tauri-mock';

describe('Docker integration', () => {
  beforeEach(() => {
    mockTauriCommands();
  });

  it('should check Docker status', async () => {
    const status = await invoke('get_docker_status');
    expect(status.available).toBe(true);
  });
});
```

## Common Issues

### 1. "Cannot find module '@tauri-apps/api/core'"

**Solution**: Install Tauri API package
```bash
npm install @tauri-apps/api
```

### 2. Commands not registered

**Error**: "command not found: xyz"

**Solution**: Verify command is registered in `src-tauri/src/main.rs`
```rust
.invoke_handler(tauri::generate_handler![
    commands::ping,
    commands::launch_browser,
    // ... your command here
])
```

### 3. TypeScript types missing

**Solution**: Define command types explicitly
```typescript
// types/tauri.d.ts
declare module '@tauri-apps/api/core' {
  export function invoke<T>(command: string, args?: Record<string, unknown>): Promise<T>;
}
```

## Performance Tips

1. **Batch Commands**: If you need multiple pieces of info, use combined commands like `get_docker_status` instead of separate calls

2. **Cache Results**: Docker info changes infrequently - cache for 30-60s
```typescript
const cache = { data: null, timestamp: 0 };
const CACHE_TTL = 30000; // 30s

async function getDockerInfoCached() {
  if (cache.data && Date.now() - cache.timestamp < CACHE_TTL) {
    return cache.data;
  }
  cache.data = await invoke('get_docker_info');
  cache.timestamp = Date.now();
  return cache.data;
}
```

3. **Debounce Status Checks**: Don't spam Docker API
```typescript
import { debounce } from 'lodash';

const checkDockerDebounced = debounce(
  () => invoke('check_docker'),
  1000
);
```

## Next Steps

1. Create TypeScript types file: `src/types/tauri-commands.ts`
2. Implement React hooks in: `src/lib/tauri/hooks.ts`
3. Add Tauri provider: `src/components/providers/TauriProvider.tsx`
4. Test browser auto-launch on app startup
5. Add Docker status indicator in UI

## Resources

- [Tauri API Docs](https://tauri.app/v2/api/js/)
- [Tauri Command Documentation](https://tauri.app/v2/guides/features/command/)
- [Backend Implementation Report](./tauri-backend-implementation-report.md)
- [src-tauri/README.md](../src-tauri/README.md)

## Support

**Issues**: #489 (backend), #491 (browser launch), #488 (menu bar)
**Backend Status**: ✅ Production-ready
**Commands Available**: 7
**Compilation**: ✅ Successful (release mode)
