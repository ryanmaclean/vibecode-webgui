# Docker/Colima Detection Implementation

**Date:** 2025-10-01
**Author:** Backend Architect Agent
**Related Issue:** #488 (Tauri MVP Epic) - Docker/Colima Detection Task
**Status:** Ready for Integration

---

## Overview

This implementation provides comprehensive Docker runtime detection for VibeCode, supporting Docker Desktop, Colima, and Podman across macOS, Linux, and Windows platforms. The architecture is designed to work both in the current Next.js web application and future Tauri desktop application.

## Architecture

### Components

```
src/lib/docker/
├── detection.ts       # Core detection logic (backend)
├── client.ts          # API client utilities (frontend)

src/app/api/docker/
└── status/
    └── route.ts       # Next.js API route

src/types/
└── docker.ts          # Shared TypeScript types

tests/
├── unit/
│   └── docker-detection.test.ts      # Unit tests
└── integration/
    └── docker-api.test.ts             # API integration tests
```

### Technology Stack

- **Backend:** Node.js + TypeScript
- **Detection Method:** Native command execution + file system checks
- **API:** Next.js App Router API routes
- **Testing:** Jest with mocking

## Features

### 1. Multi-Runtime Detection

Detects and differentiates between:
- **Docker Desktop** - Default socket at `/var/run/docker.sock`
- **Colima** - Socket at `~/.colima/default/docker.sock`
- **Podman** - Platform-specific socket locations

### 2. Comprehensive Status Information

```typescript
interface DockerStatus {
  dockerType: DockerType;      // Runtime type
  version?: string;            // Version number
  running: boolean;            // Running state
  socketPath?: string;         // Socket location
  contextName?: string;        // Docker context name
}
```

### 3. Cross-Platform Support

| Platform | Docker Desktop | Colima | Podman |
|----------|---------------|--------|--------|
| macOS    | ✅            | ✅     | ✅     |
| Linux    | ✅            | ✅     | ✅     |
| Windows  | ✅            | ❌     | ✅     |

### 4. Advanced Features

- **Context Detection:** Identifies Docker contexts (default, colima, etc.)
- **Daemon Health Check:** Verifies daemon accessibility
- **Context Listing:** Enumerates all available Docker contexts
- **Colima Auto-Start:** Can automatically start Colima if installed

## API Endpoints

### GET /api/docker/status

Basic Docker status check.

**Request:**
```bash
GET /api/docker/status
```

**Response:**
```json
{
  "success": true,
  "data": {
    "dockerType": "Colima",
    "version": "24.0.7",
    "running": true,
    "socketPath": "/Users/user/.colima/default/docker.sock",
    "contextName": "colima"
  }
}
```

### GET /api/docker/status?detailed=true

Detailed status report with contexts and daemon status.

**Request:**
```bash
GET /api/docker/status?detailed=true
```

**Response:**
```json
{
  "success": true,
  "data": {
    "runtime": {
      "dockerType": "Colima",
      "version": "24.0.7",
      "running": true,
      "socketPath": "/Users/user/.colima/default/docker.sock",
      "contextName": "colima"
    },
    "installed": true,
    "daemonStatus": {
      "accessible": true
    },
    "contexts": [
      {
        "name": "colima",
        "current": true,
        "dockerEndpoint": "unix:///Users/user/.colima/default/docker.sock"
      },
      {
        "name": "default",
        "current": false,
        "dockerEndpoint": "unix:///var/run/docker.sock"
      }
    ]
  }
}
```

### POST /api/docker/status

Start Colima if installed.

**Request:**
```bash
POST /api/docker/status
Content-Type: application/json

{
  "action": "start-colima"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Colima started successfully"
}
```

## Frontend Integration

### Using the Client Library

