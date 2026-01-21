# IDE Abstraction Layer

This module provides a unified interface for managing multiple web-based IDE platforms in VibeCode.

## Overview

The IDE abstraction layer allows VibeCode to support multiple web IDE backends:
- **OpenVSCode Server** (Default) - Full VS Code in browser
- **Code-Server** - VS Code with built-in authentication
- **Eclipse Theia** - Customizable cloud IDE platform

## Architecture

```
┌─────────────────────────────────────┐
│   VibeCode Frontend (React/Next.js) │
├─────────────────────────────────────┤
│   IDE Session API (/api/ide/*)      │
├─────────────────────────────────────┤
│   IDE Factory (IDEFactory)          │
├───────────┬──────────────┬──────────┤
│ OpenVSCode│ Code-Server  │  Theia   │
│   Adapter │   Adapter    │  Adapter │
├───────────┴──────────────┴──────────┤
│   WebIDE Interface                  │
└─────────────────────────────────────┘
```

## Core Components

### 1. Types (`types.ts`)
Defines the core interfaces and types:
- `IDEType` - Supported IDE types
- `IDEConfig` - Configuration for starting an IDE
- `IDESession` - Active IDE session data
- `WebIDE` - Base interface all IDE adapters implement

### 2. IDE Adapters
Each IDE has its own adapter implementing the `WebIDE` interface:

#### OpenVSCode Server (`openvscode.ts`)
```typescript
import { OpenVSCodeServer } from '@/lib/ide';

const ide = new OpenVSCodeServer();
const session = await ide.start({
  type: 'openvscode',
  workspaceId: 'ws-123',
  userId: 'user-456',
  port: 3000,
});
```

#### Code-Server (`code-server.ts`)
```typescript
import { CodeServer } from '@/lib/ide';

const ide = new CodeServer();
const session = await ide.start({
  type: 'code-server',
  workspaceId: 'ws-123',
  userId: 'user-456',
  auth: {
    enabled: true,
    password: 'secure-password',
  },
});
```

#### Eclipse Theia (`theia.ts`)
```typescript
import { EclipseTheia } from '@/lib/ide';

const ide = new EclipseTheia();
const session = await ide.start({
  type: 'theia',
  workspaceId: 'ws-123',
  userId: 'user-456',
});
```

### 3. IDE Factory (`factory.ts`)
Factory pattern for IDE instance management:

```typescript
import { IDEFactory } from '@/lib/ide';

// Get IDE by type
const ide = IDEFactory.getIDE('openvscode');

// Start IDE with config
await IDEFactory.startIDE({
  type: 'code-server',
  workspaceId: 'ws-123',
  userId: 'user-456',
});

// Get default IDE type
const defaultType = IDEFactory.getDefaultIDEType();
```

## API Endpoints

### Create IDE Session
```bash
POST /api/ide/session
Content-Type: application/json

{
  "workspaceId": "ws-123",
  "userId": "user-456",
  "type": "openvscode",  # optional, uses default if omitted
  "projectPath": "/workspace",
  "extensions": ["ms-python.python"],
  "port": 3000
}
```

Response:
```json
{
  "success": true,
  "session": {
    "id": "session-abc",
    "type": "openvscode",
    "url": "http://localhost:3000",
    "status": "starting",
    "workspaceId": "ws-123",
    "createdAt": "2026-01-20T18:00:00Z"
  }
}
```

### List IDE Sessions
```bash
GET /api/ide/session?workspaceId=ws-123&type=openvscode
```

Response:
```json
{
  "success": true,
  "sessions": [
    {
      "id": "session-abc",
      "type": "openvscode",
      "url": "http://localhost:3000",
      "status": "ready",
      "workspaceId": "ws-123",
      "userId": "user-456",
      "createdAt": "2026-01-20T18:00:00Z",
      "lastActivity": "2026-01-20T18:05:00Z"
    }
  ]
}
```

### Get IDE Session
```bash
GET /api/ide/session/session-abc
```

Response:
```json
{
  "success": true,
  "session": {
    "id": "session-abc",
    "type": "openvscode",
    "url": "http://localhost:3000",
    "status": "ready",
    "workspaceId": "ws-123",
    "userId": "user-456",
    "createdAt": "2026-01-20T18:00:00Z",
    "lastActivity": "2026-01-20T18:05:00Z",
    "health": {
      "healthy": true,
      "status": "ready",
      "message": "IDE is healthy",
      "timestamp": "2026-01-20T18:05:30Z"
    }
  }
}
```

### Stop IDE Session
```bash
DELETE /api/ide/session/session-abc
```

Response:
```json
{
  "success": true,
  "message": "Session stopped successfully"
}
```

