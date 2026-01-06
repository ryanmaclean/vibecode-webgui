# Immediate Actions - Start Building

## Current State Assessment

### ✅ What's Working
- Next.js web application
- code-server integration
- Apple Container POC (proven)
- Database (PostgreSQL + pgvector)
- Authentication (NextAuth)
- Monitoring (Datadog)

### ⚠️ What Needs Fixing
- 4 ESLint warnings
- Test failures (mock issues)
- Duplicate mock files
- Datadog connection warnings

### 🎯 What We're Building Toward
- Single binary distribution
- CRDT-based collaboration
- Multimodal UX
- Native macOS app

## Step 1: Clean Up Current Codebase (Today)

### 1.1 Fix ESLint Warnings
```bash
# Fix unused variables
src/app/api/auth/mfa/verify/route.ts:115
src/app/api/chat/stream/route.ts:226
src/app/api/claude/chat/secure-route.ts:145
```

### 1.2 Fix Test Issues
```bash
# Remove duplicate mocks
rm -rf .ts-baseline-temp/

# Fix Datadog mock
tests/unit/lib/monitoring/datadog-integration.test.ts
```

### 1.3 Update Dependencies
```bash
npm audit fix
npm update
```

## Step 2: Integrate Apple Container (This Week)

### 2.1 Create Container Wrapper
```typescript
// src/lib/container/apple-container.ts
export class AppleContainerRuntime {
  async start(image: string, options: ContainerOptions) {
    // Wrapper around `container run`
  }
  
  async stop(containerId: string) {
    // Wrapper around `container stop`
  }
  
  async list() {
    // Wrapper around `container list`
  }
}
```

### 2.2 Add Container Management API
```typescript
// src/app/api/containers/route.ts
export async function POST(req: Request) {
  const { action, image, options } = await req.json()
  
  const runtime = new AppleContainerRuntime()
  
  switch (action) {
    case 'start':
      return runtime.start(image, options)
    case 'stop':
      return runtime.stop(options.id)
    case 'list':
      return runtime.list()
  }
}
```

### 2.3 Update Workspace Provisioning
```typescript
// src/lib/workspace/provisioner.ts
import { AppleContainerRuntime } from '@/lib/container/apple-container'

export async function provisionWorkspace(userId: string, projectId: string) {
  const runtime = new AppleContainerRuntime()
  
  // Start code-server in Apple Container
  const container = await runtime.start('codercom/code-server:latest', {
    ports: { 8080: 8080 },
    env: { PASSWORD: generatePassword() },
    volumes: { [`workspace-${projectId}`]: '/home/coder' }
  })
  
  return {
    url: `http://localhost:8080`,
    containerId: container.id
  }
}
```

## Step 3: Add Basic CRDT Support (Next Week)

### 3.1 Install Yjs
```bash
npm install yjs y-websocket y-protocols
```

### 3.2 Create CRDT Service
```typescript
// src/lib/crdt/yjs-service.ts
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'

export class YjsService {
  private doc: Y.Doc
  private provider: WebsocketProvider
  
  constructor(roomId: string) {
    this.doc = new Y.Doc()
    this.provider = new WebsocketProvider(
      'ws://localhost:1234',
      roomId,
      this.doc
    )
  }
  
  getText(name: string): Y.Text {
    return this.doc.getText(name)
  }
  
  getMap(name: string): Y.Map<any> {
    return this.doc.getMap(name)
  }
}
```

### 3.3 Add WebSocket Server
```typescript
// src/app/api/sync/route.ts
import { WebSocketServer } from 'ws'

const wss = new WebSocketServer({ port: 1234 })

wss.on('connection', (ws) => {
  // Handle Yjs sync
})
```

## Step 4: Create Native macOS App Prototype (Week 3-4)

### 4.1 Initialize Tauri Project
```bash
npm install -D @tauri-apps/cli
npm install @tauri-apps/api

npx tauri init
```

### 4.2 Configure Tauri
```json
// src-tauri/tauri.conf.json
{
  "package": {
    "productName": "VibeCode",
    "version": "0.1.0"
  },
  "build": {
    "beforeBuildCommand": "npm run build",
    "beforeDevCommand": "npm run dev",
    "devPath": "http://localhost:3000",
    "distDir": "../out"
  },
  "tauri": {
    "bundle": {
      "identifier": "dev.vibecode.app",
      "icon": [
        "icons/icon.icns"
      ]
    }
  }
}
```

### 4.3 Add Container Integration
```rust
// src-tauri/src/main.rs
#[tauri::command]
async fn start_container(image: String) -> Result<String, String> {
    let output = Command::new("container")
        .args(&["run", "-d", &image])
        .output()
        .map_err(|e| e.to_string())?;
    
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}
```

## Execution Plan

### Week 1: Foundation
- [ ] Fix ESLint warnings
- [ ] Fix test failures
- [ ] Clean up duplicate files
- [ ] Update dependencies
- [ ] Document current architecture

### Week 2: Apple Container Integration
- [ ] Create container wrapper library
- [ ] Add container management API
- [ ] Update workspace provisioning
- [ ] Test with code-server
- [ ] Document integration

### Week 3: CRDT Basics
- [ ] Install Yjs
- [ ] Create CRDT service
- [ ] Add WebSocket server
- [ ] Test real-time sync
- [ ] Document collaboration

### Week 4: Native App Prototype
- [ ] Initialize Tauri
- [ ] Configure build
- [ ] Add container integration
- [ ] Test .app bundle
- [ ] Create .dmg

## Success Metrics

### Week 1
- ✅ 0 ESLint warnings
- ✅ All tests passing
- ✅ Clean codebase

### Week 2
- ✅ code-server starts via API
- ✅ Workspaces provision automatically
- ✅ Apple Container integrated

### Week 3
- ✅ Real-time text sync working
- ✅ Multiple users can edit
- ✅ Conflicts resolve automatically

### Week 4
- ✅ VibeCode.app launches
- ✅ Starts code-server automatically
- ✅ .dmg distributable created

## Commands to Run

### Today
```bash
# Fix linting
npm run lint -- --fix

# Fix tests
npm run test:unit

# Clean up
rm -rf .ts-baseline-temp/
git clean -fd
```

### This Week
```bash
# Create container wrapper
mkdir -p src/lib/container
touch src/lib/container/apple-container.ts

# Add tests
mkdir -p tests/unit/lib/container
touch tests/unit/lib/container/apple-container.test.ts
```

### Next Week
```bash
# Install CRDT
npm install yjs y-websocket y-protocols

# Create service
mkdir -p src/lib/crdt
touch src/lib/crdt/yjs-service.ts
```

### Week 4
```bash
# Initialize Tauri
npm install -D @tauri-apps/cli
npx tauri init

# Build app
npm run tauri build
```

## Let's Start

**First command to run right now**:
```bash
npm run lint -- --fix
```

Then we'll tackle the tests, then build the container integration.

One step at a time. Let's build this.