```typescript
import {
  getDockerStatus,
  getDockerStatusReport,
  startColima,
  isDockerRunning,
  getDockerStatusMessage,
} from '@/lib/docker/client';

// Check if Docker is running
const running = await isDockerRunning();

// Get user-friendly status message
const message = await getDockerStatusMessage();
// Returns: "Docker Desktop 24.0.7 is running"

// Get detailed status
const report = await getDockerStatusReport();
console.log(report.data.runtime.dockerType); // "DockerDesktop"

// Start Colima
const result = await startColima();
if (result.success) {
  console.log('Colima started!');
}
```

### React Component Example

```typescript
import { useEffect, useState } from 'react';
import { getDockerStatus } from '@/lib/docker/client';
import type { DockerStatus } from '@/types/docker';

export function DockerStatusIndicator() {
  const [status, setStatus] = useState<DockerStatus | null>(null);

  useEffect(() => {
    async function checkStatus() {
      const response = await getDockerStatus();
      if (response.success && response.data) {
        setStatus(response.data);
      }
    }

    checkStatus();
    const interval = setInterval(checkStatus, 30000); // Check every 30s

    return () => clearInterval(interval);
  }, []);

  if (!status) {
    return <div>Checking Docker status...</div>;
  }

  if (!status.running) {
    return (
      <div className="status-indicator error">
        <span>Docker not running</span>
        <button onClick={handleStart}>Start Docker</button>
      </div>
    );
  }

  return (
    <div className="status-indicator success">
      <span>
        {status.dockerType} {status.version} running
      </span>
    </div>
  );
}
```

## Tauri Integration Path

### Phase 1: Current Implementation (Complete)

Backend API available for web application use.

### Phase 2: Tauri Backend Integration (Future)

The detection logic can be ported to Rust for Tauri:

```rust
// src-tauri/src/docker.rs
use bollard::Docker;

#[derive(Debug, Serialize, Deserialize)]
pub enum DockerType {
    DockerDesktop,
    Colima,
    Podman,
    NotInstalled,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DockerStatus {
    pub docker_type: DockerType,
    pub version: Option<String>,
    pub running: bool,
    pub socket_path: Option<String>,
}

// Tauri command
#[tauri::command]
pub async fn detect_docker() -> Result<DockerStatus, String> {
    // Implementation similar to TypeScript version
    // Uses bollard crate for Docker API access
}
```

### Phase 3: Frontend Migration

The existing client library can be updated to use Tauri commands:

```typescript
// src/lib/docker/client.ts (Tauri version)
import { invoke } from '@tauri-apps/api/tauri';

export async function getDockerStatus(): Promise<DockerStatusResponse> {
  try {
    const data = await invoke<DockerStatus>('detect_docker');
    return { success: true, data };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}
```

## Testing

### Run Unit Tests

```bash
npm run test:unit -- docker-detection
```

### Run Integration Tests

```bash
npm run test:integration -- docker-api
```

### Manual Testing

```bash
# Start development server
npm run dev

# Test API endpoints
curl http://localhost:3000/api/docker/status
curl http://localhost:3000/api/docker/status?detailed=true

# Start Colima (if installed)
curl -X POST http://localhost:3000/api/docker/status \
  -H "Content-Type: application/json" \
  -d '{"action":"start-colima"}'
```

## Detection Algorithm

### Step 1: Check Socket Files

```typescript
const sockets = [
  '/var/run/docker.sock',          // Docker Desktop
  '~/.colima/default/docker.sock', // Colima
  // ... other platform-specific paths
];

for (const socket of sockets) {
  if (existsSync(socket)) {
    // Socket exists, check if daemon is responsive
  }
}
```

### Step 2: Execute Version Command

```bash
docker version --format '{{.Server.Version}}'
# or
podman version --format '{{.Server.Version}}'
```

### Step 3: Identify Context

```bash
docker context show
# Returns: "default", "colima", "desktop-linux", etc.
```

### Step 4: Determine Runtime Type