### Install Extension
```bash
PATCH /api/ide/session/session-abc
Content-Type: application/json

{
  "action": "install-extension",
  "extensionId": "ms-python.python"
}
```

### List Extensions
```bash
PATCH /api/ide/session/session-abc
Content-Type: application/json

{
  "action": "list-extensions"
}
```

## Configuration

### Environment Variables
```bash
# Set default IDE type
DEFAULT_IDE_TYPE=openvscode  # openvscode | code-server | theia

# IDE images
OPENVSCODE_IMAGE=gitpod/openvscode-server:latest
CODESERVER_IMAGE=codercom/code-server:latest
THEIA_IMAGE=theiaide/theia:latest
```

### YAML Configuration
See `vibecode.ide.yaml` for full configuration options.

## Usage Examples

### Frontend Integration
```typescript
// React component using IDE session
import { useState, useEffect } from 'react';

function IDEComponent({ workspaceId, ideType = 'openvscode' }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function startIDE() {
      const response = await fetch('/api/ide/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          userId: 'current-user-id',
          type: ideType,
        }),
      });
      
      const data = await response.json();
      setSession(data.session);
      setLoading(false);
    }
    
    startIDE();
  }, [workspaceId, ideType]);

  if (loading) return <div>Starting IDE...</div>;
  
  return (
    <iframe
      src={session.url}
      style={{ width: '100%', height: '100vh', border: 'none' }}
    />
  );
}
```

### Backend Integration
```typescript
// Server-side IDE management
import { IDEFactory } from '@/lib/ide';

async function provisionWorkspaceIDE(workspaceId: string, userId: string) {
  // Get user's preferred IDE type or use default
  const ideType = await getUserIDEPreference(userId) || IDEFactory.getDefaultIDEType();
  
  // Start IDE session
  const ide = IDEFactory.getIDE(ideType);
  const session = await ide.start({
    type: ideType,
    workspaceId,
    userId,
    extensions: ['ms-python.python', 'dbaeumer.vscode-eslint'],
  });
  
  // Perform health check
  const health = await ide.healthCheck(session.id);
  
  if (!health.healthy) {
    throw new Error(`IDE failed health check: ${health.message}`);
  }
  
  return session;
}
```

## Testing

```typescript
import { IDEFactory, OpenVSCodeServer } from '@/lib/ide';

describe('IDE Abstraction Layer', () => {
  it('should create OpenVSCode session', async () => {
    const ide = new OpenVSCodeServer();
    const session = await ide.start({
      type: 'openvscode',
      workspaceId: 'test-ws',
      userId: 'test-user',
    });
    
    expect(session.type).toBe('openvscode');
    expect(session.status).toBe('starting');
  });
  
  it('should switch between IDE types', async () => {
    const openvscode = IDEFactory.getIDE('openvscode');
    const codeserver = IDEFactory.getIDE('code-server');
    const theia = IDEFactory.getIDE('theia');
    
    expect(openvscode.name).toBe('openvscode');
    expect(codeserver.name).toBe('code-server');
    expect(theia.name).toBe('theia');
  });
});
```

## Performance Considerations

| IDE | Startup Time | Memory Usage | Best For |
|-----|-------------|--------------|----------|
| OpenVSCode | ~5s | 500MB-1GB | Full VS Code experience |
| Code-Server | ~4s | 400MB-900MB | Built-in auth, lower resources |
| Theia | ~6s | 450MB-1GB | Customization, branding |

## Extending

To add a new IDE backend:

1. Create adapter implementing `WebIDE`:
```typescript
// src/lib/ide/my-new-ide.ts
import { WebIDE, IDEConfig, IDESession } from './types';

export class MyNewIDE implements WebIDE {
  readonly name = 'my-new-ide';
  
  async start(config: IDEConfig): Promise<IDESession> {
    // Implementation
  }
  
  async stop(sessionId: string): Promise<void> {
    // Implementation
  }
  
  // ... implement other methods
}
```

2. Register in factory:
```typescript
// src/lib/ide/factory.ts
case 'my-new-ide':
  return new MyNewIDE();
```

3. Add to type definitions:
```typescript
// src/lib/ide/types.ts
export type IDEType = 'openvscode' | 'code-server' | 'theia' | 'my-new-ide';
```

## Related Documentation

- [IDE Options](../../docs/IDE_OPTIONS.md) - Comparison of IDE platforms
- [Extension Compatibility](../../docs/EXTENSION_COMPATIBILITY.md) - Extension support matrix
- [Deployment Guide](../../docs/DEPLOYMENT.md) - Production deployment
- [Architecture](../../docs/ARCHITECTURE.md) - Overall system architecture

## License

MIT - See LICENSE file for details