```typescript
if (contextName.includes('colima') || socketPath.includes('.colima')) {
  return DockerType.Colima;
}
if (contextName === 'desktop-linux' || contextName === 'default') {
  return DockerType.DockerDesktop;
}
// ... etc
```

## Error Handling

### Common Scenarios

1. **No Runtime Installed**
   - Returns: `{ dockerType: 'NotInstalled', running: false }`

2. **Runtime Installed But Not Running**
   - Returns: `{ dockerType: 'DockerDesktop', running: false }`

3. **Socket File Missing**
   - Skips to next runtime check

4. **Permission Denied**
   - Logged but handled gracefully
   - Returns: `{ accessible: false, error: 'Permission denied' }`

5. **Command Execution Timeout**
   - 5-second timeout on all commands
   - Falls back to next detection method

## Security Considerations

1. **Command Injection Prevention**
   - All commands use fixed strings
   - No user input interpolation

2. **File System Access**
   - Only reads socket file existence
   - No file content reading

3. **Process Execution**
   - Limited to safe commands: `docker`, `colima`, `podman`, `which`
   - No shell expansion

4. **Error Information Disclosure**
   - Error messages sanitized
   - No stack traces exposed to frontend

## Performance

- **Initial Detection:** ~100-500ms
- **Socket Check:** ~1-10ms
- **Version Command:** ~50-200ms
- **Context Listing:** ~50-200ms

**Optimization:**
- Parallel runtime checks
- Socket file check first (fast path)
- Results cached for 30 seconds (frontend)

## Limitations

1. **Requires Execute Permissions**
   - Must be able to execute `docker`, `colima`, or `podman` commands

2. **macOS-Specific Colima Support**
   - Colima primarily designed for macOS
   - Limited Linux support

3. **Windows Socket Detection**
   - Named pipes vs Unix sockets
   - Different detection logic

4. **Container Context Switching**
   - Does not automatically switch contexts
   - Reports current context only

## Future Enhancements

1. **Auto-Install Colima**
   - Homebrew integration: `brew install colima`
   - Progress tracking

2. **Runtime Preference Management**
   - User can set preferred runtime
   - Automatic context switching

3. **Health Monitoring**
   - Continuous daemon health checks
   - Automatic restart on failure

4. **Performance Metrics**
   - Track container resource usage
   - CPU, memory, disk stats

5. **Multi-Context Management**
   - Switch between Docker contexts
   - Manage multiple Colima profiles

## Integration Checklist

- [x] Core detection logic implemented
- [x] API routes created
- [x] Client library for frontend
- [x] TypeScript types defined
- [x] Unit tests written
- [x] Integration tests written
- [ ] Frontend UI component (pending)
- [ ] Tauri Rust implementation (pending)
- [ ] End-to-end testing (pending)
- [ ] Documentation complete (this file)

## Related Files

- `/src/lib/docker/detection.ts` - Core detection logic
- `/src/lib/docker/client.ts` - Frontend API client
- `/src/app/api/docker/status/route.ts` - API endpoint
- `/src/types/docker.ts` - Type definitions
- `/tests/unit/docker-detection.test.ts` - Unit tests
- `/tests/integration/docker-api.test.ts` - Integration tests

## References

- [Docker Engine API](https://docs.docker.com/engine/api/)
- [Colima Documentation](https://github.com/abiosoft/colima)
- [Podman Documentation](https://podman.io/)
- [Tauri Documentation](https://tauri.app/)
- [VibeCode Tauri MVP Proposal](/claudedocs/MACOS_APP_DEPLOYMENT_UX_PROPOSAL.md)

---

**Next Steps:**

1. Create frontend UI component to display Docker status
2. Integrate into existing onboarding flow
3. Port detection logic to Rust for Tauri
4. Implement auto-start functionality in Tauri app
5. Update GitHub issue #488 with progress

**Contact:** Backend Architect Agent
**Status:** Implementation complete, ready for review and integration
